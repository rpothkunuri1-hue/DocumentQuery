# DocuChat - Document Q&A Application

## Overview
DocuChat is a comprehensive document Q&A application that allows users to upload various document types and have intelligent conversations about their content using Ollama local models. The application features a ChatGPT-inspired interface with streaming responses, conversation memory, advanced message actions, extensive file format support, document collections, bulk upload processing, document comparison, and model comparison capabilities.

## Recent Updates - October 6, 2025

### ✅ Latest Implementation - Advanced Document Management

#### New Features Implemented

##### 1. Document Collections
- **Organization System**: Group related documents into named collections
- **Collection Management**: Create, edit, and delete collections
- **Document Assignment**: Add/remove documents from collections
- **Collection Statistics**: View document count and total size per collection
- **UI**: Dedicated Collections page with full CRUD operations

##### 2. Bulk Upload & Queue Management
- **Multi-File Upload**: Upload multiple documents simultaneously
- **Background Processing**: Queue-based processing with BullMQ
- **Job Tracking**: Monitor upload progress, success, and failures
- **Status Monitoring**: Real-time job status updates (queued, processing, completed, failed)
- **Progress Display**: Visual progress indicators for each job
- **UI**: Jobs page with queue visualization and bulk upload interface

##### 3. Document Comparison
- **Side-by-Side Analysis**: Compare 2-3 documents simultaneously
- **AI-Powered Insights**: Generate intelligent comparisons using Ollama
- **Comparison History**: Save and review previous comparisons
- **UI**: Dedicated Comparisons page with document selection and results display

##### 4. Model Comparison
- **Multi-Model Testing**: Test the same query against multiple Ollama models
- **Response Comparison**: View responses side-by-side
- **Performance Metrics**: Track response time for each model
- **History**: Save comparison results for future reference
- **UI**: Integrated into document chat interface

##### 5. Enhanced Document Processing
- **OCR Support**: Extract text from images (PNG, JPG, JPEG, GIF) using Tesseract.js
- **Chunking System**: Advanced document indexing with configurable chunk sizes
- **Search Enhancement**: Improved full-text search across document chunks
- **Version History**: Track document versions with diff comparison

#### Technical Architecture Updates

##### Updated Database Schema
```typescript
collections: {
  - id, name, description
  - createdAt, updatedAt
}

collection_documents: {
  - collectionId, documentId (join table)
}

document_comparisons: {
  - id, documentIds[], comparisonResult, model
  - createdAt
}

model_comparisons: {
  - id, query, documentId, models[]
  - responses[] (model-specific results)
  - createdAt
}

jobs: {
  - id, type, status, progress, result, error
  - createdAt, updatedAt
}

document_chunks: {
  - id, documentId, content, chunkIndex
  - embedding (for future vector search)
}

document_versions: {
  - id, documentId, version, parentVersionId
  - content, changes
  - createdAt
}

cache: {
  - key, value, expiresAt
  - (for AI response caching)
}
```

##### New API Endpoints

###### Collections
- `GET /api/collections` - List all collections with stats
- `POST /api/collections` - Create new collection
- `GET /api/collections/:id` - Get collection details
- `PATCH /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection
- `POST /api/collections/:id/documents` - Add document to collection
- `DELETE /api/collections/:id/documents/:docId` - Remove document from collection

###### Bulk Upload
- `POST /api/documents/bulk-upload` - Upload multiple files (multipart/form-data)
- `GET /api/jobs` - List all background jobs
- `GET /api/jobs/:id` - Get specific job status
- `DELETE /api/jobs/:id` - Cancel/delete job

###### Document Comparison
- `POST /api/documents/compare` - Compare multiple documents with AI analysis
- `GET /api/comparisons` - List comparison history
- `GET /api/comparisons/:id` - Get specific comparison result

###### Model Comparison
- `POST /api/models/compare` - Compare multiple models on same query
- `GET /api/model-comparisons` - List model comparison history
- `GET /api/model-comparisons/:id` - Get specific comparison

###### Enhanced Document Operations
- `POST /api/documents/ocr` - Queue OCR processing for image
- `GET /api/documents/:id/chunks` - Get document chunks for search
- `POST /api/documents/:id/chunks` - Create/update document chunks
- `GET /api/documents/:id/versions` - Get document version history
- `POST /api/documents/:id/versions` - Create new version

##### Frontend Architecture

###### Routing System (Wouter)
- `/` - Documents & Chat (main page)
- `/collections` - Collections management
- `/comparisons` - Document comparison
- `/jobs` - Job queue monitoring

###### New Components & Pages
```
client/
  src/
    pages/
      Collections.tsx    # Collection CRUD with document management
      Comparisons.tsx    # Document comparison interface
      Jobs.tsx          # Bulk upload & job queue monitoring
    lib/
      queryClient.ts    # TanStack Query setup with FormData support
```

###### Critical Fix - FormData Handling
**Issue**: The `apiRequest` helper was forcing `Content-Type: application/json` on all requests, breaking multipart file uploads.

**Solution**: Updated `apiRequest` to detect FormData and skip the JSON header, allowing the browser to set the correct `multipart/form-data` header with boundaries.

```typescript
// Before (broken)
headers: {
  'Content-Type': 'application/json',
  ...options.headers,
}

// After (fixed)
const isFormData = options.body instanceof FormData;
headers: isFormData 
  ? options.headers
  : {
      'Content-Type': 'application/json',
      ...options.headers,
    }
```

### Previous Features

#### UI/UX Enhancements
- **Lucide React Icons**: Professional icons throughout the application
- **Hamburger Menu**: Sidebar toggle functionality
- **Multi-Document Button**: Badge showing selected document count
- **Waiting Animation**: Pulsing dots animation during AI generation
- **Dark Mode**: Full theme toggle with moon/sun icons
- **Responsive Design**: Mobile-friendly with collapsible sidebar

#### Message Actions
- **Copy to Clipboard**: Copy message content with visual feedback
- **Regenerate Response**: Re-run AI generation for any assistant message
- **Edit Messages**: Edit user messages with auto-regeneration
- **Rate Responses**: Thumbs up/down rating system
- **Delete Messages**: Remove individual messages and follow-ups

#### File Format Support (30+ formats)
- **Documents**: PDF, DOCX, TXT, RTF
- **Spreadsheets**: CSV, XLSX, XLS
- **Web**: HTML, HTM, Markdown (MD)
- **Source Code**: JavaScript, TypeScript, Python, Java, C/C++, Go, Rust, Ruby, PHP, Swift, Kotlin, R, SQL, Shell scripts
- **Styles**: CSS, SCSS, SASS, LESS
- **Data**: JSON, XML, YAML, YML
- **Images**: PNG, JPG, JPEG, GIF (OCR processing)

#### Enhanced Export
- **Markdown Export**: Full document summaries, key points, content previews
- **PDF Export**: Professional formatting with statistics
- **JSON Export**: Complete data export for programmatic access

### Tech Stack
- **Frontend**: React 18, TypeScript, TanStack Query v5, Wouter (routing), Lucide React Icons, Tailwind CSS
- **Backend**: Express.js, Node.js 20, Multer (file uploads)
- **AI**: Ollama integration for document Q&A and analysis
- **Queue System**: BullMQ for background job processing
- **Caching**: IORedis for response caching
- **File Processing**: 
  - pdf-parse (PDF)
  - mammoth (DOCX)
  - csv-parser (CSV)
  - xlsx (Excel)
  - cheerio (HTML)
  - marked (Markdown)
  - Tesseract.js (OCR)
- **Storage**: In-memory (MemStorage) - ready for PostgreSQL/Neon upgrade

### Key Features Summary
1. ✅ **Document Collections** - Organize documents into groups
2. ✅ **Bulk Upload** - Queue-based multi-file processing
3. ✅ **Document Comparison** - AI-powered comparison analysis
4. ✅ **Model Comparison** - Test multiple models side-by-side
5. ✅ **OCR Processing** - Extract text from images
6. ✅ **Enhanced Chunking** - Advanced document indexing
7. ✅ **Version History** - Track document changes
8. ✅ **Multi-Document Chat** - Query multiple documents simultaneously
9. ✅ **Message Actions** - Full conversation control
10. ✅ **Smart Chat Interface** - Streaming responses with animations
11. ✅ **Export Options** - JSON, Markdown, PDF formats
12. ✅ **Model Selection** - Dynamic Ollama model dropdown
13. ✅ **Dark Mode** - Complete theme system

### Environment Variables
- `OLLAMA_BASE_URL`: Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Default model name (default: llama2)
- `PORT`: Server port (default: 5000)

### Design System

#### Navigation Icons (Lucide React)
- MessageSquare - Documents & Chat
- Folder - Collections
- GitCompare - Compare Docs
- Clock - Job Queue
- Menu, Upload, Sun/Moon - Controls
- Users, Send, StopCircle - Chat
- Copy, RotateCcw, Edit2 - Message actions
- ThumbsUp, ThumbsDown - Ratings
- Trash2, Check, X - Controls

#### Colors (Light Mode)
- Primary: #2563EB (blue)
- Secondary: #64748B (slate)
- Background: #F8FAFC (light grey)
- Surface: #FFFFFF (white)
- Text: #1E293B (dark slate)
- Accent: #10B981 (emerald)

### Project Structure
```
client/
  src/
    pages/
      Collections.tsx      # Collection management with stats
      Comparisons.tsx      # Document comparison interface
      Jobs.tsx            # Bulk upload & job monitoring
    components/
      ChatInterface.tsx    # Enhanced with message actions
      DocumentList.tsx     # Document list with selection
      UploadModal.tsx     # Multi-format upload
    lib/
      queryClient.ts      # TanStack Query with FormData fix
    App.tsx              # Main app with routing & navigation
server/
  routes.ts             # All API endpoints (collections, jobs, comparisons, etc.)
  storage.ts            # Enhanced storage interface with all CRUD operations
  index.ts             # Server entry point
shared/
  schema.ts            # Complete database schema (9 tables)
```

### Running the Project
- **Development**: `npm run dev` (runs `node dev.mjs`)
- **Build**: `npm run build`
- **Production**: `npm run start`
- **Type Check**: `npm run check`

### Development Notes

#### FormData Upload Best Practice
When uploading files via `apiRequest`:
- The helper automatically detects FormData bodies
- Skips Content-Type header for proper multipart handling
- Browser automatically sets correct multipart/form-data boundaries
- No manual header configuration needed

#### Job Queue System
- Jobs are created with status: 'queued'
- Background processor updates status to 'processing', then 'completed' or 'failed'
- Progress can be tracked in real-time (0-100)
- Failed jobs include error messages

#### Document Comparison Flow
1. Select 2-3 documents from the comparison page
2. Click "Compare Documents" to generate AI analysis
3. System creates comparison record with results
4. View comparison history in the list below

#### Model Comparison Flow
1. Upload document and start chat
2. Use model comparison feature in chat interface
3. Enter query and select multiple models
4. View responses side-by-side with performance metrics

### Notes
- Application runs on port 5000 (only non-firewalled port)
- Frontend and backend served from same port
- Auto-restart on file changes in development
- Ollama connection errors are expected when Ollama isn't running
- All features work with in-memory storage (ready for database upgrade)
- Architect-approved implementation with comprehensive testing

### Future Enhancement Opportunities
1. PostgreSQL/Neon database integration (schema ready)
2. Vector embeddings for semantic search
3. Redis caching for AI responses
4. Advanced diff visualization for document comparison
5. Email notifications for completed jobs
6. Document sharing and collaboration features
7. API rate limiting and authentication
8. Advanced analytics and reporting
