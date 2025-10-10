# Project Dependencies Documentation

This document lists all dependencies used in the DocuChat application, organized by frontend and backend, with their purposes and usage.

---

## Backend Dependencies (Python)

### Core Framework
- **fastapi** (v0.118.3)
  - Purpose: Modern, fast web framework for building APIs
  - Usage: Main backend framework for handling HTTP requests, routing, and API endpoints
  - Key features: Automatic API documentation, async support, data validation

- **uvicorn** (v0.37.0)
  - Purpose: ASGI server implementation
  - Usage: Serves the FastAPI application in production and development
  - Key features: Fast, async, supports websockets and SSE (Server-Sent Events)

### File Handling & Processing
- **python-multipart** (v0.0.20)
  - Purpose: Multipart form data parsing
  - Usage: Handles file uploads in the document upload endpoint
  - Key features: Efficient file upload handling, memory management

- **pymupdf** (v1.26.4)
  - Purpose: PDF manipulation library
  - Usage: Extracts text content from PDF files during document upload
  - Key features: Fast PDF parsing, text extraction, supports various PDF formats

### HTTP & API Communication
- **httpx** (v0.28.1)
  - Purpose: Modern HTTP client for Python
  - Usage: Makes async HTTP requests to Ollama API for AI model interactions
  - Key features: Async/await support, HTTP/2, streaming responses
  - Dependencies:
    - anyio (v4.11.0): Async I/O support
    - certifi (v2025.10.5): SSL certificate verification
    - httpcore (v1.0.9): Core HTTP functionality
    - idna (v3.10): Internationalized domain names support

### Document Export
- **fpdf2** (v2.8.4)
  - Purpose: PDF generation library
  - Usage: Exports chat conversations to PDF format
  - Key features: Custom layouts, Unicode support, image embedding
  - Dependencies:
    - defusedxml (v0.7.1): Secure XML processing
    - Pillow (v11.3.0): Image processing and manipulation
    - fonttools (v4.60.1): Font file handling and manipulation

### Data Validation & Type Checking
- **pydantic** (v2.12.0)
  - Purpose: Data validation using Python type annotations
  - Usage: Request/response validation, data models for API endpoints
  - Key features: Automatic validation, JSON schema generation, type safety
  - Dependencies:
    - annotated-types (v0.7.0): Type annotation utilities
    - pydantic-core (v2.41.1): Core validation engine
    - typing-inspection (v0.4.2): Runtime type inspection

### Supporting Libraries
- **starlette** (v0.48.0)
  - Purpose: Lightweight ASGI framework (FastAPI dependency)
  - Usage: Provides core web functionality for FastAPI
  - Key features: Routing, middleware, responses

- **typing-extensions** (v4.15.0)
  - Purpose: Backported typing features
  - Usage: Provides advanced type hints for older Python versions
  - Key features: TypedDict, Protocol, Literal types

- **click** (v8.3.0)
  - Purpose: Command-line interface creation (Uvicorn dependency)
  - Usage: CLI for uvicorn server commands
  - Key features: Parameter parsing, help text generation

- **h11** (v0.16.0)
  - Purpose: Pure Python HTTP/1.1 protocol implementation
  - Usage: Low-level HTTP protocol handling in uvicorn
  - Key features: HTTP parsing and serialization

- **sniffio** (v1.3.1)
  - Purpose: Async library detection
  - Usage: Detects which async library is being used (asyncio, trio, etc.)
  - Key features: Runtime async detection

---

## Frontend Dependencies (JavaScript/Node.js)

### Core Framework
- **react** (v18.3.1)
  - Purpose: JavaScript library for building user interfaces
  - Usage: Core UI framework, component-based architecture
  - Key features: Virtual DOM, hooks, component lifecycle

- **react-dom** (v18.3.1)
  - Purpose: React renderer for web applications
  - Usage: Renders React components to the browser DOM
  - Key features: DOM reconciliation, event handling

### Build Tools
- **vite** (v5.4.20)
  - Purpose: Next-generation frontend build tool
  - Usage: Development server, hot module replacement, production builds
  - Key features: Fast HMR, optimized builds, ES modules support

- **@vitejs/plugin-react** (v4.7.0)
  - Purpose: Vite plugin for React support
  - Usage: Enables React Fast Refresh and JSX transformation in Vite
  - Key features: Fast Refresh, JSX support, optimized development

### Styling
- **postcss** (v8.4.47)
  - Purpose: CSS transformation tool
  - Usage: Processes CSS, enables modern CSS features
  - Key features: Plugin system, CSS parsing and transformation

- **autoprefixer** (v10.4.20)
  - Purpose: PostCSS plugin to add vendor prefixes
  - Usage: Automatically adds browser-specific prefixes to CSS
  - Key features: Browser compatibility, automatic prefixing

---

## Development Workflow

### Backend Development
1. **File Upload Flow**: 
   - `python-multipart` receives file → `pymupdf` extracts text (PDF) → Store in memory

2. **AI Chat Flow**:
   - `httpx` sends request to Ollama → Stream response → Update storage

3. **Export Flow**:
   - Retrieve conversation → `fpdf2` generates PDF → Return to client

### Frontend Development
1. **Development Server**:
   - `vite` serves app → Hot reload on changes → Fast development

2. **Build Process**:
   - `vite` bundles code → `@vitejs/plugin-react` processes JSX → Optimized output
   - `postcss` + `autoprefixer` process CSS → Cross-browser compatible styles

---

## Total Dependency Count

- **Backend (Python)**: 6 direct + 16 transitive = 22 total packages
- **Frontend (JavaScript)**: 6 packages (2 runtime + 4 dev)
- **Grand Total**: 28 packages

---

## Key Integration Points

1. **File Processing Pipeline**:
   - Upload (multipart) → Parse (pymupdf) → Store (in-memory) → AI (httpx/Ollama) → Export (fpdf2)

2. **Real-time Communication**:
   - FastAPI SSE → EventSource (browser) → Streaming AI responses

3. **Build & Deploy**:
   - Vite builds frontend → FastAPI serves static files → Single deployment artifact

---

## Security Considerations

- **certifi**: Ensures secure HTTPS connections to Ollama API
- **defusedxml**: Prevents XML bomb attacks during PDF processing
- **python-multipart**: Handles file uploads securely with size limits
- **FastAPI**: Built-in request validation and security features

---

## Performance Optimizations

- **Async/Await**: httpx, FastAPI, uvicorn all support async for non-blocking I/O
- **Streaming**: SSE for real-time AI responses without polling
- **Vite HMR**: Instant feedback during development
- **Image Optimization**: Pillow for efficient image handling in PDFs
