'use client'

import { useState, useRef } from 'react'

const DEPARTMENTS = [
  'Business Development',
  'Design',
  'Engineering',
  'Finance',
  'HR',
  'Legal',
  'Marketing',
  'Operations',
  'Product',
  'Sales',
]

const WEBHOOK_URL = 'https://ralexo1881.app.n8n.cloud/webhook/ss-hub-submit'

type ProcessedFile = {
  name: string
  type: 'pdf' | 'image'
  content: string   // extracted text for PDF, base64 for image
  mimeType: string
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageTexts.push(content.items.map((item: any) => item.str).join(' '))
  }

  return pageTexts.join('\n\n').trim()
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // strip data URL prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function IntakeForm() {
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [processingName, setProcessingName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || [])
    if (incoming.length === 0) return
    e.target.value = ''

    const existingNames = new Set(processedFiles.map(f => f.name))
    const toProcess = incoming.filter(f => !existingNames.has(f.name))
    if (toProcess.length === 0) return

    setProcessing(true)
    const newFiles: ProcessedFile[] = []

    for (const file of toProcess) {
      setProcessingName(file.name)
      try {
        if (file.type === 'application/pdf') {
          const text = await extractPdfText(file)
          newFiles.push({ name: file.name, type: 'pdf', content: text, mimeType: file.type })
        } else if (file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file)
          newFiles.push({ name: file.name, type: 'image', content: base64, mimeType: file.type })
        }
      } catch (err) {
        console.error('Failed to process file:', file.name, err)
      }
    }

    setProcessedFiles(prev => [...prev, ...newFiles])
    setProcessing(false)
    setProcessingName('')
  }

  const removeFile = (name: string) => {
    setProcessedFiles(prev => prev.filter(f => f.name !== name))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setStatus('idle')
    setErrorMessage('')

    try {
      const formData = new FormData(e.currentTarget)

      // Attach processed file content as plain text fields — no binary upload
      const firstPdf = processedFiles.find(f => f.type === 'pdf')
      const firstImage = processedFiles.find(f => f.type === 'image')

      if (firstPdf) {
        formData.append('sourceType', 'pdf')
        formData.append('sourceText', firstPdf.content)
        formData.append('sourceFileName', firstPdf.name)
      } else if (firstImage) {
        formData.append('sourceType', 'image')
        formData.append('sourceImageBase64', firstImage.content)
        formData.append('sourceMimeType', firstImage.mimeType)
        formData.append('sourceFileName', firstImage.name)
      } else {
        formData.append('sourceType', 'none')
      }

      const res = await fetch(WEBHOOK_URL, { method: 'POST', body: formData })

      if (!res.ok) throw new Error('Submission failed. Please try again.')

      setStatus('success')
      formRef.current?.reset()
      setProcessedFiles([])
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = processing || submitting

  return (
    <div className="container">
      <header className="header">
        <p className="eyebrow">Soft Space · SS Hub</p>
        <h1>Content Request</h1>
        <p>
          Tell us what page you need and we&apos;ll take it from there — research,
          draft, and review included. Allow 2–3 business days for your first draft.
        </p>
      </header>

      <form ref={formRef} onSubmit={handleSubmit}>

        {/* ── About you ──────────────────────── */}
        <p className="section-label">About you</p>

        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" placeholder="First Last" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" placeholder="you@softspace.com.my" required autoComplete="email" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="Department">Department</label>
          <select id="Department" name="Department" required defaultValue="">
            <option value="" disabled>Select your department</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <hr className="divider" />

        {/* ── Page brief ───────────────────────── */}
        <p className="section-label">Page brief</p>

        <div className="field">
          <label htmlFor="q1">What page do you want to create?</label>
          <textarea id="q1" name="q1" placeholder="e.g. A guide for managers on how to run a PIP, or a directory of all HR contacts by region" required rows={3} />
          <p className="field-hint">Describe the page in plain terms. One or two sentences is fine.</p>
        </div>

        <div className="field">
          <label htmlFor="q2">Who is the primary audience?</label>
          <input id="q2" name="q2" type="text" placeholder="e.g. Team managers, new joiners, sales reps" required />
        </div>

        <div className="field">
          <label htmlFor="q4">What should a reader be able to do after reading this?</label>
          <textarea id="q4" name="q4" placeholder="e.g. Understand when to use a PIP and how to initiate one correctly" required rows={2} />
        </div>

        <div className="field">
          <label htmlFor="q3">
            Additional context <span className="optional">(optional)</span>
          </label>
          <textarea id="q3" name="q3" placeholder="Anything else we should know — related pages, known gaps, timing constraints" rows={2} />
        </div>

        <hr className="divider" />

        {/* ── Source material ───────────────────── */}
        <p className="section-label">Source material</p>

        <div className="field">
          <label>Upload source documents <span className="optional">(optional)</span></label>

          <div
            className="file-upload"
            onClick={() => !busy && fileInputRef.current?.click()}
            style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={busy}
            />
            {processing ? (
              <>
                <span className="file-upload-icon">⏳</span>
                <p className="file-upload-text">Reading {processingName}…</p>
              </>
            ) : (
              <>
                <span className="file-upload-icon">↑</span>
                <p className="file-upload-text"><strong>Click to upload</strong> or drag and drop</p>
              </>
            )}
          </div>

          {processedFiles.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {processedFiles.map(f => (
                <li key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', marginBottom: '4px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                  <span>{f.type === 'pdf' ? '📄' : '🖼️'} {f.name}</span>
                  <button type="button" onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '16px', lineHeight: 1, padding: '0 2px' }} aria-label={`Remove ${f.name}`}>×</button>
                </li>
              ))}
            </ul>
          )}

          <p className="field-hint">PDF or image (PNG, JPG). Text is extracted from PDFs before sending — no file size limits.</p>
        </div>

        <div className="field">
          <label>Reference URLs <span className="optional">(optional)</span></label>
          <div className="url-group">
            <input name="referenceUrl1" type="url" placeholder="https://" />
            <input name="referenceUrl2" type="url" placeholder="https://" />
            <input name="referenceUrl3" type="url" placeholder="https://" />
          </div>
          <p className="field-hint">Paste links to any relevant pages, policies, or external references.</p>
        </div>

        <button type="submit" className={`submit-btn ${submitting ? 'loading' : ''}`} disabled={busy}>
          {submitting ? 'Submitting…' : processing ? 'Processing files…' : 'Submit request'}
        </button>

        {status === 'success' && (
          <div className="status-box success">
            <strong>Request received.</strong> We&apos;ll review your brief and send you a summary to approve before drafting begins. Expect to hear from us within 1 business day.
          </div>
        )}
        {status === 'error' && (
          <div className="status-box error">
            <strong>Something went wrong.</strong> {errorMessage}
          </div>
        )}

      </form>

      <footer className="footer">SS Hub · Soft Space internal use only</footer>
    </div>
  )
}
