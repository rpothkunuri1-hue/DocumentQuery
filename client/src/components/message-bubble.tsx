import { User, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@shared/schema";
import { useEffect, useState } from "react";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [displayedContent, setDisplayedContent] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (isStreaming && message.role === "assistant") {
      setShowCursor(true);
      let currentIndex = 0;
      const intervalId = setInterval(() => {
        if (currentIndex < message.content.length) {
          setDisplayedContent(message.content.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setShowCursor(false);
          clearInterval(intervalId);
        }
      }, 20);
      
      return () => clearInterval(intervalId);
    } else {
      setDisplayedContent(message.content);
    }
  }, [message.content, isStreaming, message.role]);

  return (
    <div
      className={`flex gap-4 message-enter ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      )}
      
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-3xl`}>
        <div
          className={`
            rounded-2xl px-4 py-3
            ${isUser 
              ? "bg-card border border-card-border" 
              : "bg-secondary"
            }
          `}
        >
          <p className="text-base whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
            {displayedContent}
            {showCursor && <span className="cursor-blink ml-0.5">|</span>}
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </span>
      </div>

      {isUser && (
        <div className="shrink-0">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}
