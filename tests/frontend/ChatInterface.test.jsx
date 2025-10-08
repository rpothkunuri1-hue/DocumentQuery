/**
 * Tests for ChatInterface component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatInterface from '../../client/src/components/ChatInterface';


// Mock fetch globally
global.fetch = vi.fn();

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Wrapper component for tests
const wrapper = ({ children }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('ChatInterface', () => {
  const mockDocument = {
    id: 'test-doc-1',
    name: 'Test Document.txt',
    content: 'This is test content',
    uploadedAt: new Date().toISOString(),
  };

  const mockSelectedModel = 'llama2';

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.clearAllMocks();
    
    // Mock conversation API
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/conversations/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'conv-1',
            documentId: 'test-doc-1',
          }),
        });
      }
      
      if (url.includes('/api/messages/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('renders document name in header', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('text-header')).toHaveTextContent('Test Document.txt');
    });
  });

  it('shows empty chat message when no messages', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
      expect(screen.getByText(/Ask any question about/i)).toBeInTheDocument();
    });
  });

  it('renders chat input form', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      const input = screen.getByTestId('input-question');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Ask a question...');
    });
  });

  it('disables send button when input is empty', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      const sendButton = screen.getByTestId('button-send');
      expect(sendButton).toBeDisabled();
    });
  });

  it('enables send button when input has text', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(async () => {
      const input = screen.getByTestId('input-question');
      fireEvent.change(input, { target: { value: 'What is this document about?' } });
      
      const sendButton = screen.getByTestId('button-send');
      expect(sendButton).not.toBeDisabled();
    });
  });


  it('shows model name in header subtitle', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Using llama2/i)).toBeInTheDocument();
    });
  });

  it('loads conversation on mount', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel={mockSelectedModel} />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/conversations/${mockDocument.id}`)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/messages/')
      );
    });
  });
});


describe('ChatInterface - Message Rendering', () => {
  const mockDocument = {
    id: 'test-doc-1',
    name: 'Test Document.txt',
    content: 'This is test content',
    uploadedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock with existing messages
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/conversations/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'conv-1',
            documentId: 'test-doc-1',
          }),
        });
      }
      
      if (url.includes('/api/messages/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Hi there!',
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      }
      
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('renders user and assistant messages', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel="llama2" />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('message-user-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-assistant-msg-2')).toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('shows message action buttons for assistant messages', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel="llama2" />,
      { wrapper }
    );
    
    await waitFor(() => {
      const assistantMessage = screen.getByTestId('message-assistant-msg-2');
      expect(assistantMessage).toBeInTheDocument();
      
      // Check for action buttons within the assistant message
      expect(screen.getByTestId('button-copy-msg-2')).toBeInTheDocument();
      expect(screen.getByTestId('button-regenerate-msg-2')).toBeInTheDocument();
      expect(screen.getByTestId('button-thumbs-up-msg-2')).toBeInTheDocument();
      expect(screen.getByTestId('button-thumbs-down-msg-2')).toBeInTheDocument();
    });
  });

  it('shows edit button for user messages', async () => {
    render(
      <ChatInterface document={mockDocument} selectedModel="llama2" />,
      { wrapper }
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('button-edit-msg-1')).toBeInTheDocument();
    });
  });
});
