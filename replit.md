# DocuChat - Document Q&A Application

## Overview
DocuChat is a streamlined document Q&A application enabling intelligent conversations with uploaded documents using local Ollama models. It offers a ChatGPT-inspired interface, featuring streaming responses, conversation memory, OCR support for images, and comprehensive export capabilities. The project aims to provide an efficient and intuitive tool for users to interact with their documents.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder Z. Do not make changes to the file Y.

## System Architecture
DocuChat employs a client-server architecture. The frontend is built with React 18 and Vite, utilizing Lucide React Icons for a professional UI/UX, and features a comprehensive dark mode. The backend is powered by FastAPI (Python) with Uvicorn, using SQLAlchemy for database interactions (currently in-memory, designed for PostgreSQL). Ollama is integrated for local AI model inference.

**UI/UX Decisions:**
- **Design System:** Uses a custom color palette (Primary: #2563EB, Secondary: #64748B, Background: #F8FAFC, Surface: #FFFFFF, Text: #1E293B, Accent: #10B981 in light mode).
- **Responsive Design:** Mobile-friendly with collapsible sidebar and touch-friendly gestures (e.g., swipe-to-delete).
- **Interactive Elements:** Features like multi-document selection badges, pulsing waiting animations, copy-to-clipboard, regenerate response, edit messages, rate responses, and delete messages.
- **Export Options:** PDF export with professional formatting, Markdown export for conversation history, and JSON export for programmatic access.

**Technical Implementations & Feature Specifications:**
- **Document Management:** Supports over 30 file formats including PDFs, TXT, spreadsheets (Excel), web formats (HTML, MD), and various source code files. OCR is implemented for image file types (PNG, JPG, JPEG, GIF, BMP, TIFF) using `pytesseract`. Note: DOCX support removed to reduce dependencies.
- **Chat Interface:** Provides streaming AI responses, dynamic Ollama model selection, and full conversation memory.
- **Data Handling:** Advanced document indexing with configurable chunking system for improved search.
- **Error Handling:** Graceful handling of Ollama connection errors.
- **Project Structure:**
    - `client/`: Frontend React application (`components/`, `lib/`, `pages/`, `styles.css`, `App.jsx`).
    - `app/`: Backend FastAPI application (`routes.py`, `document_parser.py`, `database.py`, `models.py`, `init_db.py`).
    - `main.py`: FastAPI entry point.

**System Design Choices:**
- **Database Schema (planned):** Includes tables for `collections`, `collection_documents`, `document_comparisons`, `model_comparisons`, `jobs`, `document_chunks`, `document_versions`, and `cache`.
- **API Endpoints (planned):** Comprehensive RESTful API for collections, bulk upload, document comparison, model comparison, and enhanced document operations.
- **Frontend Routing:** Uses Wouter for client-side routing (`/`, `/collections`, `/comparisons`, `/jobs`).

## External Dependencies
- **Frontend:** React 18, Vite, Wouter (routing), Lucide React Icons, TanStack Query.
- **Backend:** FastAPI, Uvicorn, SQLAlchemy, PyPDF2, python-docx, openpyxl, pandas, BeautifulSoup4, pytesseract, Pillow, reportlab, Ollama (local model integration).