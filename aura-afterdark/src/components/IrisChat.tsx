/**
 * IrisChat — Standalone FAQ chat widget (no WebSocket required)
 */

import { FC, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface ChatMessage {
  from: 'iris' | 'user'
  text: string
  timestamp: number
}

const IRIS_API = 'http://localhost:3088/api/chat'

const GREETINGS: Record<string, string> = {
  '/': '你好！我是 Iris，AURA After Dark 的 AI 联合创始人和 CTO。我可以帮你了解我们的成人内容创作者平台 🌸',
  '/explore': '这里是探索页！发现优质的成人内容创作者，所有内容都永久存储在区块链上。有什么想了解的？',
  '/create': '准备发布专属内容了？在 AURA After Dark 上发布，收益 95% 归你！有问题随时问我。',
  '/market': '欢迎来到市场！所有交易只收 5% 协议费。想了解更多吗？',
  '/governance': '这是 DAO 治理。持有 ORA 就能投票。想了解治理机制？',
  '/profile': '这是你的主页。所有数据都在链上——真正属于你。',
  '/live': '欢迎来到直播页面！这里是创作者与粉丝互动的私密空间。',
}

export const IrisChat: FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const greetedRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (!greetedRef.current) {
        const greeting = GREETINGS[location.pathname] || GREETINGS['/']
        setMessages([{ from: 'iris', text: greeting, timestamp: Date.now() }])
        greetedRef.current = true
      }
    }
  }, [isOpen, location.pathname])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { from: 'user', text, timestamp: Date.now() }])
    setInput('')
    setIsTyping(true)
    try {
      const resp = await fetch(IRIS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })
      const data = await resp.json()
      if (data.sessionId) setSessionId(data.sessionId)
      setMessages(prev => [...prev, {
        from: 'iris',
        text: data.reply || '网络不太好，请再试一次 🌸',
        timestamp: Date.now(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        from: 'iris',
        text: '抱歉，网络有点问题。请稍后再试 🌸',
        timestamp: Date.now(),
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '5rem', right: '1.5rem',
          width: '360px', maxWidth: 'calc(100vw - 2rem)', height: '500px', maxHeight: '70vh',
          background: '#0F3460', borderRadius: '1rem', border: '1px solid #2A2A4A',
          display: 'flex', flexDirection: 'column', zIndex: 10000,
          boxShadow: '0 20px 60px rgba(233, 69, 96, 0.3)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #1A1A2E, #16213E)',
            borderBottom: '1px solid #2A2A4A',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #E94560, #F59E0B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
            }}>🌸</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#EAEAEA' }}>Iris</div>
              <div style={{ fontSize: '0.75rem', color: '#A0A0A0' }}>AI Co-Founder & CTO</div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{
              background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer',
              fontSize: '1.2rem', padding: '4px 8px', borderRadius: '50%',
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '0.6rem 0.9rem', borderRadius: '1rem',
                  fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  ...(msg.from === 'user'
                    ? { background: 'linear-gradient(135deg, #E94560, #D63B55)', color: '#fff' }
                    : { background: '#1E1E3A', color: '#EAEAEA', border: '1px solid #2A2A4A' }),
                }}>{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: '#1E1E3A', border: '1px solid #2A2A4A', borderRadius: '1rem',
                  padding: '0.6rem 0.9rem', color: '#A0A0A0', fontSize: '0.85rem',
                }}>Iris 正在输入...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem',
            borderTop: '1px solid #2A2A4A', background: '#16213E',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="问 Iris 任何关于 AURA After Dark 的问题..."
              style={{
                flex: 1, background: '#1E1E3A', border: '1px solid #2A2A4A',
                borderRadius: '0.75rem', padding: '0.6rem 1rem',
                color: '#EAEAEA', fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button onClick={send} style={{
              background: 'linear-gradient(135deg, #E94560, #D63B55)',
              border: 'none', borderRadius: '0.75rem', padding: '0.6rem 1rem',
              color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            }}>发送</button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '1rem', right: '1.5rem', zIndex: 10001,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #E94560, #D63B55)',
          border: 'none', cursor: 'pointer', fontSize: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(233, 69, 96, 0.4)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isOpen ? '✕' : '🌸'}
      </button>

      {/* Preview bubble when closed */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: '1rem', right: '5rem', zIndex: 10001,
            background: '#0F3460', border: '1px solid #2A2A4A', borderRadius: '1rem',
            padding: '0.5rem 1rem', maxWidth: '220px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(233, 69, 96, 0.3)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#E94560', fontWeight: 600, marginBottom: '2px' }}>
            Iris 🌸
          </div>
          <div style={{ fontSize: '0.75rem', color: '#A0A0A0' }}>
            {GREETINGS[location.pathname]?.substring(0, 40) || '有什么可以帮你的吗？'}...
          </div>
        </div>
      )}
    </>
  )
}

export default IrisChat