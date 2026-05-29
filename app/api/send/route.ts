import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export const maxDuration = 60

interface Contact {
  [key: string]: string
}

interface Attachment {
  name: string
  data: string // base64
  type: string
}

interface SendRequest {
  credentials: {
    email?: string
    password?: string
    provider: 'gmail' | 'resend'
    resendApiKey?: string
    resendFrom?: string
  }
  contacts: Contact[]
  emailColumn: string
  subject: string
  body: string
  isHtml: boolean
  attachment?: Attachment | null
  isBcc?: boolean
  senderName?: string
}

function buildFrom(name: string | undefined, address: string): string {
  const clean = name?.trim().replace(/"/g, '')
  return clean ? `"${clean}" <${address}>` : address
}

function personalize(template: string, contact: Contact): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => contact[key] ?? `{{${key}}}`)
}

function escapeBody(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function buildHtml(innerHtml: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="direction:rtl;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;background:#ffffff;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;">
    ${innerHtml}
  </div>
</body>
</html>`
}

function buildGmailTransport(creds: SendRequest['credentials']) {
  return { service: 'gmail', auth: { user: creds.email, pass: creds.password } }
}

function collectEmails(contacts: Contact[], emailColumn: string): string[] {
  return contacts.map(c => c[emailColumn]?.trim()).filter((e): e is string => !!e)
}

export async function POST(request: NextRequest) {
  let data: SendRequest
  try {
    data = await request.json()
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  }

  const { credentials, contacts, emailColumn, subject, body, isHtml, attachment, isBcc } = data

  if (!contacts?.length || !emailColumn) {
    return NextResponse.json({ error: 'רשימת נמענים חסרה' }, { status: 400 })
  }

  // ── Resend path ────────────────────────────────────────────────────────────
  if (credentials.provider === 'resend') {
    if (!credentials.resendApiKey) {
      return NextResponse.json({ error: 'Resend API Key חסר' }, { status: 400 })
    }
    if (!credentials.resendFrom) {
      return NextResponse.json({ error: 'כתובת שולח חסרה' }, { status: 400 })
    }

    const resend = new Resend(credentials.resendApiKey)
    const attachments = attachment
      ? [{ filename: attachment.name, content: attachment.data }]
      : undefined

    // BCC mode: one message to the whole batch (no personalization)
    if (isBcc) {
      const bcc = collectEmails(contacts, emailColumn)
      if (!bcc.length) {
        return NextResponse.json({ sent: 0, failed: 0, errors: [] })
      }
      const innerHtml = isHtml ? body : escapeBody(body)
      try {
        const { error } = await resend.emails.send({
          from: credentials.resendFrom,
          to: credentials.resendFrom,
          bcc,
          subject,
          html: buildHtml(innerHtml),
          attachments,
        })
        if (error) {
          return NextResponse.json({ sent: 0, failed: bcc.length, errors: [{ email: `(${bcc.length} ב-BCC)`, error: error.message }] })
        }
        return NextResponse.json({ sent: bcc.length, failed: 0, errors: [] })
      } catch (err: unknown) {
        return NextResponse.json({ sent: 0, failed: bcc.length, errors: [{ email: `(${bcc.length} ב-BCC)`, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }] })
      }
    }

    // Personalized mode: one message per recipient
    let sent = 0, failed = 0
    const errors: { email: string; error: string }[] = []

    for (const contact of contacts) {
      const to = contact[emailColumn]?.trim()
      if (!to) {
        failed++
        errors.push({ email: '(ריק)', error: 'כתובת מייל חסרה' })
        continue
      }

      const personalSubject = personalize(subject, contact)
      const personalBody = personalize(body, contact)
      const innerHtml = isHtml ? personalBody : escapeBody(personalBody)

      try {
        const { error } = await resend.emails.send({
          from: credentials.resendFrom,
          to,
          subject: personalSubject,
          html: buildHtml(innerHtml),
          attachments,
        })
        if (error) {
          failed++
          errors.push({ email: to, error: error.message })
        } else {
          sent++
        }
      } catch (err: unknown) {
        failed++
        errors.push({ email: to, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' })
      }
    }

    return NextResponse.json({ sent, failed, errors })
  }

  // ── SMTP (Gmail) path ────────────────────────────────────────────────────────
  if (!credentials.email || !credentials.password) {
    return NextResponse.json({ error: 'פרטי אימות חסרים' }, { status: 400 })
  }

  const config = buildGmailTransport(credentials)
  const transporter = nodemailer.createTransport(config as nodemailer.TransportOptions)

  try {
    await transporter.verify()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאת חיבור'
    return NextResponse.json({ error: `שגיאת חיבור ל-SMTP: ${msg}` }, { status: 400 })
  }

  const attachmentConfig = attachment
    ? [{ filename: attachment.name, content: Buffer.from(attachment.data, 'base64'), contentType: attachment.type }]
    : undefined

  // BCC mode: one message to the whole batch (no personalization)
  if (isBcc) {
    const bcc = collectEmails(contacts, emailColumn)
    if (!bcc.length) {
      return NextResponse.json({ sent: 0, failed: 0, errors: [] })
    }
    const innerHtml = isHtml ? body : escapeBody(body)
    try {
      await transporter.sendMail({
        from: credentials.email,
        to: credentials.email,
        bcc,
        subject,
        html: buildHtml(innerHtml),
        text: isHtml ? body.replace(/<[^>]*>/g, '') : body,
        attachments: attachmentConfig,
      })
      return NextResponse.json({ sent: bcc.length, failed: 0, errors: [] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      return NextResponse.json({ sent: 0, failed: bcc.length, errors: [{ email: `(${bcc.length} ב-BCC)`, error: msg }] })
    }
  }

  // Personalized mode: one message per recipient
  let sent = 0, failed = 0
  const errors: { email: string; error: string }[] = []

  for (const contact of contacts) {
    const to = contact[emailColumn]?.trim()
    if (!to) {
      failed++
      errors.push({ email: '(ריק)', error: 'כתובת מייל חסרה' })
      continue
    }

    const personalSubject = personalize(subject, contact)
    const personalBody = personalize(body, contact)
    const innerHtml = isHtml ? personalBody : escapeBody(personalBody)

    try {
      await transporter.sendMail({
        from: credentials.email,
        to,
        subject: personalSubject,
        html: buildHtml(innerHtml),
        text: isHtml ? personalBody.replace(/<[^>]*>/g, '') : personalBody,
        attachments: attachmentConfig,
      })
      sent++
    } catch (err: unknown) {
      failed++
      errors.push({ email: to, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' })
    }
  }

  return NextResponse.json({ sent, failed, errors })
}
