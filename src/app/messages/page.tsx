'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

type Message = {
  id: string
  senderId: string
  content: string
  createdAt: string
  seen: boolean
}

type Conversation = {
  id: string
  participant: { id: string; firstName: string; lastName: string }
  ride?: { destinationText: string; earliestDepartAt: string }
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Messages() {
  const { getToken, userId } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const convos = data.conversations || data
          setConversations(convos)
          if (convos.length > 0) setActiveConvo(convos[0])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchConversations()
  }, [])

  useEffect(() => {
    if (!activeConvo) return
    const fetchMessages = async () => {
      try {
        const token = await getToken()
        const res = await fetch(`/api/conversations/${activeConvo.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchMessages()
  }, [activeConvo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvo || sending) return
    setSending(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/conversations/${activeConvo.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message || data])
        setNewMessage('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900">Messages</h1>
          <p className="text-gray-500 text-sm mt-1">Chat with your riders and drivers</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: '70vh' }}>
          <div className="flex h-full">

            {/* Conversations sidebar */}
            <div className="w-80 border-r border-gray-100 flex flex-col flex-shrink-0">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-black text-gray-900">All Conversations</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-sm font-semibold text-gray-700">No conversations yet</p>
                    <p className="text-xs text-gray-400 mt-1">Book a ride to start chatting</p>
                  </div>
                ) : (
                  conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => setActiveConvo(convo)}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        activeConvo?.id === convo.id
                          ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-sm">
                            {convo.participant.firstName[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {convo.participant.firstName} {convo.participant.lastName[0]}.
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {convo.lastMessageAt && (
                                <span className="text-xs text-gray-400">{formatDate(convo.lastMessageAt)}</span>
                              )}
                              {convo.unreadCount > 0 && (
                                <span className="w-5 h-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-xs flex items-center justify-center font-black">
                                  {convo.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          {convo.ride && (
                            <p className="text-xs text-indigo-600 font-semibold truncate">
                              {convo.ride.destinationText} · {formatDate(convo.ride.earliestDepartAt)}
                            </p>
                          )}
                          {convo.lastMessage && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{convo.lastMessage}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat window */}
            {activeConvo ? (
              <div className="flex-1 flex flex-col min-w-0">

                {/* Chat header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-black text-sm">
                        {activeConvo.participant.firstName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                        {activeConvo.participant.firstName} {activeConvo.participant.lastName[0]}.
                        <span className="text-xs">🛡️</span>
                      </p>
                      {activeConvo.ride && (
                        <p className="text-xs text-gray-400">
                          {activeConvo.ride.destinationText} · {formatDate(activeConvo.ride.earliestDepartAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-400 text-sm">No messages yet — say hi! 👋</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOutgoing = msg.senderId === userId
                      return (
                        <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                              isOutgoing
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                            }`}
                          >
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${isOutgoing ? 'text-indigo-200' : 'text-gray-400'}`}>
                              {formatTime(msg.createdAt)}
                              {isOutgoing && (
                                <span className="ml-1">{msg.seen ? '· Seen' : '· Sent'}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Safety note */}
                <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100">
                  <p className="text-xs text-indigo-600 text-center">
                    💡 Keep conversations respectful and related to your ride.{' '}
                    <span className="underline cursor-pointer font-semibold">Report any inappropriate behavior.</span>
                  </p>
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-gray-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="w-11 h-11 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white hover:from-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-lg"
                    >
                      ➤
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-5xl mb-4">💬</p>
                  <p className="text-gray-500 font-semibold">Select a conversation</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
