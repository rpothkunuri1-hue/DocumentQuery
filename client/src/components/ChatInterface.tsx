import React, { useState, useEffect, useRef } from 'react';

interface Document {
  id: string;
  name: string;
  content: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  documentId?: string;
  documentIds?: string[];
}

interface Props {
  documents: Document[];
  selectedModel: string;
  onRemoveDocument?: (id: string) => void;
}

interface ProgressMetrics {
  tokensPerSecond?: number;
  totalDuration?: number;
  evalCount?: number;
  promptEvalCount?: number;
}

export default function ChatInterface({ documents, selectedModel, onRemoveDocument }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetrics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMultiDoc = documents.length > 1;
  const documentIds = documents.map(doc => doc.id);

  useEffect(() => {
    loadConversation();
  }, [documents.map(d => d.id).join(',')]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    try {
      if (isMultiDoc) {
        const convResponse = await fetch('/api/conversations/multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentIds }),
        });
        
        if (convResponse.ok) {
          const conversation: Conversation = await convResponse.json();
          setConversationId(conversation.id);

          const messagesResponse = await fetch(`/api/messages/${conversation.id}`);
          const messagesData = await messagesResponse.json();
          setMessages(messagesData);
        }
      } else if (documents.length === 1) {
        const convResponse = await fetch(`/api/conversations/${documents[0].id}`);
        const conversation: Conversation = await convResponse.json();
        setConversationId(conversation.id);

        const messagesResponse = await fetch(`/api/messages/${conversation.id}`);
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !conversationId) return;

    const question = input.trim();
    setInput('');
    setIsStreaming(true);

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const endpoint = isMultiDoc ? '/api/chat/multi' : '/api/chat';
      const requestBody = isMultiDoc
        ? { documentIds, conversationId, question, model: selectedModel }
        : { documentId: documents[0].id, conversationId, question, model: selectedModel };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let messageId: string | null = null;

      if (!reader) throw new Error('No reader');

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'message_id') {
                  messageId = data.messageId;
                  setProgressMetrics(null);
                  setMessages(prev => [...prev, {
                    id: messageId!,
                    role: 'assistant',
                    content: '',
                    createdAt: new Date().toISOString(),
                  }]);
                } else if (data.type === 'token' && messageId) {
                  assistantMessage += data.content;
                  setMessages(prev => prev.map(m =>
                    m.id === messageId ? { ...m, content: assistantMessage } : m
                  ));
                } else if (data.type === 'progress') {
                  const tokensPerSecond = data.eval_count && data.eval_duration 
                    ? parseFloat((data.eval_count / (data.eval_duration / 1e9)).toFixed(2))
                    : undefined;
                  
                  setProgressMetrics({
                    tokensPerSecond,
                    totalDuration: data.total_duration ? parseFloat((data.total_duration / 1e9).toFixed(2)) : undefined,
                    evalCount: data.eval_count,
                    promptEvalCount: data.prompt_eval_count,
                  });
                } else if (data.type === 'done') {
                  setIsStreaming(false);
                  setProgressMetrics(null);
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setProgressMetrics(null);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setProgressMetrics(null);
    }
  };

  const handleExport = async (format: 'pdf' | 'markdown' | 'json') => {
    if (!conversationId) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}/export?format=${format}`);
      
      if (!response.ok) throw new Error('Failed to export conversation');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'pdf';
      a.download = `conversation-${conversationId}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const headerText = isMultiDoc 
    ? `${documents.length} Documents` 
    : documents[0]?.name || 'Document';

  const subHeaderText = isMultiDoc
    ? `Ask questions across multiple documents • Using ${selectedModel}`
    : `Ask questions about this document • Using ${selectedModel}`;

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2 data-testid="text-header">{headerText}</h2>
          <p>{subHeaderText}</p>
        </div>
        <div className="chat-header-actions">
          <button 
            onClick={() => handleExport('pdf')} 
            className="btn-export"
            disabled={!conversationId || messages.length === 0}
            title="Export as PDF"
            data-testid="button-export-pdf"
          >
            📄 PDF
          </button>
          <button 
            onClick={() => handleExport('markdown')} 
            className="btn-export"
            disabled={!conversationId || messages.length === 0}
            title="Export as Markdown"
            data-testid="button-export-markdown"
          >
            📝 MD
          </button>
          <button 
            onClick={() => handleExport('json')} 
            className="btn-export"
            disabled={!conversationId || messages.length === 0}
            title="Export as JSON"
            data-testid="button-export-json"
          >
            💾 JSON
          </button>
        </div>
      </div>

      {isMultiDoc && (
        <div className="document-chips" data-testid="document-chips">
          {documents.map(doc => (
            <div key={doc.id} className="document-chip" data-testid={`chip-document-${doc.id}`}>
              <span className="chip-name">{doc.name}</span>
              {onRemoveDocument && (
                <button
                  onClick={() => onRemoveDocument(doc.id)}
                  className="chip-remove"
                  title="Remove document"
                  data-testid={`button-remove-${doc.id}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h3>Start a conversation</h3>
            <p>
              {isMultiDoc 
                ? `Ask questions about your ${documents.length} selected documents`
                : `Ask any question about "${documents[0]?.name}"`
              }
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-avatar">
                {message.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {isStreaming && progressMetrics && (
        <div className="progress-metrics" data-testid="progress-metrics">
          <div className="progress-indicator">
            <span className="progress-label">Generating response...</span>
            {progressMetrics.tokensPerSecond && (
              <span className="progress-stat" data-testid="tokens-per-second">
                {progressMetrics.tokensPerSecond} tokens/s
              </span>
            )}
            {progressMetrics.evalCount && (
              <span className="progress-stat" data-testid="eval-count">
                {progressMetrics.evalCount} tokens
              </span>
            )}
            {progressMetrics.totalDuration && (
              <span className="progress-stat" data-testid="total-duration">
                {progressMetrics.totalDuration}s
              </span>
            )}
          </div>
        </div>
      )}

      <form className="chat-input" onSubmit={sendMessage} data-testid="form-chat">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
          placeholder="Ask a question..."
          disabled={isStreaming}
          data-testid="input-question"
        />
        <button type="submit" className="btn-send" disabled={!input.trim() || isStreaming} data-testid="button-send">
          ➤
        </button>
      </form>
    </div>
  );
}
