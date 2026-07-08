import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi! I'm your BookHelp tutor 📚 Ask me anything about this textbook — concepts, questions, summaries, or anything you're stuck on.",
}

const MIN_PDF_PCT = 20   // minimum width for PDF pane (%)
const MAX_PDF_PCT = 80   // maximum width for PDF pane (%)
const DEFAULT_PCT = 58   // default split position (%)

export function BookPage() {
  const { id } = useParams()
  const { state } = useLocation()

  const pdfUrl = state?.pdf_url ?? null
  const subjectName = state?.subject ?? `Subject ${id}`

  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // ── Resizer state ──────────────────────────────────────────────────────────
  const [splitPct, setSplitPct] = useState(DEFAULT_PCT)
  const isDragging = useRef(false)
  const splitRef = useRef(null)

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current || !splitRef.current) return
    const rect = splitRef.current.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setSplitPct(Math.min(MAX_PDF_PCT, Math.max(MIN_PDF_PCT, pct)))
  }, [])

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove])

  const onResizerPointerDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [onPointerMove, onPointerUp])

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onPointerMove, onPointerUp])
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleInputChange(e) {
    setInput(e.target.value)
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const userMsg = { id: Date.now(), role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    // --- Placeholder: replace this timeout with your real AI API call ---
    setTimeout(() => {
      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: `You asked: "${text}"\n\nAI tutor integration coming soon. This is where the answer will appear.`,
      }
      setMessages((prev) => [...prev, botMsg])
      setSending(false)
      inputRef.current?.focus()
    }, 900)
    // --- end placeholder ---
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend(e)
    }
  }

  return (
    <div className="book-page">
      {/* ── Header bar ── */}
      <div className="book-topbar">
        <Link to="/" className="book-back-btn" id="book-back-btn">
          ← Dashboard
        </Link>
        <div className="book-topbar-title">
          <span className="book-subject-label">{subjectName}</span>
          {state?.standard && (
            <span className="book-standard-badge">Class {state.standard}</span>
          )}
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="book-open-tab"
            id="open-pdf-new-tab"
          >
            Open in new tab ↗
          </a>
        )}
      </div>

      {/* ── Split pane ── */}
      <div
        className="book-split"
        ref={splitRef}
        style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
      >
        {/* LEFT — PDF viewer */}
        <div
          className="book-pdf-pane"
          style={{ width: `${splitPct}%`, flexShrink: 0 }}
        >
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={`${subjectName} PDF`}
              className="book-pdf-iframe"
              id="book-pdf-iframe"
            />
          ) : (
            <div className="book-pdf-missing">
              <span>📄</span>
              <p>No PDF URL available for this subject.</p>
            </div>
          )}
        </div>

        {/* ── Drag handle ── */}
        <div
          className="book-resizer"
          id="book-resizer"
          onPointerDown={onResizerPointerDown}
          role="separator"
          aria-label="Drag to resize panels"
          aria-orientation="vertical"
        >
          <div className="book-resizer-grip">
            <span /><span /><span />
          </div>
        </div>

        {/* RIGHT — Chat */}
        <div className="book-chat-pane" style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header">
            <span className="chat-avatar">🤖</span>
            <div>
              <p className="chat-title">BookHelp Tutor</p>
              <p className="chat-subtitle">Ask anything about {subjectName}</p>
            </div>
          </div>

          <div className="chat-messages" id="chat-messages" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble chat-bubble-${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <span className="bubble-avatar">📚</span>
                )}
                <div className="bubble-text">
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {sending && (
              <div className="chat-bubble chat-bubble-assistant chat-bubble-typing">
                <span className="bubble-avatar">📚</span>
                <div className="bubble-text typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSend} id="chat-form">
            <textarea
              ref={inputRef}
              className="chat-input"
              id="chat-input"
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this chapter…"
              disabled={sending}
            />
            <button
              type="submit"
              className="chat-send-btn"
              id="chat-send-btn"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              {sending ? (
                <span className="spinner chat-spinner" />
              ) : (
                '↑'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
