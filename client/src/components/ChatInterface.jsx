import { useState, useEffect, useRef } from 'react';

export default function ChatInterface({ document: currentDocument, selectedModel, onDocumentUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [progressMetrics, setProgressMetrics] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [messageRatings, setMessageRatings] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [showDocSummary, setShowDocSummary] = useState(false);
  const [error, setError] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState(null);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryMessage, setSummaryMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected', 'connecting', 'disconnected'
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
    
    // Clean up any existing SSE connection first
    if (summaryPollInterval.current) {
      if (summaryPollInterval.current instanceof EventSource) {
        summaryPollInterval.current.close();
      } else {
        clearInterval(summaryPollInterval.current);
      }
      summaryPollInterval.current = null;
    }
    
    // Start SSE connection only if summary is generating
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
    // Clear any existing connection first
    if (summaryPollInterval.current) {
      if (summaryPollInterval.current instanceof EventSource) {
        summaryPollInterval.current.close();
      } else {
        clearInterval(summaryPollInterval.current);
      }
      summaryPollInterval.current = null;
    }
    
    setConnectionStatus('connecting');
    
    // Use SSE for real-time updates instead of polling
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
          
          // Update parent component with the latest status
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
      
      // Auto-reconnect logic with exponential backoff
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
    
    // Store reference for cleanup
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to send message (${response.status})`);
      }

      setShowDocSummary(false);
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
        setError(`Message failed: ${error.message}`);
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

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = async () => {
    try {
      const response = await fetch(`/api/documents/${currentDocument.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: exportFormat })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Export failed (${response.status})`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = exportFormat === 'markdown' ? 'md' : exportFormat;
      a.download = `${currentDocument.name}_export.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportModal(false);
    } catch (error) {
      console.error(`Export failed:`, error);
      setError(`Export failed: ${error.message}`);
      setShowExportModal(false);
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
            onClick={handleExportClick}
            className="btn-export"
            title="Export Document and Conversation"
            data-testid="button-export"
            style={{ backgroundColor: '#10b981', color: 'white' }}
          >
            <span className="icon icon-download"></span>
            <span>Export</span>
          </button>
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

      {showExportModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Export Document</h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Choose a format to export the document summary and conversation history.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              {['pdf', 'txt', 'md', 'json'].map(format => (
                <label 
                  key={format}
                  style={{
                    display: 'block',
                    padding: '10px',
                    marginBottom: '8px',
                    border: '2px solid',
                    borderColor: exportFormat === format ? '#10b981' : '#ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: exportFormat === format ? '#f0fdf4' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value={format}
                    checked={exportFormat === format}
                    onChange={(e) => setExportFormat(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  <strong>{format.toUpperCase()}</strong>
                  <span style={{ marginLeft: '8px', color: '#666', fontSize: '14px' }}>
                    {format === 'pdf' && '- Portable Document Format'}
                    {format === 'txt' && '- Plain Text File'}
                    {format === 'md' && '- Markdown File'}
                    {format === 'json' && '- JSON Data Format'}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExportConfirm}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Download
              </button>
            </div>
          </div>
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
                      {connectionStatus === 'connecting' && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          color: '#f59e0b'
                        }}>
                          Connecting...
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {summaryProgress}%
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
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
            ) : currentDocument.summary ? (
              <>
                <p style={{ marginBottom: '12px', color: '#1e40af', lineHeight: '1.6' }}>
                  <strong>Summary:</strong> {currentDocument.summary}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  This document contains <strong>{currentDocument.content ? currentDocument.content.split(' ').length : 0} words</strong>. 
                  You can now ask questions about the content.
                </p>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '12px', color: '#1e40af' }}>
                  This document contains <strong>{currentDocument.content ? currentDocument.content.split(' ').length : 0} words</strong>. 
                  You can now ask questions about the content within this document.
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  💡 <em>Ask me anything about "{currentDocument.name}"</em>
                </p>
              </>
            )}
          </div>
        )}
        
        {messages.length === 0 && !showDocSummary ? (
          <div className="empty-chat">
            <h3>Start a conversation</h3>
            <p>Ask any question about "{currentDocument.name}"</p>
          </div>
        ) : messages.length > 0 ? (
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
        ) : null}
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
