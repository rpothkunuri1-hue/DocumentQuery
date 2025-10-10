import { useState, useEffect, useRef } from 'react';

export default function ChatInterface({ document: currentDocument, selectedModel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [progressMetrics, setProgressMetrics] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [messageRatings, setMessageRatings] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadConversation();
  }, [currentDocument.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    try {
      const convResponse = await fetch(`/api/conversations/${currentDocument.id}`);
      const conversation = await convResponse.json();
      setConversationId(conversation.id);

      const messagesResponse = await fetch(`/api/messages/${conversation.id}`);
      const messagesData = await messagesResponse.json();
      setMessages(messagesData);
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

  const sendMessage = async (e, content) => {
    e.preventDefault();
    const question = content || input.trim();
    if (!question || isStreaming || !conversationId) return;

    if (!content) {
      setInput('');
    }
    setIsStreaming(true);

    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: currentDocument.id,
          conversationId,
          question,
          model: selectedModel
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let messageId = null;

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
                    id: messageId,
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
    } catch (error) {
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

  const handleCopyMessage = async (content, messageId) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy message to clipboard.');
    }
  };

  const handleRegenerateResponse = async (messageId) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;

    const previousUserMessage = messages[messageIndex - 1];
    if (previousUserMessage.role !== 'user') return;

    setMessages(prev => prev.filter((_, idx) => idx < messageIndex));

    const fakeEvent = { preventDefault: () => {} };
    await sendMessage(fakeEvent, previousUserMessage.content);
  };

  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editContent.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: editContent.trim() } : m
    ));

    setMessages(prev => prev.filter((_, idx) => idx <= messageIndex));

    setEditingMessageId(null);
    setEditContent('');

    const fakeEvent = { preventDefault: () => {} };
    await sendMessage(fakeEvent, editContent.trim());
  };

  const handleRateMessage = (messageId, rating) => {
    setMessageRatings(prev => ({
      ...prev,
      [messageId]: prev[messageId] === rating ? null : rating,
    }));
  };

  const handleDeleteMessage = async (messageId) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    setMessages(prev => prev.filter((_, idx) => idx < messageIndex));
  };


  const LoadingDots = () => (
    <div className="flex items-center gap-1" data-testid="loading-animation">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
    </div>
  );

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/documents/${currentDocument.id}/export/${format}`);
      if (!response.ok) throw new Error(`Failed to export as ${format}`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDocument.name}_export.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Export failed:`, error);
      alert(`Failed to export document as ${format}`);
    }
  };

  const handleDownloadSummary = async () => {
    try {
      const response = await fetch(`/api/documents/${currentDocument.id}/summary/pdf`);
      if (!response.ok) throw new Error('Failed to download summary');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDocument.name}_summary.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download summary failed:', error);
      alert('Failed to download document summary');
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2 data-testid="text-header">{currentDocument.name}</h2>
          <p>Ask questions about this document • Using {selectedModel}</p>
        </div>
        <div className="export-actions">
          <button
            onClick={handleDownloadSummary}
            className="btn-export"
            title="Download Document Summary"
            data-testid="button-download-summary"
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            <span className="icon icon-download"></span>
            <span>Summary</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="btn-export"
            title="Export Conversation as PDF"
            data-testid="button-export-pdf"
          >
            <span className="icon icon-download"></span>
            <span>PDF</span>
          </button>
          <button
            onClick={() => handleExport('markdown')}
            className="btn-export"
            title="Export Conversation as Markdown"
            data-testid="button-export-md"
          >
            <span className="icon icon-file"></span>
            <span>MD</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn-export"
            title="Export Conversation as JSON"
            data-testid="button-export-json"
          >
            <span className="icon icon-code"></span>
            <span>JSON</span>
          </button>
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h3>Start a conversation</h3>
            <p>Ask any question about "{currentDocument.name}"</p>
          </div>
        ) : (
          messages.map((message) => (
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
                        <span className="icon icon-check"></span>
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
                              <span className={`icon ${copiedMessageId === message.id ? 'icon-check' : 'icon-copy'}`} 
                                style={copiedMessageId === message.id ? { color: '#10b981' } : {}}></span>
                            </button>
                            
                            <button
                              onClick={() => handleRegenerateResponse(message.id)}
                              className="btn-message-action"
                              disabled={isStreaming}
                              title="Regenerate response"
                              data-testid={`button-regenerate-${message.id}`}
                            >
                              <span className="icon icon-rotate"></span>
                            </button>
                            
                            <button
                              onClick={() => handleRateMessage(message.id, 'up')}
                              className={`btn-message-action ${messageRatings[message.id] === 'up' ? 'active' : ''}`}
                              title="Rate positively"
                              data-testid={`button-thumbs-up-${message.id}`}
                            >
                              <span className={`icon icon-thumbs-up ${messageRatings[message.id] === 'up' ? 'fill' : ''}`}></span>
                            </button>
                            
                            <button
                              onClick={() => handleRateMessage(message.id, 'down')}
                              className={`btn-message-action ${messageRatings[message.id] === 'down' ? 'active' : ''}`}
                              title="Rate negatively"
                              data-testid={`button-thumbs-down-${message.id}`}
                            >
                              <span className={`icon icon-thumbs-down ${messageRatings[message.id] === 'down' ? 'fill' : ''}`}></span>
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
                            <span className="icon icon-edit"></span>
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="btn-message-action btn-delete"
                          disabled={isStreaming}
                          title="Delete message and responses"
                          data-testid={`button-delete-${message.id}`}
                        >
                          <span className="icon icon-trash"></span>
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
            <span className="icon icon-stop"></span>
          </button>
        ) : (
          <button 
            type="submit" 
            className="btn-send" 
            disabled={!input.trim()} 
            data-testid="button-send"
          >
            <span className="icon icon-send"></span>
          </button>
        )}
      </form>
    </div>
  );
}
