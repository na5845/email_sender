'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Mail, Lock, Upload, Users, FileText, Send, Eye, RotateCcw,
  CheckCircle, XCircle, AlertCircle, ChevronDown, Paperclip,
  Zap, Copy, X, Info, Globe
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Contact {
  [key: string]: string
}

interface Credentials {
  email: string
  password: string
  provider: 'gmail' | 'outlook' | 'yahoo' | 'custom'
  smtpHost: string
  smtpPort: string
}

interface Attachment {
  name: string
  data: string // base64
  type: string
  size: number
}

interface LogEntry {
  type: 'success' | 'error' | 'info'
  message: string
  time: string
}

interface BatchResult {
  sent: number
  failed: number
  errors: { email: string; error: string }[]
}

// ── Helper Components ───────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-6 mb-6 animate-slide-up ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 bg-purple-600/30 rounded-lg text-purple-400">{icon}</div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {badge && (
        <span className="mr-auto text-xs bg-purple-600/40 text-purple-300 px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
    </div>
  )
}

function Input({
  label, value, onChange, type = 'text', placeholder, className = '', dir = 'ltr'
}: {
  label?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string; dir?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 transition-all hover:border-white/20 focus:border-purple-500"
      />
    </div>
  )
}

function VariableChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs rounded-full transition-all cursor-pointer"
    >
      <span>{'{{' + label + '}}'}</span>
      <Copy className="w-3 h-3" />
    </button>
  )
}

function DropZone({
  onFile, accept, label, sublabel, file, onClear
}: {
  onFile: (f: File) => void
  accept: string
  label: string
  sublabel?: string
  file?: string | null
  onClear?: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-xl p-6 text-center transition-all
        ${dragging ? 'drag-over' : 'border-white/10 hover:border-purple-500/50'}
        ${file ? 'border-green-500/40 bg-green-500/5' : 'cursor-pointer'}
      `}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      {file ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{file}</span>
          </div>
          {onClear && (
            <button onClick={e => { e.stopPropagation(); onClear() }} className="text-gray-500 hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">{label}</p>
          {sublabel && <p className="text-gray-600 text-xs mt-1">{sublabel}</p>}
        </div>
      )}
    </div>
  )
}

// ── Personalize helper (also used client-side for preview) ──────────────────

function personalize(template: string, contact: Contact): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => contact[key] ?? `{{${key}}}`)
}

// ── Main App ────────────────────────────────────────────────────────────────

export default function EmailSenderPro() {
  // Credentials
  const [creds, setCreds] = useState<Credentials>({
    email: '', password: '', provider: 'gmail', smtpHost: '', smtpPort: '587'
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

  // Progress
  const [sending, setSending] = useState(false)
  const [totalSent, setTotalSent] = useState(0)
  const [totalFailed, setTotalFailed] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [done, setDone] = useState(false)

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ── Excel parse ───────────────────────────────────────────────────────────

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
      setColumns(cols)
      setContacts(rows)
      const autoEmail = cols.find(c =>
        c.toLowerCase().includes('email') ||
        c.toLowerCase().includes('mail') ||
        c.includes('אימייל') || c.includes('מייל')
      )
      if (autoEmail) setEmailCol(autoEmail)
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Attachment parse ──────────────────────────────────────────────────────

  const handleAttachment = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      alert('קובץ גדול מדי – מקסימום 15MB')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer)
      const b64 = btoa(arr.reduce((d, b) => d + String.fromCharCode(b), ''))
      setAttachment({ name: file.name, data: b64, type: file.type, size: file.size })
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Insert variable ───────────────────────────────────────────────────────

  const insertVar = (col: string, target: 'subject' | 'body') => {
    const token = `{{${col}}}`
    if (target === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const s = el.selectionStart ?? subject.length
      const e = el.selectionEnd ?? subject.length
      const next = subject.slice(0, s) + token + subject.slice(e)
      setSubject(next)
      setTimeout(() => el.setSelectionRange(s + token.length, s + token.length), 0)
    } else if (target === 'body' && bodyRef.current) {
      const el = bodyRef.current
      const s = el.selectionStart ?? body.length
      const e = el.selectionEnd ?? body.length
      const next = body.slice(0, s) + token + body.slice(e)
      setBody(next)
      setTimeout(() => el.setSelectionRange(s + token.length, s + token.length), 0)
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  const previewContact = contacts[0] ?? {}
  const previewSubject = personalize(subject, previewContact)
  const previewBody = isHtml
    ? personalize(body, previewContact)
    : personalize(body, previewContact).replace(/\n/g, '<br/>')

  // ── Send ──────────────────────────────────────────────────────────────────

  const addLog = (type: LogEntry['type'], message: string) =>
    setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString('he-IL') }])

  const handleSend = async () => {
    if (!creds.email || !creds.password) return alert('נא להזין כתובת מייל וסיסמה')
    if (!emailCol || !contacts.length) return alert('נא להעלות קובץ אקסל ולבחור עמודת אימייל')
    if (!subject.trim()) return alert('נא להזין נושא למייל')
    if (!body.trim()) return alert('נא להזין גוף המייל')

    setSending(true)
    setDone(false)
    setTotalSent(0)
    setTotalFailed(0)
    setTotalProcessed(0)
    setLogs([])

    const BATCH = 50
    let sent = 0, failed = 0

    addLog('info', `מתחיל שליחה ל-${contacts.length.toLocaleString()} נמענים...`)

    for (let i = 0; i < contacts.length; i += BATCH) {
      const batch = contacts.slice(i, i + BATCH)
      const batchNum = Math.floor(i / BATCH) + 1

      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentials: creds,
            contacts: batch,
            emailColumn: emailCol,
            subject,
            body,
            isHtml,
            attachment,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'שגיאת שרת' }))
          addLog('error', `אצווה ${batchNum}: ${err.error}`)
          failed += batch.length
        } else {
          const result: BatchResult = await res.json()
          sent += result.sent
          failed += result.failed
          addLog(
            result.failed > 0 ? 'error' : 'success',
            `אצווה ${batchNum} (${i + 1}–${Math.min(i + BATCH, contacts.length)}): ✓ ${result.sent}  ✗ ${result.failed}`
          )
          result.errors.slice(0, 5).forEach(e =>
            addLog('error', `  ↳ ${e.email}: ${e.error}`)
          )
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'שגיאת רשת'
        addLog('error', `אצווה ${batchNum}: ${msg}`)
        failed += batch.length
      }

      setTotalSent(sent)
      setTotalFailed(failed)
      setTotalProcessed(Math.min(i + BATCH, contacts.length))
    }

    addLog('info', `✅ סיום! נשלחו ${sent.toLocaleString()} • נכשלו ${failed.toLocaleString()}`)
    setSending(false)
    setDone(true)
  }

  const reset = () => {
    setContacts([]); setColumns([]); setEmailCol(''); setFileName('')
    setSubject(''); setBody(''); setAttachment(null)
    setTotalSent(0); setTotalFailed(0); setTotalProcessed(0)
    setLogs([]); setDone(false)
  }

  const progress = contacts.length > 0 ? (totalProcessed / contacts.length) * 100 : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4 md:p-8" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 rounded-2xl mb-4 border border-purple-500/20">
            <Mail className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Email Sender Pro
          </h1>
          <p className="text-gray-500 text-sm">שלח מיילים מותאמים אישית לאלפי נמענים</p>
        </div>

        {/* ── 1. Credentials ── */}
        <Card>
          <SectionTitle icon={<Lock className="w-4 h-4" />} title="פרטי שליחה" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="כתובת מייל שולח"
              value={creds.email}
              onChange={v => setCreds(p => ({ ...p, email: v }))}
              placeholder="you@gmail.com"
              type="email"
            />
            <Input
              label="סיסמת אפליקציה (App Password)"
              value={creds.password}
              onChange={v => setCreds(p => ({ ...p, password: v }))}
              placeholder="xxxx xxxx xxxx xxxx"
              type="password"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5">ספק מייל</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['gmail', 'outlook', 'yahoo', 'custom'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setCreds(prev => ({ ...prev, provider: p }))}
                  className={`py-2 px-3 rounded-xl text-sm border transition-all ${
                    creds.provider === p
                      ? 'bg-purple-600/40 border-purple-500 text-purple-200'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {p === 'gmail' ? 'Gmail' : p === 'outlook' ? 'Outlook' : p === 'yahoo' ? 'Yahoo' : 'SMTP מותאם'}
                </button>
              ))}
            </div>
          </div>

          {creds.provider === 'custom' && (
            <div className="grid grid-cols-3 gap-3 mt-3 animate-fade-in">
              <Input
                label="שרת SMTP"
                value={creds.smtpHost}
                onChange={v => setCreds(p => ({ ...p, smtpHost: v }))}
                placeholder="smtp.example.com"
                className="col-span-2"
              />
              <Input
                label="פורט"
                value={creds.smtpPort}
                onChange={v => setCreds(p => ({ ...p, smtpPort: v }))}
                placeholder="587"
              />
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80">
              Gmail: הפעל 2FA ← הגדרות חשבון ← אבטחה ← סיסמאות אפליקציה. מגבלת Gmail: 500/יום (Workspace: 2,000/יום)
            </p>
          </div>
        </Card>

        {/* ── 2. Recipients ── */}
        <Card>
          <SectionTitle
            icon={<Users className="w-4 h-4" />}
            title="רשימת נמענים"
            badge={contacts.length ? `${contacts.length.toLocaleString()} אנשי קשר` : undefined}
          />

          <DropZone
            onFile={handleExcel}
            accept=".xlsx,.xls,.csv"
            label="גרור קובץ Excel / CSV לכאן או לחץ לבחירה"
            sublabel=".xlsx, .xls, .csv – ללא הגבלת שורות"
            file={fileName}
            onClear={() => { setFileName(''); setContacts([]); setColumns([]); setEmailCol('') }}
          />

          {columns.length > 0 && (
            <div className="mt-4 animate-fade-in">
              <label className="block text-sm text-gray-400 mb-1.5">עמודת אימייל</label>
              <div className="relative">
                <select
                  value={emailCol}
                  onChange={e => setEmailCol(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none transition-all hover:border-white/20 focus:border-purple-500"
                >
                  <option value="">-- בחר עמודה --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Variable chips */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">עמודות זמינות כמשתנים – לחץ להוספה לנושא / גוף:</p>
                <div className="flex flex-wrap gap-2">
                  {columns.map(c => (
                    <div key={c} className="flex gap-1">
                      <button
                        onClick={() => insertVar(c, 'subject')}
                        title="הוסף לנושא"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-xs rounded-full transition-all"
                      >
                        {'{{' + c + '}} נושא'}
                      </button>
                      <button
                        onClick={() => insertVar(c, 'body')}
                        title="הוסף לגוף"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs rounded-full transition-all"
                      >
                        {'{{' + c + '}} גוף'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="bg-white/5">
                      {columns.map(c => (
                        <th key={c} className="px-3 py-2 text-gray-400 font-medium whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 4).map((row, i) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        {columns.map(c => (
                          <td key={c} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[150px] truncate">{row[c]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.length > 4 && (
                  <p className="text-center text-xs text-gray-600 py-2">...ועוד {(contacts.length - 4).toLocaleString()} שורות</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ── 3. Compose ── */}
        <Card>
          <SectionTitle icon={<FileText className="w-4 h-4" />} title="כתיבת המייל" />

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5">נושא</label>
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="לדוגמה: שלום {{שם}}, עדכון חשוב עבורך"
              dir="rtl"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 transition-all hover:border-white/20 focus:border-purple-500"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-gray-400">גוף המייל</label>
              <button
                onClick={() => setIsHtml(p => !p)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  isHtml
                    ? 'bg-green-600/30 border-green-500/50 text-green-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                {isHtml ? '‹/› HTML מופעל' : '‹/› HTML'}
              </button>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={isHtml
                ? '<p>שלום <strong>{{שם}}</strong>,</p>\n<p>תוכן המייל כאן...</p>'
                : 'שלום {{שם}},\n\nתוכן המייל כאן...\n\nבברכה,\n{{שם שולח}}'}
              dir="rtl"
              rows={10}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 resize-y transition-all hover:border-white/20 focus:border-purple-500 font-mono text-sm"
            />
          </div>

          {columns.length > 0 && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/5">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3" /> משתנים זמינים לשימוש בגוף:
              </p>
              <div className="flex flex-wrap gap-2">
                {columns.map(c => (
                  <VariableChip key={c} label={c} onClick={() => insertVar(c, 'body')} />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── 4. Attachment ── */}
        <Card>
          <SectionTitle icon={<Paperclip className="w-4 h-4" />} title="קובץ מצורף (אופציונלי)" />
          <DropZone
            onFile={handleAttachment}
            accept="*"
            label="גרור קובץ לכאן – PDF, Word, תמונה וכו'"
            sublabel="מקסימום 15MB"
            file={attachment ? `${attachment.name} (${(attachment.size / 1024).toFixed(0)}KB)` : null}
            onClear={() => setAttachment(null)}
          />
        </Card>

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowPreview(true)}
            disabled={!subject && !body}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <Eye className="w-4 h-4" /> תצוגה מקדימה
          </button>

          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 text-sm"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                שולח...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {contacts.length > 0 ? `שלח ל-${contacts.length.toLocaleString()} נמענים` : 'שלח'}
              </>
            )}
          </button>

          {done && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" /> איפוס
            </button>
          )}
        </div>

        {/* ── Progress ── */}
        {(sending || done) && (
          <Card className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white">
                  {totalProcessed.toLocaleString()} / {contacts.length.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" /> {totalSent.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> {totalFailed.toLocaleString()}
                </span>
              </div>
              {done && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> הושלם
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Logs */}
            <div className="bg-black/30 rounded-xl p-4 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((l, i) => (
                <div key={i} className={`flex items-start gap-2 ${
                  l.type === 'error' ? 'text-red-400' :
                  l.type === 'success' ? 'text-green-400' : 'text-gray-400'
                }`}>
                  <span className="text-gray-600 shrink-0">{l.time}</span>
                  <span>{l.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-4 mb-8">
          Email Sender Pro • הפרטים שלך אינם נשמרים בשום מקום
        </p>
      </div>

      {/* ── Preview Modal ── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                תצוגה מקדימה
                {contacts.length > 0 && <span className="text-xs text-gray-500">(נמען ראשון)</span>}
              </h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-3 pb-3 border-b border-white/10">
                <span className="text-xs text-gray-500">נושא:</span>
                <p className="text-white mt-1">{previewSubject || '(ריק)'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">גוף:</span>
                <div
                  className="mt-2 text-gray-200 text-sm leading-relaxed bg-white/5 rounded-xl p-4"
                  dir="rtl"
                  dangerouslySetInnerHTML={{ __html: previewBody || '(ריק)' }}
                />
              </div>
              {attachment && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-gray-400 text-xs">
                  <Paperclip className="w-3 h-3" /> {attachment.name}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
