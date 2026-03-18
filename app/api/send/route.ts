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
    email: string
    password: string
    provider: 'gmail' | 'outlook' | 'yahoo' | 'custom' | 'resend'
    smtpHost?: string
    smtpPort?: string
    resendApiKey?: string
    resendFrom?: string
  }
  contacts: Contact[]
  emailColumn: string
  subject: string
  body: string
  isHtml: boolean
  attachment?: Attachment | null
}

function personalize(template: string, contact: Contact): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => contact[key] ?? `{{${key}}}`)
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

function buildTransportConfig(creds: SendRequest['credentials']) {
  switch (creds.provider) {
    case 'gmail':
      return { service: 'gmail', auth: { user: creds.email, pass: creds.password } }
    case 'outlook':
      return { service: 'hotmail', auth: { user: creds.email, pass: creds.password } }
    case 'yahoo':
      return { service: 'yahoo', auth: { user: creds.email, pass: creds.password } }
    case 'custom':
      return {
        host: creds.smtpHost,
        port: parseInt(creds.smtpPort ?? '587', 10),
        secure: creds.smtpPort === '465',
        auth: { user: creds.email, pass: creds.password },
      }
  }
}

export async function POST(request: NextRequest) {
  let data: SendRequest
  try {
    data = await request.json()
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  }

  const { credentials, contacts, emailColumn, subject, body, isHtml, attachment } = data

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
      const innerHtml = isHtml
        ? personalBody
        : personalBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')

      const attachments = attachment
        ? [{ filename: attachment.name, content: attachment.data }]
        : undefined

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

  // ── SMTP path ──────────────────────────────────────────────────────────────
  if (!credentials.email || !credentials.password) {
    return NextResponse.json({ error: 'פרטי אימות חסרים' }, { status: 400 })
  }

  const config = buildTransportConfig(credentials)
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
    const innerHtml = isHtml
      ? personalBody
      : personalBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')

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
