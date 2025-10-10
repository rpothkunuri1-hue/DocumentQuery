# DocuChat - Basic Document Viewer

## Overview
DocuChat is a simplified document viewer application that allows users to upload and view PDF and TXT files with optional AI chat features. The project uses a modern tech stack with React for the frontend and FastAPI for the backend.

## Recent Changes (October 10, 2025)
- **Import Complete:** Successfully migrated project to Replit environment with all dependencies installed
- **Fixed Ollama 500 Error (NEW):** Enhanced error handling for Ollama API integration
  - Added specific error handling for 404 (model not found), 500 (server error), and connection errors
  - Detailed logging helps diagnose Ollama configuration issues
  - Prevents crashes when Ollama is unavailable or misconfigured
- **Fixed Multiple Polling Issue (NEW):** Resolved duplicate summary API calls
  - Fixed polling interval cleanup to prevent multiple simultaneous requests
  - Added error handling to stop polling on failures
  - Removed non-existent function call that was causing errors
- **Fixed Upload Error:** Resolved "unexpected keyword argument" error in FileStorage
  - Added summary_status field to default document structure
  - Fixed upload flow to properly handle summary generation status
- **Fixed Large File Upload Issue:** Resolved upload failures for files > 2MB
  - Implemented chunked file reading (1MB chunks) instead of reading entire file at once
  - Added proper 413 status code for files exceeding 10MB limit
  - Improved error messages to clearly indicate when file size limit is exceeded
  - Better memory management for handling larger files up to 10MB
- **App Naming Consistency (NEW):** Updated all references to use "DocuChat" branding
  - Changed package.json name from "rest-express" to "docuchat"
  - Consistent naming across frontend, backend, and documentation
- **Improved Loading Animation (NEW):** Replaced loading dots with natural bouncing animation
  - Changed from simple pulse animation to smooth bouncing dots
  - Custom keyframe animation for better visual feedback
  - Staggered animation delay creates natural wave effect
- **Fixed PDF Export Error:** Resolved 500 error by converting fpdf2 bytearray output to bytes for FastAPI Response
- **Unified Export System:** Complete redesign of export functionality
  - Merged document summary and conversation history into single export files
  - All formats (PDF, TXT, MD, JSON) now include both document content and chat history
  - Replaced 4 separate export buttons with ONE unified "Export" button
  - Added modal popup for format selection with clear descriptions
  - Improved file naming and error handling
- **Document Summary on Upload:** Automatic summary display when document loads
  - Shows word count and document information
  - Prompts user to ask questions about the document
  - Hides after first message to keep chat clean
- **Enhanced Error Handling:** Specific, actionable error messages
  - Error banner displays at top of chat with dismiss button
  - Backend provides detailed error descriptions
  - No more generic error messages
- **Scope Validation:** AI strictly answers only from document content
  - System validates document has sufficient content
  - Explicit refusal of out-of-scope questions
  - Post-response verification for accuracy
- **Previous Updates:**
  - Simplified to Basic App: PDF and TXT files only
  - Removed lucide-react icon library, using pure CSS icons
  - Streamlined upload flow with auto-upload on file selection
  - Enhanced UI design with gradient header and improved aesthetics

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
- **Scope-Limited Responses:** AI only answers questions from document content, rejects out-of-scope queries
- **API Endpoints:**
  - `GET /api/documents` - List all documents
  - `GET /api/documents/{id}` - Get single document
  - `POST /api/documents/upload` - Upload PDF or TXT file
  - `DELETE /api/documents/{id}` - Delete document
  - `GET /api/models` - Get available Ollama models
  - `POST /api/chat` - Chat with document (requires model selection)
  - **`POST /api/documents/{id}/export`** - **NEW: Unified export with summary & conversation (PDF/TXT/MD/JSON)**
  - `GET /api/documents/{id}/export/{format}` - Legacy export endpoints (deprecated)
  - `GET /api/documents/{id}/summary/pdf` - Legacy summary download (deprecated)

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
- PDF and TXT file upload and processing (10MB limit)
- Document listing and deletion
- Dynamic model selection from Ollama
- **NEW: Unified export system** - Single button exports both summary and conversation in PDF/TXT/MD/JSON
- **NEW: Document summary banner** - Shows word count and prompts on upload
- **NEW: Specific error messages** - Detailed, actionable error feedback
- **NEW: Scope validation** - AI only answers from document content

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

**Frontend (6 packages):**
- React 18, Vite (removed Lucide React Icons - using CSS icons instead)
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

1. **Fixed Large File Uploads:** Chunked reading prevents failures for files > 2MB (up to 10MB supported)
2. **Consistent Branding:** All references now use "DocuChat" naming across the entire application
3. **Natural Loading Animation:** Smooth bouncing dots replace simple pulse animation for better UX
4. **Unified Export System:** All export formats include both document summary and conversation history
5. **Single Export Button:** Replaced 4 buttons with 1 unified button + modal for better UX
6. **Document Summary on Upload:** Users immediately see word count and are prompted to ask questions
7. **Specific Error Messages:** Detailed error feedback instead of generic messages
8. **Scope Validation:** AI strictly answers only from document content, no out-of-scope responses
9. **No Hardcoded Models:** Backend no longer defaults to 'llama2', preventing 404 errors
10. **Dynamic Model Detection:** UI automatically detects and displays installed Ollama models
11. **Local-First Design:** No Replit-specific code, runs perfectly on local systems

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
