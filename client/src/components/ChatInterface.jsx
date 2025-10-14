import { useState, useEffect, useRef } from 'react';

export default function ChatInterface({ document: currentDocument, selectedModel, onDocumentUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [progressMetrics, setProgressMetrics] = useState(null);
  const [showDocSummary, setShowDocSummary] = useState(false);
  const [error, setError] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState(null);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryMessage, setSummaryMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const summaryPollInterval = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  useEffect(() => {
    loadConversation();
    setShowDocSummary(true);
    setError(null);
    setSummaryStatus(currentDocument.summary_status || null);
    
    if (summaryPollInterval.current) {
      if (summaryPollInterval.current instanceof EventSource) {
        summaryPollInterval.current.close();
      } else {
        clearInterval(summaryPollInterval.current);
      }
      summaryPollInterval.current = null;
    }
    
    if (currentDocument.summary_status === 'generating') {
      startSummaryPolling();
    }
    
    return () => {
      if (summaryPollInterval.current) {
        if (summaryPollInterval.current instanceof EventSource) {
          summaryPollInterval.current.close();
        } else {
          clearInterval(summaryPollInterval.current);
        }
        summaryPollInterval.current = null;
      }
    };
  }, [currentDocument.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSummaryPolling = () => {
    if (summaryPollInterval.current) {
      if (summaryPollInterval.current instanceof EventSource) {
        summaryPollInterval.current.close();
      } else {
        clearInterval(summaryPollInterval.current);
      }
      summaryPollInterval.current = null;
    }
    
    setConnectionStatus('connecting');
    const eventSource = new EventSource(`/api/documents/${currentDocument.id}/summary-status`);
    
    eventSource.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setSummaryStatus(data.status);
          setSummaryProgress(data.progress || 0);
          setSummaryMessage(data.message || '');
          
          if (onDocumentUpdate) {
            onDocumentUpdate({
              ...currentDocument,
              summary_status: data.status,
              summary_progress: data.progress,
              summary_message: data.message,
              summary: data.summary
            });
          }
        } else if (data.type === 'done') {
          setConnectionStatus('disconnected');
          eventSource.close();
        } else if (data.type === 'error' || data.type === 'timeout') {
          setConnectionStatus('disconnected');
          setError(data.message || 'Connection error');
          eventSource.close();
        }
      } catch (error) {
        console.error('Failed to parse summary status:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('disconnected');
      eventSource.close();
      
      if (reconnectAttempts.current < maxReconnectAttempts && summaryStatus === 'generating') {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
          if (summaryStatus === 'generating') {
            startSummaryPolling();
          }
        }, delay);
      }
    };
    
    summaryPollInterval.current = eventSource;
  };

  const loadConversation = async () => {
    try {
      setError(null);
      const convResponse = await fetch(`/api/conversations/${currentDocument.id}`);
      
      if (!convResponse.ok) {
        const errorData = await convResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to load conversation (${convResponse.status})`);
      }
      
      const conversation = await convResponse.json();
      setConversationId(conversation.id);

      const messagesResponse = await fetch(`/api/messages/${conversation.id}`);
      
      if (!messagesResponse.ok) {
        const errorData = await messagesResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to load messages (${messagesResponse.status})`);
      }
      
      const messagesData = await messagesResponse.json();
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError(`Unable to load conversation: ${error.message}`);
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setProgressMetrics(null);
      
      // Remove blank assistant message after cancellation
      setMessages(prev => prev.filter(m => m.content || m.role === 'user'));
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${conversationId}/${messageId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
      
      // Remove message and any following assistant message
      setMessages(prev => {
        const messageIndex = prev.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return prev;
        
        // If it's a user message, also remove the following assistant message
        if (prev[messageIndex].role === 'user' && messageIndex + 1 < prev.length && prev[messageIndex + 1].role === 'assistant') {
          return prev.filter((_, idx) => idx !== messageIndex && idx !== messageIndex + 1);
        }
        
        return prev.filter(m => m.id !== messageId);
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      setError(`Failed to delete message: ${error.message}`);
    }
  };

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const startEdit = (message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const saveEdit = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${conversationId}/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update message');
      }
      
      // Update local state
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, content: editContent } : m
      ));
      
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to update message:', error);
      setError(`Failed to update message: ${error.message}`);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isStreaming || !conversationId) return;

    setInput('');
    setIsStreaming(true);

    const tempUserMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    
    const tempAssistantMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, tempUserMessage, tempAssistantMessage]);

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to send message (${response.status})`);
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let messageId = null;

      if (!reader) throw new Error('Unable to read response stream');

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
                  setMessages(prev => prev.map(m => 
                    m.id.startsWith('temp-assistant-') ? { ...m, id: messageId } : m
                  ));
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
        // Remove incomplete messages after abort
        setMessages(prev => prev.filter(m => m.content || m.role === 'user'));
      } else {
        console.error('Failed to send message:', error);
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Request timed out. The AI model is taking longer than expected. Please try again with a shorter question or check if the AI service is running properly.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to the AI service. Please check if the AI model is running and try again.';
        }
        
        setError(errorMessage);
        // Remove failed assistant message
        setMessages(prev => prev.filter(m => m.content || m.role === 'user'));
      }
      setIsStreaming(false);
      setProgressMetrics(null);
      abortControllerRef.current = null;
    }
  };

  const LoadingDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }} data-testid="loading-animation">
      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
        }
        .loading-dot {
          width: 10px;
          height: 10px;
          background-color: #3b82f6;
          border-radius: 50%;
          display: inline-block;
        }
        .bounce-dot-1 { animation: bounce-dot 1.4s infinite ease-in-out; animation-delay: 0s; }
        .bounce-dot-2 { animation: bounce-dot 1.4s infinite ease-in-out; animation-delay: 0.2s; }
        .bounce-dot-3 { animation: bounce-dot 1.4s infinite ease-in-out; animation-delay: 0.4s; }
      `}</style>
      <span className="loading-dot bounce-dot-1"></span>
      <span className="loading-dot bounce-dot-2"></span>
      <span className="loading-dot bounce-dot-3"></span>
    </div>
  );

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2 data-testid="text-header">{currentDocument.name}</h2>
          <p>Ask questions about this document • Using {selectedModel}</p>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ 
          backgroundColor: '#fee', 
          color: '#c00', 
          padding: '12px 16px', 
          margin: '16px', 
          borderRadius: '8px',
          borderLeft: '4px solid #c00'
        }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={() => setError(null)}
            style={{ 
              float: 'right', 
              background: 'none', 
              border: 'none', 
              color: '#c00', 
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="messages">
        {showDocSummary && (
          <div className="doc-summary-banner" style={{
            backgroundColor: '#f0f9ff',
            padding: '16px',
            margin: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#1e40af' }}>Document Loaded</h3>
            {summaryStatus === 'generating' ? (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#1e40af' }}>
                      <div className="spinner" style={{ 
                        width: '16px', 
                        height: '16px', 
                        border: '2px solid #e0e7ff',
                        borderTop: '2px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      <span>{summaryMessage || 'Generating AI summary...'}</span>
                      {connectionStatus === 'connected' && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            marginRight: '4px',
                            animation: 'pulse 2s ease-in-out infinite'
                          }}></span>
                          Live
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {summaryProgress}%
                    </span>
                  </div>
                  
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e0e7ff',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: `${summaryProgress}%`,
                      height: '100%',
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                </div>
                
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  This document contains <strong>{currentDocument.content ? currentDocument.content.split(' ').length : 0} words</strong>. 
                  Summary will appear here shortly.
                </p>
              </>
            ) : summaryStatus === 'completed' && currentDocument.summary ? (
              <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#475569' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentDocument.summary}</p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                Ready to answer questions about this document.
              </p>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className="message-body" style={{ flex: 1 }}>
              {editingMessageId === message.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontFamily: 'inherit',
                      fontSize: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => saveEdit(message.id)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {message.role === 'assistant' && !message.content && isStreaming ? (
                    <LoadingDots />
                  ) : (
                    <div className="message-content">{message.content}</div>
                  )}
                </>
              )}
            </div>
            {message.role === 'user' && editingMessageId !== message.id && !isStreaming && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                <button
                  onClick={() => startEdit(message)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Edit message"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this message and its response?')) {
                      deleteMessage(message.id);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Delete message"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {progressMetrics && (
        <div className="progress-metrics">
          <div className="progress-indicator">
            <span className="progress-label">Generating response...</span>
            {progressMetrics.tokensPerSecond && (
              <span className="progress-stat">{progressMetrics.tokensPerSecond} tokens/s</span>
            )}
          </div>
        </div>
      )}

      <form className="chat-input" onSubmit={sendMessage}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
          placeholder="Ask a question about the document..."
          rows={1}
          disabled={isStreaming}
          style={{
            minHeight: '44px',
            maxHeight: '150px',
            resize: 'none',
            overflow: 'auto'
          }}
        />
        {!isStreaming ? (
          <button
            type="submit"
            className="btn-send"
            disabled={!input.trim() || !conversationId}
            title="Send message"
          >
            <span className="icon icon-send"></span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-send"
            onClick={stopGeneration}
            title="Stop generation"
            style={{ backgroundColor: '#ef4444' }}
          >
            <span className="icon icon-stop"></span>
          </button>
        )}
      </form>
    </div>
  );
}
