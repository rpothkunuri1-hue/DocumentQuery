# DocuChat

DocuChat is an intelligent document chat application that enables users to upload documents and have natural conversations about their content using local Ollama language models.

## Features

- **Multi-Format Support**: Upload and process PDF, TXT, CSV, Excel, MD, HTML, RTF, and code files
- **Export Capabilities**: Export documents and conversations to PDF, Markdown, or JSON formats
- **Real-Time Streaming**: Get instant responses with streaming AI-generated answers
- **Conversation History**: All conversations are saved and persisted across sessions
- **Touch-Friendly Interface**: Swipe-to-delete gestures for mobile users, with button fallback for desktop
- **Dark Mode**: Toggle between light and dark themes
- **Message Management**: Edit messages, regenerate responses, rate answers, and delete conversation history
- **Model Selection**: Choose from multiple Ollama models

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM for database operations
- **PostgreSQL**: Relational database for data persistence
- **Ollama**: Local language model inference
- **Python Document Parsers**:
  - pymupdf for PDF files
  - openpyxl for Excel files
  - Python built-in csv module for CSV files
  - beautifulsoup4 for HTML parsing
  - fpdf2 for PDF export generation

### Frontend
- **React 18**: Modern UI library for building user interfaces
- **Vite**: Fast build tool and development server
- **TanStack Query**: Powerful data synchronization and caching
- **Wouter**: Lightweight routing solution
- **Lucide React**: Beautiful icon library
- **React Hook Form + Zod**: Form validation and management

## Prerequisites

Before running DocuChat, ensure you have the following installed:

- **Python 3.11+**
- **Node.js 20+** and npm
- **PostgreSQL 12+**
- **Ollama** (for local LLM inference)

### Installing Ollama

1. Visit [ollama.ai](https://ollama.ai/) and download Ollama for your operating system
2. Install Ollama and ensure it's running
3. Pull at least one model:
   ```bash
   ollama pull llama2
   ```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/docuchat.git
cd docuchat
```

### 2. Backend Setup

Create and activate a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

### 3. Frontend Setup

Install Node.js dependencies:

```bash
npm install
```

### 4. Database Setup

Create a PostgreSQL database:

```bash
createdb docuchat
```

Set up environment variables. Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/docuchat
OLLAMA_BASE_URL=http://localhost:11434
PORT=5000
```

The database tables will be created automatically when you first run the application.

## Running the Application

### Development Mode

The easiest way to run both frontend and backend together:

```bash
npm run dev
```

This command:
- Starts the FastAPI backend on port 8000
- Starts the Vite development server on port 5000
- Proxies API requests from frontend to backend

Access the application at: **http://localhost:5000**

### Running Separately

**Backend only**:
```bash
python main.py
```

**Frontend only**:
```bash
npm run dev
```

## Building for Production

### 1. Build the Frontend

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

### 2. Run in Production Mode

```bash
npm run start
```

The FastAPI server will serve the built frontend files and API on port 5000.

## Project Structure

```
docuchat/
├── app/                      # Backend Python application
│   ├── __init__.py
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models
│   ├── routes.py            # API endpoints
│   ├── document_parser.py   # Document processing logic
│   └── init_db.py          # Database initialization
├── client/                   # Frontend React application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── DocumentList.jsx
│   │   │   └── UploadModal.jsx
│   │   ├── lib/             # Utility libraries
│   │   │   └── queryClient.js
│   │   ├── App.jsx          # Main application component
│   │   ├── main.jsx         # Entry point
│   │   └── styles.css       # Global styles
│   └── index.html           # HTML template
├── tests/                    # Test files
│   ├── backend/             # Backend tests
│   │   ├── test_document_parser.py
│   │   └── test_routes.py
│   └── frontend/            # Frontend tests
│       └── ChatInterface.test.jsx
├── main.py                   # FastAPI application entry point
├── requirements.txt          # Python dependencies
├── package.json             # Node.js dependencies
├── vite.config.js           # Vite configuration
└── README.md                # This file
```

## API Endpoints

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/{document_id}` - Get a specific document
- `POST /api/documents/upload` - Upload a document
- `DELETE /api/documents/{document_id}` - Delete a document
- `GET /api/documents/{document_id}/export/json` - Export document as JSON
- `GET /api/documents/{document_id}/export/markdown` - Export document as Markdown
- `GET /api/documents/{document_id}/export/pdf` - Export document as PDF

### Conversations
- `GET /api/conversations/{document_id}` - Get or create conversation for a document

### Messages
- `GET /api/messages/{conversation_id}` - Get all messages in a conversation
- `POST /api/chat` - Send a message and get streaming response

### Models
- `GET /api/models` - List available Ollama models

### Health
- `GET /health` - Health check endpoint

## Configuration

### Environment Variables

- `PORT`: Server port (default: 5000 for production, 8000 for backend in dev mode)
- `DATABASE_URL`: PostgreSQL connection string
- `OLLAMA_BASE_URL`: Ollama API endpoint (default: http://localhost:11434)

### Supported Document Formats

- **PDF**: `.pdf`
- **Text**: `.txt`, `.md`
- **Excel**: `.xlsx`, `.csv`
- **HTML**: `.html`, `.htm`
- **RTF**: `.rtf`
- **Code files**: `.js`, `.py`, `.java`, `.c`, `.cpp`, and many more

**Note**: DOCX support was removed to reduce dependencies and maintain a lighter application.

## Testing

Testing infrastructure has been removed to keep the application compact. For production use, consider adding:
- Backend tests with pytest for document parsing and API endpoints
- Frontend tests with vitest or React Testing Library
- End-to-end tests with Playwright or Cypress

## Troubleshooting

### Ollama Connection Issues

If you see "Failed to fetch Ollama models":
1. Ensure Ollama is running: `ollama serve`
2. Verify the OLLAMA_BASE_URL in your environment
3. Check that you have at least one model pulled: `ollama list`

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check DATABASE_URL is correct
3. Ensure the database exists: `createdb docuchat`

### Port Already in Use

If port 5000 or 8000 is already in use:
1. Change the PORT environment variable
2. Update the proxy configuration in `vite.config.js`
3. Update the dev script in `package.json`

### File Upload Errors

- Maximum file size is 10MB
- Ensure the file format is supported
- Check that the document contains extractable text

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Ollama](https://ollama.ai/) for local LLM inference
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework
- [TanStack Query](https://tanstack.com/query) for data fetching
- All the open-source libraries that make this project possible
