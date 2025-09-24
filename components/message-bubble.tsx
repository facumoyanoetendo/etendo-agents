"use client"

import type React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, ImageIcon, Play, Pause } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import type { Message, Agent } from "./chat-interface"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MessageBubbleProps {
  message: Message
  agent: Agent
  userAvatarUrl: string | null
}

export default function MessageBubble({ message, agent, userAvatarUrl }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [message.audioUrl])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatAudioTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration

    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const isUser = message.sender === "user"

  const cleanedContent = message.content ? message.content.replace(/(\n\nUser email:.*|\n\nFilesAttached:.*)/gs, "").trim() : "";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <Avatar className={`${agent.color} border border-white/20 flex-shrink-0`}>
          <AvatarFallback className="bg-transparent">{agent.icon}</AvatarFallback>
        </Avatar>
      )}

      <div className={`flex flex-col gap-1 max-w-xs lg:max-w-md ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`glass-effect rounded-2xl p-3 ${
            isUser ? "bg-primary/20 border-primary/30" : "bg-white border-white/10"
          }`}
        >
          {cleanedContent && (
            <div className="prose prose-invert max-w-none text-sm leading-relaxed overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {cleanedContent}
              </ReactMarkdown>
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  {attachment.type.startsWith("image/") ? (
                    <ImageIcon className="w-4 h-4 text-primary" />
                  ) : (
                    <FileText className="w-4 h-4 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-card-foreground truncate">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const link = document.createElement("a")
                      link.href = attachment.url
                      link.download = attachment.name
                      link.click()
                    }}
                    className="h-6 w-6 p-0 hover:bg-white/10"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {message.audioUrl && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-white/5 rounded-lg">
              <Button size="sm" variant="ghost" onClick={handleAudioPlay} className="h-8 w-8 p-0 hover:bg-white/10">
                {isPlaying ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary" />}
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-1 bg-white/20 rounded-full flex-1 cursor-pointer" onClick={handleProgressClick}>
                    <div
                      className="h-1 bg-primary rounded-full transition-all duration-100"
                      style={{
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
                  </span>
                </div>
              </div>
              <audio ref={audioRef} src={message.audioUrl} className="hidden" preload="metadata" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
          {isUser && (
            <Badge variant="secondary" className="text-xs">
              Sent
            </Badge>
          )}
        </div>
      </div>

      {isUser && (
        <Avatar className="bg-primary/20 border border-primary/30 flex-shrink-0">
          {userAvatarUrl ? (
            <AvatarImage src={userAvatarUrl} alt={message.sender} />
          ) : (
            <AvatarFallback className="bg-transparent text-primary">👤</AvatarFallback>
          )}
        </Avatar>
      )}
    </div>
  )
}
