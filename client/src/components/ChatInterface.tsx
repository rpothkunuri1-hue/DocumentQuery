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
  documentId: string;
}

interface Props {
  document: Document;
}

export default function ChatInterface({ document }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ollama-model') || 'llama2';
    }
    return 'llama2';
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ollama-model', selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadConversation();
  }, [document.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    try {
      const convResponse = await fetch(`/api/conversations/${document.id}`);
      const conversation: Conversation = await convResponse.json();
      setConversationId(conversation.id);

      const messagesResponse = await fetch(`/api/messages/${conversation.id}`);
      const messagesData = await messagesResponse.json();
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          conversationId,
          question,
          model: selectedModel,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let messageId: string | null = null;

      if (!reader) throw new Error('No reader');

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
              } else if (data.type === 'done') {
                setIsStreaming(false);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-content">
          <h2>{document.name}</h2>
          <p>Ask questions about this document</p>
        </div>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          className="model-selector"
          disabled={isStreaming}
        >
          <option value="llama2">Llama 2</option>
          <option value="llama3">Llama 3</option>
          <option value="llama3.1">Llama 3.1</option>
          <option value="mistral">Mistral</option>
          <option value="mixtral">Mixtral</option>
          <option value="codellama">Code Llama</option>
          <option value="gemma">Gemma</option>
          <option value="phi">Phi</option>
        </select>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h3>Start a conversation</h3>
            <p>Ask any question about "{document.name}"</p>
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
          placeholder="Ask a question..."
          disabled={isStreaming}
        />
        <button type="submit" className="btn-send" disabled={!input.trim() || isStreaming}>
          ➤
        </button>
      </form>
    </div>
  );
}
