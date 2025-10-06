import { useState, useRef, useEffect } from "react";
import { Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Message, Document, Conversation } from "@shared/schema";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { useToast } from "@/hooks/use-toast";
import { getSelectedModel } from "./settings-dialog";

interface ChatInterfaceProps {
  documentId: string;
}

export function ChatInterface({ documentId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: document } = useQuery<Document>({
    queryKey: ["/api/documents", documentId],
  });

  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", documentId],
  });

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", conversation?.id],
    enabled: !!conversation?.id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (question: string) => {
      const model = getSelectedModel();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          conversationId: conversation?.id,
          question,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      let assistantMessage = "";
      let currentMessageId: string | null = null;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "message_id") {
                currentMessageId = data.messageId;
                setStreamingMessageId(data.messageId);
              } else if (data.type === "token" && currentMessageId) {
                assistantMessage += data.content;
                queryClient.setQueryData(
                  ["/api/messages", conversation?.id],
                  (old: Message[] = []) => {
                    const existing = old.find((m) => m.id === currentMessageId);
                    if (existing) {
                      return old.map((m) =>
                        m.id === currentMessageId
                          ? { ...m, content: assistantMessage }
                          : m
                      );
                    }
                    return old;
                  }
                );
              } else if (data.type === "progress") {
                let progressText = "";
                if (data.eval_count && data.eval_duration) {
                  const tokensPerSec = (data.eval_count / (data.eval_duration / 1e9)).toFixed(1);
                  progressText = `${tokensPerSec} tokens/s`;
                } else if (data.prompt_eval_count && data.prompt_eval_duration) {
                  const tokensPerSec = (data.prompt_eval_count / (data.prompt_eval_duration / 1e9)).toFixed(1);
                  progressText = `Processing: ${tokensPerSec} tokens/s`;
                } else if (data.load_duration) {
                  const loadSec = (data.load_duration / 1e9).toFixed(1);
                  progressText = `Loading model: ${loadSec}s`;
                }
                if (progressText) {
                  setProgress(progressText);
                }
              } else if (data.type === "done") {
                setIsStreaming(false);
                setStreamingMessageId(null);
                setProgress("");
                queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    },
    onError: () => {
      setIsStreaming(false);
      setStreamingMessageId(null);
      setProgress("");
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const question = input.trim();
    setInput("");
    setIsStreaming(true);

    queryClient.setQueryData(
      ["/api/messages", conversation?.id],
      (old: Message[] = []) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          conversationId: conversation?.id || "",
          role: "user",
          content: question,
          createdAt: new Date().toISOString(),
        },
      ]
    );

    sendMessageMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [documentId]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
          <p className="text-muted-foreground">Select a document to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 bg-card">
        <div className="flex items-center gap-2 sm:gap-3">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base truncate" data-testid="text-document-title">{document.name}</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Ask questions about this document
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
              <p className="text-sm text-muted-foreground">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Ask any question about "{document.name}" and get intelligent answers based on the document content
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={message.id === streamingMessageId && isStreaming}
              />
            ))}
            {isStreaming && !streamingMessageId && <TypingIndicator />}
            {progress && (
              <div className="text-xs text-muted-foreground text-center py-2">
                {progress}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card/50 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="resize-none min-h-[50px] sm:min-h-[60px] max-h-32 text-sm sm:text-base"
            disabled={isStreaming}
            data-testid="input-chat-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="rounded-full h-[50px] w-[50px] sm:h-[60px] sm:w-[60px] shrink-0"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
