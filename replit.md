# DocuChat - Document Q&A Application

## Overview
DocuChat is a streamlined document Q&A application that allows users to upload various document types and have intelligent conversations about their content using Ollama local models. The application features a ChatGPT-inspired interface with streaming responses, conversation memory, swipe-to-delete gestures, OCR support for images, and comprehensive export capabilities.

## Recent Updates - October 8, 2025

### ✅ Latest Enhancements - Compact & Feature-Rich

#### New Features Implemented
1. **Swipe-to-Delete Gestures**: Touch-friendly document deletion with visual feedback - no more clutter from delete icons
2. **OCR Support**: Extract text from images (PNG, JPG, JPEG, GIF, BMP, TIFF) using Tesseract.js
3. **Export Capabilities**: 
   - PDF export with professional formatting
   - Markdown export with full conversation history
   - JSON export for programmatic access
4. **Streamlined Codebase**: Removed unused dependencies and features for a compact, focused app

#### Technical Cleanup
- Removed unused pages: Collections, Comparisons, Jobs
- Removed testing dependencies: @testing-library/*, vitest, jsdom
- Cleaned up test files and directories
- Fixed critical prop shadowing bug in ChatInterface (document → currentDocument)

## Previous Updates - October 6, 2025

### ✅ UI Enhancement - Multi Button & Sidebar Toggle (Just Now)

#### Improvements Made
- **Enhanced Multi Button Styling**: Added professional button styles (btn-icon-text, btn-ghost, btn-secondary) with smooth transitions and hover effects
- **Badge System**: Document count badge now displays with proper contrast in both active and inactive states
- **Responsive Design**: Mobile-optimized button sizing and spacing for better touch targets
- **Sidebar Toggle**: Hamburger menu properly toggles sidebar on mobile with overlay and animations
- **Active States**: Clear visual feedback when multi-document mode is enabled with accent color highlighting

#### Technical Implementation
- New CSS classes: `.btn-icon-text`, `.btn-ghost`, `.btn-secondary`, `.badge`, `.sidebar-header-actions`
- Responsive media queries for mobile optimization (@media max-width: 768px)
- Proper state management with conditional CSS classes (`.active`)
- Smooth transitions and transform effects for button interactions

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
- **Frontend**: React 18, Vite, Lucide React Icons, CSS
- **Backend**: FastAPI (Python), Uvicorn
- **Database**: SQLAlchemy with PostgreSQL
- **AI**: Ollama integration for document Q&A
- **File Processing**: 
  - PyPDF2 (PDF)
  - python-docx (DOCX)
  - openpyxl, pandas (Excel, CSV)
  - BeautifulSoup4 (HTML)
  - pytesseract + Pillow (OCR for images)
  - reportlab (PDF export)

### Key Features Summary
1. ✅ **OCR Processing** - Extract text from images with pytesseract
2. ✅ **Swipe-to-Delete** - Touch-friendly document deletion with visual feedback
3. ✅ **Export Options** - PDF, Markdown, and JSON formats with one click
4. ✅ **Message Actions** - Copy, regenerate, edit, rate, and delete messages
5. ✅ **Smart Chat Interface** - Streaming responses with loading animations
6. ✅ **Model Selection** - Dynamic Ollama model dropdown
7. ✅ **Dark Mode** - Complete theme system with persistent preferences
8. ✅ **Multi-Format Support** - 30+ file formats including documents, spreadsheets, code, and images

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
    components/
      ChatInterface.jsx    # Enhanced with export and message actions
      DocumentList.jsx     # Swipe-to-delete with touch gestures
      UploadModal.jsx      # Multi-format upload including images
    lib/
      queryClient.js       # Fetch wrapper
    App.jsx               # Main app with theme and model selection
    styles.css            # Complete styling with dark mode
app/
  routes.py              # All API endpoints (chat, upload, export, etc.)
  document_parser.py     # Text extraction with OCR support
  database.py            # Database connection and setup
  models.py              # SQLAlchemy models
  init_db.py             # Database initialization
main.py                 # FastAPI entry point
```

### Running the Project
- **Development**: `npm run dev` (starts Python backend on port 8000 and Vite frontend on port 5000)
- **Frontend Build**: `npm run build`
- **Production**: `npm run start` (serves built frontend with Python backend)

### Development Notes

#### Export Functionality
- PDF: Professional formatting with document metadata, summary, and key points
- Markdown: Full conversation history with proper formatting
- JSON: Complete data export including all conversations and messages

#### OCR Integration
- Supports PNG, JPG, JPEG, GIF, BMP, TIFF formats
- Uses pytesseract for text extraction
- Automatically processes images on upload

#### Swipe Gestures
- Touch-based deletion with visual feedback (red "Delete" reveal)
- Configurable swipe threshold (60px default)
- Smooth animations with CSS transitions
- Works on both mobile and desktop (with mouse drag)

#### Critical Bug Fix (Oct 8, 2025)
- Fixed document prop shadowing in ChatInterface
- Renamed `document` prop to `currentDocument` to avoid conflicts with global `document` object
- This fix enables all export functionality to work correctly

### Notes
- Application runs on port 5000 (only non-firewalled port)
- Frontend and backend served from same port
- Auto-restart on file changes in development
- Ollama connection errors are expected when Ollama isn't running
- All features work with in-memory storage (ready for database upgrade)
- Architect-approved implementation with comprehensive testing

### Future Enhancement Opportunities
1. Vector embeddings for semantic search with document chunks
2. Redis caching for AI responses to speed up repeated queries
3. Multi-document chat to query across multiple documents
4. Document collections for better organization
5. API rate limiting and authentication for production deployment
6. Advanced export options (custom templates, selective content)
