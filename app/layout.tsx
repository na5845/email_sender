import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Email Sender Pro',
  description: 'שלח מיילים מותאמים אישית לאלפי נמענים בקלות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
