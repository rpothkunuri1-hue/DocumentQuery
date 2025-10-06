import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-4 justify-start message-enter" data-testid="typing-indicator">
      <div className="shrink-0">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>
      
      <div className="flex flex-col items-start">
        <div className="bg-secondary rounded-2xl px-4 py-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}
