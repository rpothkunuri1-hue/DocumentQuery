import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Send, StopCircle, Copy, RotateCcw, Edit2, ThumbsUp, ThumbsDown, Trash2, Check } from 'lucide-react';

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

interface MessageRating {
  [messageId: string]: 'up' | 'down' | null;
}

export default function ChatInterface({ documents, selectedModel, onRemoveDocument }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetrics | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [messageRatings, setMessageRatings] = useState<MessageRating>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setProgressMetrics(null);
    }
  };

  const sendMessage = async (e: FormEvent | KeyboardEvent, content?: string) => {
    e.preventDefault();
    const question = content || input.trim();
    if (!question || isStreaming || !conversationId) return;

    if (!content) {
      setInput('');
    }
    setIsStreaming(true);

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    abortControllerRef.current = new AbortController();

    try {
      const endpoint = isMultiDoc ? '/api/chat/multi' : '/api/chat';
      const requestBody = isMultiDoc
        ? { documentIds, conversationId, question, model: selectedModel }
        : { documentId: documents[0].id, conversationId, question, model: selectedModel };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
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
        abortControllerRef.current = null;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error('Failed to send message:', error);
      }
      setIsStreaming(false);
      setProgressMetrics(null);
      abortControllerRef.current = null;
    }
  };

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy message to clipboard.');
    }
  };

  const handleRegenerateResponse = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;

    const previousUserMessage = messages[messageIndex - 1];
    if (previousUserMessage.role !== 'user') return;

    setMessages(prev => prev.filter((_, idx) => idx < messageIndex));

    const fakeEvent = { preventDefault: () => {} } as FormEvent;
    await sendMessage(fakeEvent, previousUserMessage.content);
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: editContent.trim() } : m
    ));

    setMessages(prev => prev.filter((_, idx) => idx <= messageIndex));

    setEditingMessageId(null);
    setEditContent('');

    const fakeEvent = { preventDefault: () => {} } as FormEvent;
    await sendMessage(fakeEvent, editContent.trim());
  };

  const handleRateMessage = (messageId: string, rating: 'up' | 'down') => {
    setMessageRatings(prev => ({
      ...prev,
      [messageId]: prev[messageId] === rating ? null : rating,
    }));
  };

  const handleDeleteMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    setMessages(prev => prev.filter((_, idx) => idx < messageIndex));
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

  const LoadingDots = () => (
    <div className="flex items-center gap-1" data-testid="loading-animation">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
    </div>
  );

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
          messages.map((message, index) => (
            <div key={message.id} className={`message ${message.role}`} data-testid={`message-${message.role}-${message.id}`}>
              <div className="message-avatar" data-testid={`avatar-${message.role}`}>
                {message.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className="message-body">
                {editingMessageId === message.id ? (
                  <div className="message-edit" data-testid={`edit-mode-${message.id}`}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="message-edit-input"
                      rows={3}
                      data-testid={`textarea-edit-${message.id}`}
                    />
                    <div className="message-edit-actions">
                      <button
                        onClick={() => handleSaveEdit(message.id)}
                        className="btn-message-action btn-save"
                        disabled={!editContent.trim()}
                        data-testid={`button-save-edit-${message.id}`}
                        title="Save and regenerate"
                      >
                        <Check className="w-4 h-4" />
                        Save & Regenerate
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-message-action btn-cancel"
                        data-testid={`button-cancel-edit-${message.id}`}
                        title="Cancel editing"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="message-content" data-testid={`content-${message.id}`}>
                      {message.content || (message.role === 'assistant' && <LoadingDots />)}
                    </div>
                    
                    {message.content && (
                      <div className="message-actions" data-testid={`actions-${message.id}`}>
                        {message.role === 'assistant' && (
                          <>
                            <button
                              onClick={() => handleCopyMessage(message.content, message.id)}
                              className="btn-message-action"
                              title="Copy message"
                              data-testid={`button-copy-${message.id}`}
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleRegenerateResponse(message.id)}
                              className="btn-message-action"
                              disabled={isStreaming}
                              title="Regenerate response"
                              data-testid={`button-regenerate-${message.id}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => handleRateMessage(message.id, 'up')}
                              className={`btn-message-action ${messageRatings[message.id] === 'up' ? 'active' : ''}`}
                              title="Rate positively"
                              data-testid={`button-thumbs-up-${message.id}`}
                            >
                              <ThumbsUp className={`w-4 h-4 ${messageRatings[message.id] === 'up' ? 'fill-current' : ''}`} />
                            </button>
                            
                            <button
                              onClick={() => handleRateMessage(message.id, 'down')}
                              className={`btn-message-action ${messageRatings[message.id] === 'down' ? 'active' : ''}`}
                              title="Rate negatively"
                              data-testid={`button-thumbs-down-${message.id}`}
                            >
                              <ThumbsDown className={`w-4 h-4 ${messageRatings[message.id] === 'down' ? 'fill-current' : ''}`} />
                            </button>
                          </>
                        )}
                        
                        {message.role === 'user' && (
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="btn-message-action"
                            disabled={isStreaming}
                            title="Edit message"
                            data-testid={`button-edit-${message.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="btn-message-action btn-delete"
                          disabled={isStreaming}
                          title="Delete message and responses"
                          data-testid={`button-delete-${message.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
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
        {isStreaming ? (
          <button 
            type="button" 
            className="btn-send btn-stop" 
            onClick={stopGeneration}
            data-testid="button-stop"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        ) : (
          <button 
            type="submit" 
            className="btn-send" 
            disabled={!input.trim()} 
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </form>
    </div>
  );
}
