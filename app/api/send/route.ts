import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const maxDuration = 60 // Vercel Pro: 60s, Hobby: 10s

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
    provider: 'gmail' | 'outlook' | 'yahoo' | 'custom'
    smtpHost?: string
    smtpPort?: string
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

function buildTransportConfig(creds: SendRequest['credentials']) {
  switch (creds.provider) {
    case 'gmail':
      return {
        service: 'gmail',
        auth: { user: creds.email, pass: creds.password },
      }
    case 'outlook':
      return {
        service: 'hotmail',
        auth: { user: creds.email, pass: creds.password },
      }
    case 'yahoo':
      return {
        service: 'yahoo',
        auth: { user: creds.email, pass: creds.password },
      }
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

  if (!credentials?.email || !credentials?.password) {
    return NextResponse.json({ error: 'פרטי אימות חסרים' }, { status: 400 })
  }
  if (!contacts?.length || !emailColumn) {
    return NextResponse.json({ error: 'רשימת נמענים חסרה' }, { status: 400 })
  }

  // Build transporter
  const config = buildTransportConfig(credentials)
  const transporter = nodemailer.createTransport(config as nodemailer.TransportOptions)

  // Verify connection once
  try {
    await transporter.verify()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאת חיבור'
    return NextResponse.json({ error: `שגיאת חיבור ל-SMTP: ${msg}` }, { status: 400 })
  }

  // Prepare attachment buffer (once, reused per email)
  const attachmentConfig = attachment
    ? [
        {
          filename: attachment.name,
          content: Buffer.from(attachment.data, 'base64'),
          contentType: attachment.type,
        },
      ]
    : undefined

  let sent = 0
  let failed = 0
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

    const html = isHtml ? personalBody : personalBody.replace(/\n/g, '<br/>')
    const text = isHtml ? personalBody.replace(/<[^>]*>/g, '') : personalBody

    try {
      await transporter.sendMail({
        from: credentials.email,
        to,
        subject: personalSubject,
        html,
        text,
        attachments: attachmentConfig,
      })
      sent++
    } catch (err: unknown) {
      failed++
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      errors.push({ email: to, error: msg })
    }

    // Tiny delay to avoid SMTP rate limiting
    await new Promise(r => setTimeout(r, 150))
  }

  return NextResponse.json({ sent, failed, errors })
}
