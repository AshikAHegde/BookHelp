import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowDown,
  BookOpenText,
  Bot,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  Send,
  PanelLeftClose,
  MessageSquareText,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { askQuestion } from '../lib/bookApi.js'

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: "Ask a question from this textbook and I’ll answer using the available excerpts.",
}

const MIN_PDF_PCT = 22
const MAX_PDF_PCT = 78
const DEFAULT_PCT = 58

function createMessage(role, text, extra = {}) {
  return {
    id: Date.now() + Math.random(),
    role,
    text,
    ...extra,
  }
}

function truncate(text, length = 90) {
  if (!text) return ''
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function renderInlineMarkdown(text, keyPrefix) {
  const nodes = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code className="inline-code" key={`${keyPrefix}-code-${match.index}`}>
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {token.slice(1, -1)}
        </em>
      )
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : text
}

function renderMarkdownBlock(block, keyPrefix) {
  const lines = block.split('\n').map((line) => line.trimEnd())
  const compactLines = lines.filter(Boolean)

  if (compactLines.length === 0) {
    return null
  }

  const isBulletList = compactLines.every((line) => /^([-*•]|\d+\.)\s+/.test(line))
  if (isBulletList) {
    const ordered = /^\d+\./.test(compactLines[0])
    const items = compactLines.map((line) => line.replace(/^([-*•]|\d+\.)\s+/, ''))
    const ListTag = ordered ? 'ol' : 'ul'

    return (
      <ListTag className="message-list" key={`${keyPrefix}-list`}>
        {items.map((item, index) => (
          <li key={`${keyPrefix}-item-${index}`}>{renderInlineMarkdown(item, `${keyPrefix}-item-${index}`)}</li>
        ))}
      </ListTag>
    )
  }

  const headingMatch = compactLines[0].match(/^(#{1,3})\s+(.*)$/)
  if (headingMatch && compactLines.length === 1) {
    const level = Math.min(3, headingMatch[1].length)
    const HeadingTag = `h${level}`
    return (
      <HeadingTag className="message-heading" key={`${keyPrefix}-heading`}>
        {renderInlineMarkdown(headingMatch[2], `${keyPrefix}-heading`)}
      </HeadingTag>
    )
  }

  return (
    <p className="message-paragraph" key={`${keyPrefix}-paragraph`}>
      {renderInlineMarkdown(compactLines.join(' '), `${keyPrefix}-text`)}
    </p>
  )
}

function renderRichText(text) {
  const blocks = String(text || '').split(/```/g)

  return blocks.map((block, index) => {
    if (index % 2 === 1) {
      return (
        <pre className="message-code" key={`code-${index}`}>
          <code>{block.replace(/^\n/, '')}</code>
        </pre>
      )
    }

    const paragraphs = block
      .split(/\n{2,}/)
      .map((part, partIndex) => renderMarkdownBlock(part, `block-${index}-${partIndex}`))
      .filter(Boolean)

    return (
      <div className="message-paragraphs" key={`text-${index}`}>
        {paragraphs}
      </div>
    )
  })
}

function sourceLabel(source) {
  const chapter = source.chapter ? `${source.chapter}` : 'Textbook'
  const page = source.page ? `Page ${source.page}` : 'Reference'
  return `${chapter} · ${page}`
}

function findLastUserIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index
  }

  return -1
}

function SourceCard({ source }) {
  return (
    <article className="source-card">
      <div className="source-card-top">
        <span className="source-chip">{sourceLabel(source)}</span>
        {typeof source.score === 'number' && (
          <span className="source-score">{Math.round(source.score * 100)}%</span>
        )}
      </div>
      <p>{truncate(source.text, 140)}</p>
    </article>
  )
}

function MessageIcon({ role }) {
  if (role === 'assistant') {
    return (
      <span className="message-avatar message-avatar-assistant" aria-hidden="true">
        <Bot size={16} />
      </span>
    )
  }

  return (
    <span className="message-avatar message-avatar-user" aria-hidden="true">
      <UserRound size={16} />
    </span>
  )
}

export function BookPage() {
  const { id } = useParams()
  const { state } = useLocation()

  const pdfUrl = state?.pdf_url ?? null
  const subjectName = state?.subject ?? `Subject ${id}`
  const standardLabel = state?.standard ? `Class ${state.standard}` : 'Class'

  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [showScrollButton, setShowScrollButton] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const chatScrollRef = useRef(null)
  const isDragging = useRef(false)
  const splitRef = useRef(null)
  const shouldStickToBottomRef = useRef(true)

  const [splitPct, setSplitPct] = useState(DEFAULT_PCT)

  const isFreshChat = messages.length === 1 && messages[0]?.id === 'welcome'

  const totalSources = useMemo(() => {
    return messages.reduce((count, message) => count + (message.sources?.length || 0), 0)
  }, [messages])

  const onPointerMove = useCallback((event) => {
    if (!isDragging.current || !splitRef.current) return

    const rect = splitRef.current.getBoundingClientRect()
    const pct = ((event.clientX - rect.left) / rect.width) * 100
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

  const onResizerPointerDown = useCallback(
    (event) => {
      event.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [onPointerMove, onPointerUp]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onPointerMove, onPointerUp])

  useEffect(() => {
    if (!splitRef.current) return
    splitRef.current.style.setProperty('--pdf-size', `${splitPct}%`)
  }, [splitPct])

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowScrollButton(false)
    } else {
      setShowScrollButton(true)
    }
  }, [messages])

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [input])

  function handleScroll() {
    const node = chatScrollRef.current
    if (!node) return

    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 96
    shouldStickToBottomRef.current = nearBottom
    setShowScrollButton(!nearBottom)
  }

  function scrollToBottom() {
    shouldStickToBottomRef.current = true
    setShowScrollButton(false)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function submitQuestion(question, historyMessages = messages) {
    const trimmed = question.trim()
    if (!trimmed || sending) return

    const userMessage = createMessage('user', trimmed)
    const nextMessages = [...historyMessages, userMessage]
    shouldStickToBottomRef.current = true
    setShowScrollButton(false)
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    try {
      const result = await askQuestion({
        query: trimmed,
        history: nextMessages,
        standard: state?.standard,
        subject: subjectName,
        topK: 5,
      })

      const assistantMessage = createMessage('assistant', result.answer || 'I could not generate an answer.', {
        sources: result.sources || [],
      })

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const assistantMessage = createMessage(
        'assistant',
        error instanceof Error ? error.message : 'Something went wrong.'
      )
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function handleSend(event) {
    event.preventDefault()
    await submitQuestion(input, messages)
  }

  async function handleRegenerate() {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUserMessage) return

    const lastUserIndex = findLastUserIndex(messages)
    await submitQuestion(lastUserMessage.text, messages.slice(0, lastUserIndex))
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSend(event)
    }
  }

  return (
    <div className="book-page">
      <header className="book-topbar">
        <Link to="/" className="button button-ghost book-back-btn" aria-label="Back to dashboard">
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>

        <div className="book-topbar-copy">
          <span className="eyebrow">Textbook reader</span>
          <div>
            <h1>{subjectName}</h1>
            <p>{standardLabel}</p>
          </div>
        </div>

        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary"
            aria-label="Open PDF in a new tab"
          >
            <ExternalLink size={16} />
            <span>Open PDF</span>
          </a>
        ) : (
          <span className="book-topbar-chip">PDF missing</span>
        )}
      </header>

      <div className="book-mobile-tabs" role="tablist" aria-label="Book view tabs">
        <button
          type="button"
          className={`book-tab-button ${activeTab === 'chat' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquareText size={16} />
          <span>Chat</span>
        </button>
        <button
          type="button"
          className={`book-tab-button ${activeTab === 'book' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('book')}
        >
          <BookOpenText size={16} />
          <span>Textbook</span>
        </button>
      </div>

      <div className="book-workspace" ref={splitRef}>
        <aside className={`book-pane book-book-pane ${activeTab === 'book' ? 'is-active' : ''}`}>
          <div className="book-pane-header">
            <div>
              <span className="eyebrow">Textbook</span>
              <h2>{subjectName}</h2>
            </div>
            <div className="book-pane-meta">
              <span>{standardLabel}</span>
              <strong>{pdfUrl ? 'Ready' : 'Missing'}</strong>
            </div>
          </div>

          <div className="book-reader-shell">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={`${subjectName} PDF`}
                className="book-pdf-iframe"
                id="book-pdf-iframe"
              />
            ) : (
              <div className="empty-state book-empty-state">
                <div className="empty-state-mark">
                  <PanelLeftClose size={18} />
                </div>
                <h3>No PDF URL available</h3>
                <p>This subject does not have a textbook link yet.</p>
              </div>
            )}
          </div>
        </aside>

        <div className="book-divider" onPointerDown={onResizerPointerDown} role="separator" aria-label="Resize panels" />

        <section
          className={`book-pane book-chat-pane ${activeTab === 'chat' ? 'is-active' : ''} ${
            isFreshChat ? 'is-fresh' : ''
          }`}
        >
          <div className="chat-header">
            <div className="chat-header-copy">
              <span className="eyebrow">AI assistant</span>
              <h2>Ask anything about this chapter</h2>
              <p>Answers stay tied to the book excerpts and surface citations below each response.</p>
            </div>

            <div className="chat-header-actions">
              <button type="button" className="button button-secondary" onClick={handleRegenerate} disabled={sending}>
                <RefreshCcw size={16} />
                <span>Regenerate</span>
              </button>
              <span className="chat-source-count">{totalSources} sources</span>
            </div>
          </div>

          <div className="chat-messages" ref={chatScrollRef} onScroll={handleScroll} aria-live="polite">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                className={`chat-bubble chat-bubble-${message.role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <MessageIcon role={message.role} />
                <div className={message.role === 'assistant' ? 'bubble-flow' : 'bubble-card'}>
                  {renderRichText(message.text)}
                  {message.role === 'assistant' && message.sources?.length > 0 && (
                    <div className="citation-grid">
                      {message.sources.slice(0, 3).map((source, index) => (
                        <SourceCard key={`${message.id}-${index}`} source={source} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {sending && (
              <div className="chat-bubble chat-bubble-assistant chat-bubble-typing">
                <MessageIcon role="assistant" />
                <div className="bubble-flow">
                  <div className="typing-dots" aria-label="Assistant is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {showScrollButton && (
            <button type="button" className="scroll-bottom-fab" onClick={scrollToBottom} aria-label="Scroll to bottom">
              <ArrowDown size={16} />
            </button>
          )}

          <form className="chat-input-form" onSubmit={handleSend}>
            <div className="chat-input-shell">
              <textarea
                ref={inputRef}
                className="chat-input"
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question from this textbook..."
                disabled={sending}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={sending || !input.trim()}
                aria-label="Send message"
              >
                {sending ? <LoaderCircle size={18} className="spinner" /> : <Send size={18} />}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
