# DocuChat - Document Q&A Application

## Overview
DocuChat is a comprehensive document Q&A application that allows users to upload various document types and have intelligent conversations about their content using Ollama local models. The application features a ChatGPT-inspired interface with streaming responses, conversation memory, advanced message actions, and extensive file format support.

## Recent Updates - October 6, 2025

### ✅ Completed Features

#### UI/UX Enhancements
- **Lucide React Icons**: Replaced all emoji icons with professional lucide-react icons throughout the application
- **Hamburger Menu**: Fixed and enhanced hamburger button functionality for sidebar toggle
- **Multi-Document Button**: Made interactive with badge showing selected document count
- **Waiting Animation**: Added pulsing dots animation when AI is generating responses
- **Dark Mode**: Full theme toggle with moon/sun icons

#### Message Actions
- **Copy to Clipboard**: Copy any message content with visual feedback
- **Regenerate Response**: Re-run AI generation for any assistant message
- **Edit Messages**: Edit user messages after sending with auto-regeneration
- **Rate Responses**: Thumbs up/down rating system for AI responses
- **Delete Messages**: Remove individual messages and their follow-ups

#### File Format Support
- **Documents**: PDF, DOCX, TXT, RTF
- **Spreadsheets**: CSV, XLSX, XLS
- **Web**: HTML, HTM, Markdown (MD)
- **Source Code**: JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, Ruby, PHP, Swift, Kotlin, R, SQL, Shell scripts
- **Styles**: CSS, SCSS, SASS, LESS
- **Data**: JSON, XML, YAML, YML

#### Enhanced Export
- **Markdown Export**: Includes full document summaries, key points, brief summaries, and content previews
- **PDF Export**: Professional formatting with document summaries, statistics, and conversation history
- **JSON Export**: Complete data export for programmatic access

### Backend Architecture

#### Database Schema
```typescript
documents: {
  - id, name, type, size, content
  - tags, category (for organization)
  - version, parentVersionId (for versioning)
  - summary, briefSummary, keyPoints
  - uploadedAt, updatedAt
}

messages: {
  - id, conversationId, role, content
  - rating (thumbs up/down)
  - edited, originalContent
  - modelUsed
  - createdAt, updatedAt
}

document_chunks: {
  - For indexing and search
  - chunk content, index, embedding
}

cache: {
  - For AI response caching
  - key/value with expiration
}

jobs: {
  - Background processing queue
  - type, status, progress, result
}
```

#### File Processing Pipeline
1. **Upload**: Multi-format file upload with validation
2. **Text Extraction**: Format-specific extractors for each file type
3. **Auto-Summarization**: AI-generated summaries, key points, and brief summaries
4. **Storage**: In-memory storage (ready for database upgrade)

### Tech Stack
- **Frontend**: React 18, TypeScript, Lucide React Icons, Tailwind CSS
- **Backend**: Express.js, Node.js 20
- **AI**: Ollama integration for document Q&A
- **File Processing**: 
  - pdf-parse (PDF)
  - mammoth (DOCX)
  - csv-parser (CSV)
  - xlsx (Excel)
  - cheerio (HTML)
  - marked (Markdown)
- **Additional**: Bull/BullMQ (job queue), IORedis (caching), Tesseract.js (OCR)

### Key Features
1. **Document Upload**: Drag-and-drop interface with extensive file type support
2. **Multi-Document Chat**: Compare and query multiple documents simultaneously
3. **Message Actions**: Full control over conversation (copy, edit, regenerate, rate, delete)
4. **Smart Chat Interface**: 
   - Real-time streaming responses
   - Loading animations
   - Progress metrics
   - Stop generation support
5. **Export Options**: JSON, Markdown, and PDF with enhanced summaries
6. **Model Selection**: Dynamic Ollama model dropdown with fallback options
7. **Responsive Design**: Mobile-friendly with collapsible sidebar
8. **Dark Mode**: Complete theme system with persistence

### Infrastructure Ready For:
- **Document Tags/Categories**: Schema and storage ready
- **Document Versioning**: Schema supports version tracking
- **Bulk Upload**: Queue system infrastructure installed
- **Caching Layer**: Redis integration ready
- **Background Processing**: BullMQ infrastructure installed
- **OCR Processing**: Tesseract.js installed for image text extraction
- **Document Chunking**: Schema supports chunk storage and indexing
- **Model Comparison**: UI can be extended for side-by-side comparison

### API Endpoints

#### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get single document
- `POST /api/documents/upload` - Upload and process document (all formats)
- `DELETE /api/documents/:id` - Delete document

#### Conversations
- `GET /api/conversations/:documentId` - Get or create conversation
- `POST /api/conversations/multi` - Create multi-document conversation

#### Messages
- `GET /api/messages/:conversationId` - Get conversation messages
- `POST /api/chat` - Send question and stream response
- `POST /api/chat/multi` - Multi-document chat with streaming
- `PATCH /api/messages/:id` - Update message (for edits)
- `DELETE /api/messages/:id` - Delete message
- `PATCH /api/messages/:id/rate` - Rate message

#### Export
- `GET /api/export/:conversationId?format=json|markdown|pdf` - Export conversation

#### Models
- `GET /api/models` - Get available Ollama models

### Development Notes

#### File Upload Processing
The system now supports 30+ file formats:
- Binary formats (PDF, DOCX, XLSX) use specialized parsers
- Text formats (TXT, MD, CSV) use UTF-8 decoding
- HTML uses cheerio for clean text extraction
- RTF uses regex-based cleanup
- Source code files are preserved with syntax information

#### Message Action Implementation
- Each message displays action buttons on hover
- Copy provides visual feedback (checkmark for 2 seconds)
- Edit mode switches UI to textarea with save/cancel
- Regenerate re-sends previous user question
- Rate toggles between thumbs up/down/none
- Delete removes message and all subsequent messages

#### Export Enhancement
- Markdown includes comprehensive document summaries
- PDF features professional formatting with sections
- Both formats include conversation statistics
- Document summaries show: brief summary, full summary, key points, content preview

### Environment Variables
- `OLLAMA_BASE_URL`: Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Default model name (default: llama2)
- `PORT`: Server port (default: 5000)

### Design System

#### Colors (Light Mode)
- Primary: #2563EB (blue)
- Secondary: #64748B (slate)
- Background: #F8FAFC (light grey)
- Surface: #FFFFFF (white)
- Text: #1E293B (dark slate)
- Accent: #10B981 (emerald)

#### Icons (Lucide React)
- Menu, Upload, Sun/Moon (theme)
- Users (multi-doc mode)
- Send, StopCircle (chat)
- Copy, RotateCcw, Edit2 (message actions)
- ThumbsUp, ThumbsDown (ratings)
- Trash2, Check, X (controls)

### Future Enhancements
The infrastructure is in place for:
1. Document comparison with diff visualization
2. Bulk upload with progress tracking
3. Full-text search across documents
4. Redis-based response caching
5. Background job processing for heavy operations
6. OCR for scanned PDFs and images
7. Document versioning with rollback
8. Multi-model comparison interface

### Project Structure
```
client/
  src/
    components/
      ChatInterface.tsx     # Enhanced with message actions
      DocumentList.tsx      # Document list with selection
      UploadModal.tsx      # Multi-format upload
    App.tsx               # Main app with lucide icons
server/
  routes.ts              # All API endpoints with new formats
  storage.ts             # Enhanced storage interface
  index.ts              # Server entry point
shared/
  schema.ts             # Complete database schema
```

### Running the Project
- **Development**: `npm run dev` (runs `node dev.mjs`)
- **Build**: `npm run build`
- **Production**: `npm run start`
- **Type Check**: `npm run check`

### Notes
- Application runs on port 5000 (only non-firewalled port)
- Frontend and backend served from same port
- Auto-restart on file changes in development
- Ollama connection errors are expected when Ollama isn't running
