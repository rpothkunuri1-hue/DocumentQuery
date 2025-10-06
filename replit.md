# DocuChat - Document Q&A Application

## Overview
DocuChat is a web-based document Q&A application that allows users to upload documents (PDF, TXT, DOCX) and have intelligent conversations about their content using Ollama local models. The application features a ChatGPT-inspired interface with streaming responses, conversation memory, and beautiful animations.

## Recent Changes
- **2024-10-06**: Complete MVP implementation finished
  - Frontend: ChatGPT-inspired UI with sidebar, chat interface, document upload, streaming animations
  - Backend: Full API implementation with document processing, Ollama integration, streaming responses
  - Schema: Defined documents, conversations, and messages models
  - Storage: In-memory storage with full CRUD operations
  - Design: Implemented exact color scheme (#2563EB primary, #F8FAFC background, #10B981 accent)
  - Integration: Complete end-to-end flow with SSE streaming and conversation memory
  - Status: ✅ Ready for use (requires Ollama running locally)

## Project Architecture

### Tech Stack
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **AI**: Ollama integration for document Q&A
- **Storage**: In-memory (MemStorage) - ready for database upgrade
- **Styling**: Tailwind CSS with custom design tokens

### Key Features
1. **Document Upload**: Drag-and-drop interface with support for PDF, TXT, DOCX
2. **Document Processing**: Cached processing to avoid reprocessing
3. **Chat Interface**: ChatGPT-inspired with message bubbles and streaming
4. **Streaming Responses**: Real-time typing animations with cursor blink
5. **Conversation Memory**: Maintains context across questions
6. **Sidebar Management**: Document list with status indicators
7. **Responsive Design**: Mobile-friendly with collapsible sidebar

### Project Structure
```
client/
  src/
    components/
      app-sidebar.tsx         # Document list sidebar
      chat-interface.tsx      # Main chat UI with streaming
      document-upload.tsx     # Upload modal with drag-and-drop
      message-bubble.tsx      # Individual message component
      typing-indicator.tsx    # Animated typing dots
    pages/
      home.tsx               # Main app layout
shared/
  schema.ts                  # Data models and types
server/
  storage.ts                 # Storage interface
  routes.ts                  # API endpoints (to be implemented)
```

## Environment Variables
- `OLLAMA_BASE_URL`: Ollama server URL (e.g., http://localhost:11434)
- `OLLAMA_MODEL`: Model name (e.g., llama2, mistral, phi)

## Design System

### Colors
- Primary: #2563EB (blue)
- Secondary: #64748B (slate)
- Background: #F8FAFC (light grey)
- Surface: #FFFFFF (white) - user messages
- Surface Secondary: #F1F5F9 (light blue-grey) - AI messages
- Text: #1E293B (dark slate)
- Accent: #10B981 (emerald) - success indicators

### Typography
- Font: Inter
- Headings: text-2xl font-semibold
- Body: text-base
- Small: text-sm
- Tiny: text-xs

### Animations
- Streaming text: Character-by-character with 20ms delay
- Message entrance: Fade-in + slide-up (200ms)
- Typing indicator: Bouncing dots with stagger
- Cursor blink: 1s interval

## API Endpoints (To Be Implemented)

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents/upload` - Upload and process document

### Conversations
- `GET /api/conversations/:documentId` - Get or create conversation

### Messages
- `GET /api/messages/:conversationId` - Get conversation messages
- `POST /api/chat` - Send question and stream response

## Development Notes

### Document Processing
- Extract text from PDF, TXT, DOCX
- Store processed content for quick retrieval
- Cache to prevent reprocessing

### Ollama Integration
- Use conversation context for better answers
- Stream responses token-by-token
- Maintain conversation memory

### Next Steps
1. Implement backend API endpoints
2. Add document text extraction
3. Integrate Ollama for Q&A
4. Add streaming response handling
5. Test end-to-end flow
