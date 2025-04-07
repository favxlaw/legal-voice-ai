import type { Message } from "ai"
import { FiUser } from "react-icons/fi"
import { GiScales } from "react-icons/gi"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
          <GiScales className="h-5 w-5 text-purple-600" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-lg p-4",
          isUser ? "bg-purple-600 text-white rounded-tr-none" : "bg-white border border-purple-100 rounded-tl-none",
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* If there are attachments in the message content, we could render them here */}
        {message.content.includes("[Attached files:") && (
          <div className="mt-2 text-xs opacity-70">
            {/* This is just a visual indicator, in a real app you'd parse and display the files */}
            File(s) attached to this message
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
          <FiUser className="h-5 w-5 text-purple-600" />
        </div>
      )}
    </div>
  )
}

