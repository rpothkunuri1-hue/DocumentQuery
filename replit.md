# DocuChat - Basic Document Viewer

## Overview
DocuChat is a simplified document viewer application that allows users to upload and view PDF and TXT files with optional AI chat features. The project uses a modern tech stack with React for the frontend and FastAPI for the backend.

## Recent Changes (October 10, 2025)
- **Simplified to Basic App:** Removed support for multiple file formats. Now only supports PDF and TXT files.
- **Removed Dependencies:** Cleaned up unnecessary libraries (openpyxl, beautifulsoup4, etc.)
- **Fixed Ollama Integration:** Removed hardcoded model defaults - users must select a model from UI
- **Disabled Auto-Summary:** Removed automatic summary generation to avoid model dependency issues
- **Local Development Ready:** No Replit-specific dependencies, runs fully on local systems
- **Core Features Working:** Document upload, PDF/TXT text extraction, and basic viewing functionality

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture
DocuChat employs a client-server architecture:
- **Frontend:** Built with React 18 and Vite, utilizing Lucide React Icons for UI
- **Backend:** Powered by FastAPI (Python) with Uvicorn
- **File Storage:** In-memory storage using FileStorage class
- **AI Integration:** Optional Ollama integration for document Q&A

**Current Features:**
- **Document Upload:** Supports PDF and TXT files (10MB limit)
- **Text Extraction:** 
  - PDF: Uses PyMuPDF (pymupdf) for text extraction
  - TXT: Direct text file reading with UTF-8 encoding
- **Optional AI Chat:** Requires Ollama with at least one model installed and selected from UI
- **API Endpoints:**
  - `GET /api/documents` - List all documents
  - `GET /api/documents/{id}` - Get single document
  - `POST /api/documents/upload` - Upload PDF or TXT file
  - `DELETE /api/documents/{id}` - Delete document
  - `GET /api/models` - Get available Ollama models
  - `POST /api/chat` - Chat with document (requires model selection)
  - `GET /api/documents/{id}/export/{format}` - Export as JSON, Markdown, or PDF

**Project Structure:**
- `client/`: Frontend React application
  - `src/components/`: React components (ChatInterface, DocumentList, UploadModal)
  - `src/App.jsx`: Main application component with dynamic model selection
  - `src/main.jsx`: Entry point
- `app/`: Backend FastAPI application
  - `routes.py`: API endpoints
  - `document_parser.py`: PDF and TXT text extraction
  - `file_storage.py`: In-memory document storage
- `main.py`: FastAPI server entry point
- `dist/`: Built frontend files (served by backend)

## Current Status

### ✅ Working Features:
- Backend server running on port 5000 (Replit) or 8000 (local)
- Frontend built and served successfully
- PDF and TXT file upload and processing
- Document listing and deletion
- Dynamic model selection from Ollama
- Export to JSON, Markdown, and PDF

### ⚠️ Configuration Required:
- **Ollama Setup (for AI chat):**
  - Install Ollama service
  - Pull at least one model: `ollama pull llama3.2`
  - Select model from UI dropdown (no hardcoded defaults)
  - Model selection is mandatory for chat features

### 🔧 Local Development:
**Two terminal setup required:**
- Terminal 1: `npm run dev:backend` (port 8000)
- Terminal 2: `npm run dev` (port 5000)
- Frontend proxies API requests to backend automatically

## Dependencies

**Frontend (7 packages):**
- React 18, Vite, Lucide React Icons
- Autoprefixer, PostCSS

**Backend (6 Python packages):**
- fastapi - Web framework
- uvicorn - ASGI server
- python-multipart - File upload handling
- pymupdf - PDF text extraction
- httpx - HTTP client (for Ollama integration)
- fpdf2 - PDF generation (for exports)

**Total: ~100 packages (including dependencies)**
- Backend: ~25-30 packages
- Frontend: ~74 packages
- All necessary, no redundancies

## Key Improvements Made

1. **No Hardcoded Models:** Backend no longer defaults to 'llama2', preventing 404 errors
2. **Dynamic Model Detection:** UI automatically detects and displays installed Ollama models
3. **Clear Error Messages:** Users get helpful feedback when no model is selected
4. **Local-First Design:** No Replit-specific code, runs perfectly on local systems
5. **Simplified Documentation:** Updated setup.sh and README for clarity

## Troubleshooting

**Ollama 404 Error:**
- Ensure Ollama is running: `ollama serve`
- Check models are installed: `ollama list`
- Select a model from the UI dropdown (required!)

**Export 500 Error:**
- Make sure you have a conversation first (ask at least one question)
- Exports require existing conversation data

**Frontend Connection Errors:**
- Backend must be running on port 8000 (local dev)
- Frontend runs on port 5000 and proxies to backend

## Next Steps
The basic app is ready for both Replit and local development! 

**To use:**
1. Upload PDF and TXT files
2. View extracted text from documents
3. (Optional) Configure Ollama and select a model for AI chat
4. Export conversations as needed

**For local development:**
- See `README_LOCAL_SETUP.md` for detailed instructions
- See `setup.sh` for automated setup
