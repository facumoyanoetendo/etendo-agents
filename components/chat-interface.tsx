"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import MessageBubble from "./message-bubble"
import FileUpload from "./file-upload"
import AudioRecorder from "./audio-recorder"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { User } from "@supabase/supabase-js"
import { Message as ChatMessage } from "@/lib/actions/chat"

export interface Agent {
  id: string
  name: string
  description: string
  webhookurl: string
  path: string
  color: string
  icon: string
  access_level: "public" | "partner" | "admin"
}

export interface Message {
  id: string
  content: string
  sender: "user" | "agent"
  timestamp: Date
  agentId: string
  attachments?: Array<{
    name: string
    type: string
    url: string
    size: number
  }>
  audioUrl?: string
}

interface ChatInterfaceProps {
  agent: Agent
  user: User
  initialMessages: Message[] // Use the local Message type
  conversationId?: string
  initialSessionId?: string | null
}

export default function ChatInterface({
  agent,
  user,
  initialMessages,
  conversationId,
  initialSessionId,
}: ChatInterfaceProps) {
  const router = useRouter()
  const [selectedAgent] = useState<Agent>(agent)
  const [messages, setMessages] = useState<Message[]>(
    initialMessages
  )
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [sessionId, setSessionId] = useState<string>("")
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId)
    } else {
      setSessionId(`${user?.id || "anon"}-${Date.now()}`)
    }
  }, [initialSessionId, user?.id])

  useEffect(() => {
    setMessages(initialMessages as Message[])
  }, [initialMessages])

  // Fetch user avatar URL on component mount
  useEffect(() => {
    const getUserAvatar = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && user.user_metadata?.avatar_url) {
        setUserAvatarUrl(user.user_metadata.avatar_url as string)
      }
    }
    getUserAvatar()
  }, []) // No dependency on supabase, as it's a constant import

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (
    content: string,
    files: File[],
    audioBlob?: Blob
  ) => {
    if (
      !selectedAgent ||
      (!content.trim() && files.length === 0 && !audioBlob)
    )
      return

    const messageId = Date.now().toString()
    const userMessage: Message = {
      id: messageId,
      content:
        content ||
        (audioBlob
          ? "[Audio message]"
          : files.length > 0
          ? "[Attachments]"
          : ""),
      sender: "user",
      timestamp: new Date(),
      agentId: selectedAgent.id,
      attachments: files.map(file => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
        size: file.size,
      })),
      audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage("")
    setAttachedFiles([]) // Clear attached files after sending
    setIsLoading(true)

    try {
      const formData = new FormData()
      const fullWebhookUrl = `${selectedAgent.webhookurl}${selectedAgent.path}`
      formData.append("webhookUrl", fullWebhookUrl)
      formData.append("message", content)
      formData.append("agentId", selectedAgent.id)
      formData.append("sessionId", sessionId)

      if (conversationId) {
        formData.append("conversationId", conversationId)
      }

      if (user?.email) {
        formData.append("userEmail", user.email)
      }

      if (files.length > 0) {
        files.forEach((file, index) => {
          formData.append(`file_${index}`, file)
        })
      }

      if (audioBlob) {
        formData.append("audio", audioBlob, "audio.webm")
      }

      const response = await fetch("/api/webhook", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `Error ${response.status}: ${response.statusText}`
        )
      }

      const agentResponse = await response.json()

      // If the backend returns a new conversationId, update the URL
      if (agentResponse.conversationId && !conversationId) {
        router.push(
          `/chat/${agent.path.substring(1)}/${agentResponse.conversationId}`
        )
      }

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          agentResponse.output ||
          agentResponse.message ||
          agentResponse.response ||
          "Respuesta recibida del agente",
        sender: "agent",
        timestamp: new Date(),
        agentId: selectedAgent.id,
      }

      setMessages(prev => [...prev, agentMessage])

      toast({
        title: "Mensaje enviado",
        description: `Respuesta recibida de ${selectedAgent.name}`,
      })
    } catch (error) {
      console.error("[v0] Error al enviar mensaje:", error)
      toast({
        title: "Error de conexión",
        description: `No se pudo conectar con ${
          selectedAgent.name
        }. ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputMessage, attachedFiles)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.ctrlKey && e.shiftKey) {
        return
      } else if (!e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        if (inputMessage.trim() || attachedFiles.length > 0) {
          sendMessage(inputMessage, attachedFiles)
        }
      }
    }
  }

  const handleFileUpload = (files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files])
  }

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAudioSend = (audioBlob: Blob) => {
    sendMessage("", [], audioBlob)
  }

  return (
    <div className="h-full">
      {/* Panel de Chat */}
      <div className="w-full h-full">
        <Card className="glass-effect h-full flex flex-col bg-gradient-to-br from-purple-100 via-blue-50 to-green-50 rounded-lg">
          {/* Header del Chat */}
          {selectedAgent && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar className={`${selectedAgent.color} border-2 border-white/20`}>
                  <AvatarFallback className="text-2xl bg-transparent">{selectedAgent.icon}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-card-foreground">{selectedAgent.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAgent.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4">{selectedAgent.icon}</div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">
                    Hi! I'm the {selectedAgent.name}
                  </h3>
                  <p className="text-muted-foreground">{selectedAgent.description}</p>
                </div>
              </div>
            ) : (
              messages
                .filter(msg => msg.agentId === selectedAgent.id)
                .map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    agent={selectedAgent}
                    userAvatarUrl={userAvatarUrl}
                  />
                ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="glass-effect rounded-2xl p-3 max-w-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Mensaje */}
          {selectedAgent && (
            <div className="p-4 border-t border-border">
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                    >
                      {file.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="flex-1">
                  <Textarea
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Write a message here...`}
                    className="glass-effect border-border text-card-foreground placeholder:text-muted-foreground min-h-[40px] max-h-32 resize-none"
                    disabled={isLoading}
                    rows={1}
                  />
                </div>
                <FileUpload onFileUpload={handleFileUpload} disabled={isLoading} />
                <AudioRecorder
                  onAudioSend={handleAudioSend}
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={
                    (!inputMessage.trim() && attachedFiles.length === 0) ||
                    isLoading
                  }
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}