# DocuChat - Basic Document Viewer

## Overview
DocuChat is a simplified document viewer application that allows users to upload and view PDF and TXT files. The project uses a modern tech stack with React for the frontend and FastAPI for the backend.

## Recent Changes (October 10, 2025)
- **Simplified to Basic App:** Removed support for multiple file formats. Now only supports PDF and TXT files.
- **Removed Dependencies:** Cleaned up unnecessary libraries (openpyxl, beautifulsoup4, etc.)
- **Core Features Working:** Document upload, PDF/TXT text extraction, and basic viewing functionality.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture
DocuChat employs a client-server architecture:
- **Frontend:** Built with React 18 and Vite, utilizing Lucide React Icons for UI
- **Backend:** Powered by FastAPI (Python) with Uvicorn
- **File Storage:** In-memory storage using FileStorage class

**Current Features:**
- **Document Upload:** Supports PDF and TXT files (10MB limit)
- **Text Extraction:** 
  - PDF: Uses PyMuPDF (pymupdf) for text extraction
  - TXT: Direct text file reading with UTF-8 encoding
- **API Endpoints:**
  - `GET /api/documents` - List all documents
  - `GET /api/documents/{id}` - Get single document
  - `POST /api/documents/upload` - Upload PDF or TXT file
  - `DELETE /api/documents/{id}` - Delete document
  - `GET /api/models` - Get available Ollama models (optional AI feature)

**Project Structure:**
- `client/`: Frontend React application
  - `src/components/`: React components (ChatInterface, DocumentList, UploadModal)
  - `src/App.jsx`: Main application component
  - `src/main.jsx`: Entry point
- `app/`: Backend FastAPI application
  - `routes.py`: API endpoints
  - `document_parser.py`: PDF and TXT text extraction
  - `file_storage.py`: In-memory document storage
- `main.py`: FastAPI server entry point
- `dist/`: Built frontend files (served by backend)

## Current Status
✅ **Working:**
- Backend server running on port 5000
- Frontend built and served successfully
- PDF and TXT file upload and processing
- Document listing and deletion

⚠️ **Optional (Not Required for Basic App):**
- Ollama AI integration (for chat features) - currently not configured
- Advanced features like document comparison, collections, etc.

## Dependencies
**Frontend:**
- React 18, Vite, Lucide React Icons

**Backend (Python):**
- fastapi - Web framework
- uvicorn - ASGI server
- python-multipart - File upload handling
- pymupdf - PDF text extraction
- httpx - HTTP client (for optional Ollama integration)
- fpdf2 - PDF generation (for exports)

## Next Steps
The basic app is ready! You can now:
1. Upload PDF and TXT files
2. View extracted text from documents
3. Manage your documents (list, delete)

If you need AI chat features, you'll need to configure Ollama service.
