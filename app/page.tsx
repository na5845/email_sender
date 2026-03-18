'use client'

import { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react'
import * as XLSX from 'xlsx'
import {
  Mail, Lock, Upload, Users, FileText, Send, Eye, RotateCcw,
  CheckCircle, XCircle, ChevronDown, Paperclip,
  Zap, Copy, X, Info, Sun, Moon,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Contact { [key: string]: string }
interface Credentials {
  email: string; password: string; provider: 'gmail' | 'resend'
  resendApiKey: string; resendFrom: string
}
interface Attachment { name: string; data: string; type: string; size: number }
interface LogEntry { type: 'success' | 'error' | 'info'; message: string; time: string }
interface BatchResult { sent: number; failed: number; errors: { email: string; error: string }[] }

// ── Theme ──────────────────────────────────────────────────────────────────

const DARK = {
  page: 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white',
  card: 'glass rounded-2xl p-6 mb-6 animate-slide-up',
  heading: 'text-white',
  label: 'text-gray-400',
  muted: 'text-gray-500',
  faint: 'text-gray-600',
  input: 'bg-white/5 border border-white/10 text-white placeholder-gray-600 hover:border-white/20 focus:border-blue-500',
  select: 'bg-white/5 border border-white/10 text-white hover:border-white/20 focus:border-blue-500',
  provActive: 'bg-blue-600/40 border-blue-500 text-blue-200',
  provInactive: 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20',
  infoBar: 'bg-blue-500/10 border border-blue-500/20',
  infoText: 'text-blue-300/80',
  sectionIcon: 'bg-blue-600/30 text-blue-400',
  dropzoneBorder: 'border-white/10 hover:border-blue-500/50',
  varSection: 'bg-white/[0.03] border border-white/5',
  varSectionText: 'text-gray-500',
  chipSubj: 'bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/30 text-cyan-300',
  chipBody: 'bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300',
  tableBorder: 'border border-white/10',
  tableHead: 'bg-white/5',
  tableHeadText: 'text-gray-400',
  tableRow: 'border-t border-white/5 hover:bg-white/5',
  tableCell: 'text-gray-300',
  tableMore: 'text-gray-600',
  delayPanel: 'glass rounded-2xl px-6 py-4 mb-6 flex items-center gap-4 flex-wrap',
  delayActive: 'bg-blue-600/40 border-blue-500 text-blue-200 font-medium',
  delayInactive: 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20',
  logsBg: 'bg-black/30',
  logsSuccess: 'text-green-400',
  logsError: 'text-red-400',
  logsInfo: 'text-gray-400',
  logsTime: 'text-gray-600',
  progressBg: 'bg-white/10',
  pauseBar: 'bg-amber-500/10 border border-amber-500/30',
  pauseText: 'text-amber-300',
  pauseSub: 'text-amber-400/70',
  previewBtn: 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white',
  stopBtn: 'bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300',
  resetBtn: 'bg-white/5 hover:bg-white/10 border border-white/10 text-white',
  modal: 'bg-gray-900 border border-white/10',
  modalDivider: 'border-b border-white/10',
  modalPreview: 'bg-white/5 text-gray-200',
  modalAttach: 'border-t border-white/10 text-gray-400',
  footer: 'text-gray-700',
  toggleBtn: 'bg-white/10 hover:bg-white/20 border border-white/20 text-gray-300',
  htmlActive: 'bg-green-600/30 border-green-500/50 text-green-300',
}

const LIGHT = {
  page: 'bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 text-gray-900',
  card: 'bg-white rounded-2xl p-6 mb-6 animate-slide-up border border-gray-200 shadow-sm',
  heading: 'text-gray-900',
  label: 'text-gray-600',
  muted: 'text-gray-500',
  faint: 'text-gray-400',
  input: 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:border-blue-500 shadow-sm',
  select: 'bg-white border border-gray-300 text-gray-900 hover:border-gray-400 focus:border-blue-500 shadow-sm',
  provActive: 'bg-blue-100 border-blue-500 text-blue-700',
  provInactive: 'bg-white border-gray-300 text-gray-600 hover:border-gray-400',
  infoBar: 'bg-blue-50 border border-blue-200',
  infoText: 'text-blue-700',
  sectionIcon: 'bg-blue-100 text-blue-600',
  dropzoneBorder: 'border-gray-300 hover:border-purple-400',
  varSection: 'bg-blue-50 border border-blue-100',
  varSectionText: 'text-gray-500',
  chipSubj: 'bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-700',
  chipBody: 'bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-700',
  tableBorder: 'border border-gray-200',
  tableHead: 'bg-gray-50',
  tableHeadText: 'text-gray-600',
  tableRow: 'border-t border-gray-100 hover:bg-gray-50',
  tableCell: 'text-gray-700',
  tableMore: 'text-gray-400',
  delayPanel: 'bg-white rounded-2xl px-6 py-4 mb-6 flex items-center gap-4 flex-wrap border border-gray-200 shadow-sm',
  delayActive: 'bg-blue-100 border-blue-500 text-blue-700 font-medium',
  delayInactive: 'bg-white border-gray-300 text-gray-600 hover:border-gray-400',
  logsBg: 'bg-gray-50 border border-gray-200',
  logsSuccess: 'text-green-600',
  logsError: 'text-red-500',
  logsInfo: 'text-gray-600',
  logsTime: 'text-gray-400',
  progressBg: 'bg-gray-200',
  pauseBar: 'bg-amber-50 border border-amber-200',
  pauseText: 'text-amber-700',
  pauseSub: 'text-amber-600',
  previewBtn: 'bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700',
  stopBtn: 'bg-red-50 hover:bg-red-100 border border-red-300 text-red-600',
  resetBtn: 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-700',
  modal: 'bg-white border border-gray-200 shadow-2xl',
  modalDivider: 'border-b border-gray-200',
  modalPreview: 'bg-gray-50 text-gray-800',
  modalAttach: 'border-t border-gray-200 text-gray-500',
  footer: 'text-gray-400',
  toggleBtn: 'bg-white hover:bg-gray-100 border border-gray-300 text-gray-600 shadow-sm',
  htmlActive: 'bg-green-50 border-green-400 text-green-700',
}

type ThemeConfig = typeof DARK
const ThemeCtx = createContext<ThemeConfig>(DARK)
const useT = () => useContext(ThemeCtx)

// ── Helper Components ───────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const t = useT()
  return <div className={`${t.card} ${className}`}>{children}</div>
}

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  const t = useT()
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-2 rounded-lg ${t.sectionIcon}`}>{icon}</div>
      <h2 className={`text-lg font-semibold ${t.heading}`}>{title}</h2>
      {badge && (
        <span className="mr-auto text-xs bg-blue-600/40 text-blue-200 px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
    </div>
  )
}

function Input({
  label, value, onChange, type = 'text', placeholder, className = '', dir = 'ltr'
}: {
  label?: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; className?: string; dir?: string
}) {
  const t = useT()
  return (
    <div className={className}>
      {label && <label className={`block text-sm mb-1.5 ${t.label}`}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} dir={dir}
        className={`w-full rounded-xl px-4 py-3 transition-all ${t.input}`}
      />
    </div>
  )
}

function VariableChip({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-all cursor-pointer ${t.chipBody}`}
    >
      <span>{'{{' + label + '}}'}</span>
      <Copy className="w-3 h-3" />
    </button>
  )
}

function DropZone({ onFile, accept, label, sublabel, file, onClear }: {
  onFile: (f: File) => void; accept: string; label: string
  sublabel?: string; file?: string | null; onClear?: () => void
}) {
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all
        ${dragging ? 'drag-over' : t.dropzoneBorder}
        ${file ? 'border-green-500/40 bg-green-500/5' : 'cursor-pointer'}`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      {file ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{file}</span>
          </div>
          {onClear && (
            <button onClick={e => { e.stopPropagation(); onClear() }}
              className={`transition-colors hover:text-red-400 ${t.muted}`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <Upload className={`w-8 h-8 mx-auto mb-2 ${t.faint}`} />
          <p className={`text-sm ${t.label}`}>{label}</p>
          {sublabel && <p className={`text-xs mt-1 ${t.faint}`}>{sublabel}</p>}
        </div>
      )}
    </div>
  )
}

// ── Personalize helper ──────────────────────────────────────────────────────

function personalize(template: string, contact: Contact): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => contact[key] ?? `{{${key}}}`)
}

// ── Main App ────────────────────────────────────────────────────────────────

export default function EmailSenderPro() {
  const [dark, setDark] = useState(true)
  const t = dark ? DARK : LIGHT

  useEffect(() => {
    const saved = localStorage.getItem('esp-theme')
    if (saved === 'light') setDark(false)
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('esp-theme', next ? 'dark' : 'light')
  }

  // Credentials
  const [creds, setCreds] = useState<Credentials>({
    email: '', password: '', provider: 'gmail', resendApiKey: '', resendFrom: ''
  })

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [emailCol, setEmailCol] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')

  // Compose
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isHtml, setIsHtml] = useState(false)

  // Attachment
  const [attachment, setAttachment] = useState<Attachment | null>(null)

  // Sending settings
  const [delaySec, setDelaySec] = useState(3)

  // Progress
  const [sending, setSending] = useState(false)
  const [totalSent, setTotalSent] = useState(0)
  const [totalFailed, setTotalFailed] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [done, setDone] = useState(false)
  const [pauseUntil, setPauseUntil] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(0)
  const stopRef = useRef(false)

  useEffect(() => {
    if (!pauseUntil) return
    const id = setInterval(() => setNowTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [pauseUntil])

  const [showPreview, setShowPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ── Excel parse ────────────────────────────────────────────────────────────

  const handleExcel = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Contact>(ws, { defval: '' })
      if (!rows.length) return
      const cols = Object.keys(rows[0])
      setColumns(cols); setContacts(rows)
      const autoEmail = cols.find(c =>
        c.toLowerCase().includes('email') || c.toLowerCase().includes('mail') ||
        c.includes('אימייל') || c.includes('מייל')
      )
      if (autoEmail) setEmailCol(autoEmail)
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Attachment parse ───────────────────────────────────────────────────────

  const handleAttachment = (file: File) => {
    if (file.size > 15 * 1024 * 1024) { alert('קובץ גדול מדי – מקסימום 15MB'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer)
      const b64 = btoa(arr.reduce((d, b) => d + String.fromCharCode(b), ''))
      setAttachment({ name: file.name, data: b64, type: file.type, size: file.size })
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Insert variable ────────────────────────────────────────────────────────

  const insertVar = (col: string, target: 'subject' | 'body') => {
    const token = `{{${col}}}`
    if (target === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const s = el.selectionStart ?? subject.length, e = el.selectionEnd ?? subject.length
      const next = subject.slice(0, s) + token + subject.slice(e)
      setSubject(next)
      setTimeout(() => el.setSelectionRange(s + token.length, s + token.length), 0)
    } else if (target === 'body' && bodyRef.current) {
      const el = bodyRef.current
      const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length
      const next = body.slice(0, s) + token + body.slice(e)
      setBody(next)
      setTimeout(() => el.setSelectionRange(s + token.length, s + token.length), 0)
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  const previewContact = contacts[0] ?? {}
  const previewSubject = personalize(subject, previewContact)
  const previewBody = isHtml
    ? personalize(body, previewContact)
    : personalize(body, previewContact).replace(/\n/g, '<br/>')

  // ── Send ───────────────────────────────────────────────────────────────────

  const addLog = (type: LogEntry['type'], message: string) =>
    setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString('he-IL') }])

  const handleSend = async () => {
    if (!creds.email || !creds.password) return alert('נא להזין כתובת מייל וסיסמה')
    if (!emailCol || !contacts.length) return alert('נא להעלות קובץ אקסל ולבחור עמודת אימייל')
    if (!subject.trim()) return alert('נא להזין נושא למייל')
    if (!body.trim()) return alert('נא להזין גוף המייל')

    setSending(true); setDone(false); setTotalSent(0); setTotalFailed(0)
    setTotalProcessed(0); setLogs([]); setPauseUntil(null); stopRef.current = false

    const isResend = creds.provider === 'resend'
    const DAILY_LIMIT = 500, PAUSE_MS = 24 * 60 * 60 * 1000
    let sent = 0, failed = 0, dailySent = 0

    addLog('info', isResend
      ? `מתחיל שליחה ל-${contacts.length.toLocaleString()} נמענים דרך Resend...`
      : `מתחיל שליחה ל-${contacts.length.toLocaleString()} נמענים (${delaySec}ש׳ בין כל מייל)...`
    )

    for (let i = 0; i < contacts.length; i++) {
      if (stopRef.current) { addLog('info', `⛔ עצר ידני לאחר ${i} מיילים`); break }

      if (!isResend && dailySent > 0 && dailySent % DAILY_LIMIT === 0) {
        const resumeAt = Date.now() + PAUSE_MS
        setPauseUntil(resumeAt)
        addLog('info', `⏸ הגעת ל-${dailySent} מיילים – ממתין 24 שעות לפני המשך...`)
        while (Date.now() < resumeAt && !stopRef.current) {
          await new Promise(r => setTimeout(r, 1000))
        }
        setPauseUntil(null)
        if (!stopRef.current) addLog('info', `▶ ממשיך שליחה (מייל ${i + 1})...`)
      }

      if (stopRef.current) { addLog('info', `⛔ עצר ידני`); break }

      const contact = contacts[i]
      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentials: creds, contacts: [contact], emailColumn: emailCol,
            subject, body, isHtml, attachment,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'שגיאת שרת' }))
          failed++; addLog('error', `✗ [${i + 1}] ${contact[emailCol]}: ${err.error}`)
        } else {
          const result: BatchResult = await res.json()
          sent += result.sent; failed += result.failed; dailySent += result.sent
          if (result.failed > 0 && result.errors[0]) {
            addLog('error', `✗ [${i + 1}] ${result.errors[0].email}: ${result.errors[0].error}`)
          } else {
            addLog('success', `✓ [${i + 1}] ${contact[emailCol]}`)
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'שגיאת רשת'
        failed++; addLog('error', `✗ [${i + 1}] ${contact[emailCol]}: ${msg}`)
      }

      setTotalSent(sent); setTotalFailed(failed); setTotalProcessed(i + 1)

      if (!isResend && i < contacts.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, delaySec * 1000))
      }
    }

    addLog('info', `✅ סיום! נשלחו ${sent.toLocaleString()} • נכשלו ${failed.toLocaleString()}`)
    setSending(false); setDone(true)
  }

  const reset = () => {
    setContacts([]); setColumns([]); setEmailCol(''); setFileName('')
    setSubject(''); setBody(''); setAttachment(null)
    setTotalSent(0); setTotalFailed(0); setTotalProcessed(0)
    setLogs([]); setDone(false)
  }

  const progress = contacts.length > 0 ? (totalProcessed / contacts.length) * 100 : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ThemeCtx.Provider value={t}>
      <div className={`min-h-screen ${t.page} p-4 md:p-8 transition-colors duration-300`} dir="rtl">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="relative text-center mb-10 pt-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`absolute left-0 top-4 p-2.5 rounded-xl border transition-all ${t.toggleBtn}`}
              title={dark ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/20">
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent mb-2">
              Email Sender Pro
            </h1>
            <p className={`text-sm ${t.muted}`}>שלח מיילים מותאמים אישית לאלפי נמענים</p>
          </div>

          {/* ── 1. Credentials ── */}
          <Card>
            <SectionTitle icon={<Lock className="w-4 h-4" />} title="פרטי שליחה" />

            <div className="mb-4">
              <label className={`block text-sm mb-1.5 ${t.label}`}>ספק מייל</label>
              <div className="grid grid-cols-2 gap-2">
                {([{ id: 'gmail', label: 'Gmail' }, { id: 'resend', label: 'Resend' }] as const).map(p => (
                  <button key={p.id} onClick={() => setCreds(prev => ({ ...prev, provider: p.id }))}
                    className={`py-2 px-3 rounded-xl text-sm border transition-all ${
                      creds.provider === p.id ? t.provActive : t.provInactive
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {creds.provider === 'gmail' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 animate-fade-in">
                <Input label="כתובת Gmail" value={creds.email}
                  onChange={v => setCreds(p => ({ ...p, email: v }))}
                  placeholder="you@gmail.com" type="email" />
                <Input label="סיסמת אפליקציה (App Password)" value={creds.password}
                  onChange={v => setCreds(p => ({ ...p, password: v }))}
                  placeholder="xxxx xxxx xxxx xxxx" type="password" />
              </div>
            )}

            {creds.provider === 'resend' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 animate-fade-in">
                <Input label="Resend API Key" value={creds.resendApiKey}
                  onChange={v => setCreds(p => ({ ...p, resendApiKey: v }))}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx" type="password" />
                <Input label="כתובת שולח (דומיין מאומת)" value={creds.resendFrom}
                  onChange={v => setCreds(p => ({ ...p, resendFrom: v }))}
                  placeholder="name@yourdomain.com" type="email" />
              </div>
            )}

            <div className={`flex items-start gap-2 p-3 rounded-xl ${t.infoBar}`}>
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              {creds.provider === 'resend' ? (
                <p className={`text-xs ${t.infoText}`}>
                  Resend: 3,000 מיילים/חודש חינם • 100/יום חינם • ללא הגבלה יומית בתשלום ($20/חודש).
                  הדומיין חייב להיות מאומת ב-resend.com/domains. מפתח API: resend.com/api-keys
                </p>
              ) : (
                <p className={`text-xs ${t.infoText}`}>
                  Gmail: הפעל 2FA ← הגדרות חשבון ← אבטחה ← סיסמאות אפליקציה. מגבלה: 500/יום (הכלי יעצור אוטומטית ויחכה 24 שעות)
                </p>
              )}
            </div>
          </Card>

          {/* ── 2. Recipients ── */}
          <Card>
            <SectionTitle icon={<Users className="w-4 h-4" />} title="רשימת נמענים"
              badge={contacts.length ? `${contacts.length.toLocaleString()} אנשי קשר` : undefined} />

            <DropZone onFile={handleExcel} accept=".xlsx,.xls,.csv"
              label="גרור קובץ Excel / CSV לכאן או לחץ לבחירה"
              sublabel=".xlsx, .xls, .csv – ללא הגבלת שורות"
              file={fileName}
              onClear={() => { setFileName(''); setContacts([]); setColumns([]); setEmailCol('') }} />

            {columns.length > 0 && (
              <div className="mt-4 animate-fade-in">
                <label className={`block text-sm mb-1.5 ${t.label}`}>עמודת אימייל</label>
                <div className="relative">
                  <select value={emailCol} onChange={e => setEmailCol(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 appearance-none transition-all ${t.select}`}>
                    <option value="">-- בחר עמודה --</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className={`absolute left-3 top-3.5 w-4 h-4 pointer-events-none ${t.muted}`} />
                </div>

                <div className="mt-4">
                  <p className={`text-xs mb-2 ${t.varSectionText}`}>עמודות זמינות כמשתנים – לחץ להוספה לנושא / גוף:</p>
                  <div className="flex flex-wrap gap-2">
                    {columns.map(c => (
                      <div key={c} className="flex gap-1">
                        <button onClick={() => insertVar(c, 'subject')} title="הוסף לנושא"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-all ${t.chipSubj}`}>
                          {'{{' + c + '}} נושא'}
                        </button>
                        <button onClick={() => insertVar(c, 'body')} title="הוסף לגוף"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-all ${t.chipBody}`}>
                          {'{{' + c + '}} גוף'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`mt-4 overflow-x-auto rounded-xl ${t.tableBorder}`}>
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className={t.tableHead}>
                        {columns.map(c => (
                          <th key={c} className={`px-3 py-2 font-medium whitespace-nowrap ${t.tableHeadText}`}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 4).map((row, i) => (
                        <tr key={i} className={`transition-colors ${t.tableRow}`}>
                          {columns.map(c => (
                            <td key={c} className={`px-3 py-2 whitespace-nowrap max-w-[150px] truncate ${t.tableCell}`}>{row[c]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {contacts.length > 4 && (
                    <p className={`text-center text-xs py-2 ${t.tableMore}`}>...ועוד {(contacts.length - 4).toLocaleString()} שורות</p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* ── 3. Compose ── */}
          <Card>
            <SectionTitle icon={<FileText className="w-4 h-4" />} title="כתיבת המייל" />

            <div className="mb-4">
              <label className={`block text-sm mb-1.5 ${t.label}`}>נושא</label>
              <input ref={subjectRef} type="text" value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="לדוגמה: שלום {{שם}}, עדכון חשוב עבורך"
                dir="rtl"
                className={`w-full rounded-xl px-4 py-3 transition-all ${t.input}`} />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-sm ${t.label}`}>גוף המייל</label>
                <button onClick={() => setIsHtml(p => !p)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    isHtml ? t.htmlActive : t.provInactive
                  }`}>
                  {isHtml ? '‹/› HTML מופעל' : '‹/› HTML'}
                </button>
              </div>
              <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
                placeholder={isHtml
                  ? '<p>שלום <strong>{{שם}}</strong>,</p>\n<p>תוכן המייל כאן...</p>'
                  : 'שלום {{שם}},\n\nתוכן המייל כאן...\n\nבברכה,\n{{שם שולח}}'}
                dir="rtl" rows={10}
                className={`w-full rounded-xl px-4 py-3 resize-y transition-all font-mono text-sm ${t.input}`} />
            </div>

            {columns.length > 0 && (
              <div className={`p-3 rounded-xl ${t.varSection}`}>
                <p className={`text-xs mb-2 flex items-center gap-1 ${t.varSectionText}`}>
                  <Zap className="w-3 h-3" /> משתנים זמינים לשימוש בגוף:
                </p>
                <div className="flex flex-wrap gap-2">
                  {columns.map(c => <VariableChip key={c} label={c} onClick={() => insertVar(c, 'body')} />)}
                </div>
              </div>
            )}
          </Card>

          {/* ── 4. Attachment ── */}
          <Card>
            <SectionTitle icon={<Paperclip className="w-4 h-4" />} title="קובץ מצורף (אופציונלי)" />
            <DropZone onFile={handleAttachment} accept="*"
              label="גרור קובץ לכאן – PDF, Word, תמונה וכו'"
              sublabel="מקסימום 15MB"
              file={attachment ? `${attachment.name} (${(attachment.size / 1024).toFixed(0)}KB)` : null}
              onClear={() => setAttachment(null)} />
          </Card>

          {/* ── Delay Selector (Gmail only) ── */}
          {creds.provider === 'gmail' && (
            <div className={t.delayPanel}>
              <span className={`text-sm shrink-0 ${t.label}`}>השהייה בין מיילים:</span>
              <div className="flex gap-2">
                {[1, 2, 3, 5, 10].map(s => (
                  <button key={s} onClick={() => setDelaySec(s)} disabled={sending}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      delaySec === s ? t.delayActive : t.delayInactive
                    } disabled:opacity-40`}>
                    {s}ש׳
                  </button>
                ))}
              </div>
              <span className={`text-xs mr-auto ${t.faint}`}>
                {contacts.length > 0 && `זמן משוער: ~${Math.ceil(contacts.length * delaySec / 60)} דקות`}
              </span>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={() => setShowPreview(true)} disabled={!subject && !body}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm ${t.previewBtn}`}>
              <Eye className="w-4 h-4" /> תצוגה מקדימה
            </button>

            <button onClick={handleSend} disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30 text-sm">
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />שולח...</>
              ) : (
                <><Send className="w-4 h-4" />{contacts.length > 0 ? `שלח ל-${contacts.length.toLocaleString()} נמענים` : 'שלח'}</>
              )}
            </button>

            {sending && (
              <button onClick={() => { stopRef.current = true }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all text-sm ${t.stopBtn}`}>
                <X className="w-4 h-4" /> עצור
              </button>
            )}

            {done && (
              <button onClick={reset}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all text-sm ${t.resetBtn}`}>
                <RotateCcw className="w-4 h-4" /> איפוס
              </button>
            )}
          </div>

          {/* ── Progress ── */}
          {(sending || done) && (
            <Card className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${t.heading}`}>
                    {totalProcessed.toLocaleString()} / {contacts.length.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-green-500 text-sm">
                    <CheckCircle className="w-4 h-4" /> {totalSent.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-red-500 text-sm">
                    <XCircle className="w-4 h-4" /> {totalFailed.toLocaleString()}
                  </span>
                </div>
                {done && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> הושלם
                  </span>
                )}
              </div>

              {pauseUntil && (
                <div className={`mb-4 flex items-center gap-3 p-3 rounded-xl animate-fade-in ${t.pauseBar}`}>
                  <div className="w-4 h-4 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin shrink-0" />
                  <div>
                    <p className={`text-sm font-medium ${t.pauseText}`}>⏸ הושג מגבלת 500/יום – ממתין 24 שעות</p>
                    <p className={`text-xs mt-0.5 ${t.pauseSub}`}>
                      {(() => {
                        void nowTick
                        const rem = Math.max(0, pauseUntil - Date.now())
                        const h = Math.floor(rem / 3600000)
                        const m = Math.floor((rem % 3600000) / 60000)
                        const s = Math.floor((rem % 60000) / 1000)
                        return `נשאר: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                      })()}
                    </p>
                  </div>
                </div>
              )}

              <div className={`h-2 rounded-full mb-4 overflow-hidden ${t.progressBg}`}>
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} />
              </div>

              <div className={`rounded-xl p-4 max-h-56 overflow-y-auto font-mono text-xs space-y-1 ${t.logsBg}`}>
                {logs.map((l, i) => (
                  <div key={i} className={`flex items-start gap-2 ${
                    l.type === 'error' ? t.logsError : l.type === 'success' ? t.logsSuccess : t.logsInfo
                  }`}>
                    <span className={`shrink-0 ${t.logsTime}`}>{l.time}</span>
                    <span>{l.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </Card>
          )}

          <p className={`text-center text-xs mt-4 mb-8 ${t.footer}`}>
            Email Sender Pro • הפרטים שלך אינם נשמרים בשום מקום
          </p>
        </div>

        {/* ── Preview Modal ── */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className={`rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col ${t.modal}`}>
              <div className={`flex items-center justify-between p-5 ${t.modalDivider}`}>
                <h3 className={`font-semibold flex items-center gap-2 ${t.heading}`}>
                  <Eye className="w-4 h-4 text-blue-400" />
                  תצוגה מקדימה
                  {contacts.length > 0 && <span className={`text-xs ${t.muted}`}>(נמען ראשון)</span>}
                </h3>
                <button onClick={() => setShowPreview(false)}
                  className={`transition-colors hover:text-red-400 ${t.muted}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                <div className={`mb-3 pb-3 ${t.modalDivider}`}>
                  <span className={`text-xs ${t.muted}`}>נושא:</span>
                  <p className={`mt-1 ${t.heading}`}>{previewSubject || '(ריק)'}</p>
                </div>
                <div>
                  <span className={`text-xs ${t.muted}`}>גוף:</span>
                  <div className={`mt-2 text-sm leading-relaxed rounded-xl p-4 ${t.modalPreview}`}
                    dir="rtl"
                    dangerouslySetInnerHTML={{ __html: previewBody || '(ריק)' }} />
                </div>
                {attachment && (
                  <div className={`mt-3 pt-3 flex items-center gap-2 text-xs ${t.modalAttach}`}>
                    <Paperclip className="w-3 h-3" /> {attachment.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  )
}
