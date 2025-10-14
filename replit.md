# DocuChat - PDF AI Chat Assistant

## Overview
DocuChat is a simplified PDF chat application enabling users to upload PDF documents, receive AI-generated summaries, and interact with Ollama AI regarding the document content. The project aims to provide a focused and efficient tool for document understanding and interaction, leveraging a modern tech stack.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture
DocuChat employs a client-server architecture:

### UI/UX Decisions
- **Simplified Interface:** Focuses on core PDF interaction, removing extraneous features like theme toggles and complex message actions.
- **Real-Time Feedback:** Incorporates visual progress bars with 5-stage updates and Server-Sent Events (SSE) for live status during AI operations.
- **Improved Loading:** Uses natural bouncing animation for loading indicators.
- **Unified Export:** A single "Export" button with a modal for format selection, combining document summary and conversation history.
- **Actionable Error Messages:** Provides specific and detailed error feedback to the user.
- **Summary Banner:** Displays document summary and prompts upon upload, then hides for cleaner chat.

### Technical Implementations
- **Frontend:** React 18 with Vite, utilizing CSS icons for UI.
- **Backend:** FastAPI (Python) with Uvicorn.
- **File Storage:** In-memory storage using a `FileStorage` class.
- **AI Integration:** Optional Ollama integration for document Q&A and summarization.
- **Text Extraction:** PyMuPDF for PDF text extraction.
- **Streaming:** Enhanced SSE implementation for real-time updates, including keep-alive heartbeats, auto-reconnection logic, and token-by-token progress.
- **Message Management:** Implemented features for editing and deleting user messages, including corresponding AI responses, with backend API support.
- **AI Response Cleaning:** Stack-based scanner removes internal thinking tags (e.g., `<think>`) from AI responses to improve user experience.
- **Error Handling:** Robust error handling for timeouts, connection issues, and Ollama API interactions.
- **File Uploads:** Chunked file reading for larger files (up to 10MB limit).

### Feature Specifications
- **Document Upload:** Supports PDF files only (10MB limit).
- **Optional AI Chat:** Requires Ollama with at least one model installed and selected from the UI.
- **Scope-Limited Responses:** AI answers strictly from document content, rejecting out-of-scope queries.
- **Unified Export:** Exports both document summary and conversation history in PDF, TXT, MD, and JSON formats.
- **Real-Time Progress Tracking:** Visual updates for summary generation (Preparing, Analyzing, Generating, Finalizing, Complete).

### System Design Choices
- **API Endpoints:**
    - `GET /api/documents`
    - `GET /api/documents/{id}`
    - `POST /api/documents/upload`
    - `DELETE /api/documents/{id}`
    - `GET /api/models`
    - `POST /api/chat`
    - `POST /api/documents/{id}/export` (Unified export)
    - `GET /api/documents/{document_id}/summary-status` (SSE endpoint)
    - `PATCH /api/messages/{conversation_id}/{message_id}` (Edit message)
    - `DELETE /api/messages/{conversation_id}/{message_id}` (Delete message)
- **Project Structure:**
    - `client/`: Frontend React application.
    - `app/`: Backend FastAPI application (contains `routes.py`, `document_parser.py`, `file_storage.py`).
    - `main.py`: FastAPI server entry point.
    - `dist/`: Built frontend files.

## External Dependencies

### Frontend
- React 18
- Vite
- Autoprefixer
- PostCSS

### Backend
- `fastapi`
- `uvicorn`
- `python-multipart`
- `pymupdf` (for PDF text extraction)
- `httpx` (for Ollama integration)
- `fpdf2` (for PDF generation in exports)