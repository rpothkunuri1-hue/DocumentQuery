# DocuChat - Local Development Setup

A document Q&A application with AI-powered conversations using Ollama models.

## 🚀 Features

- Upload and chat with documents (PDF, DOCX, TXT, CSV, Excel, Markdown, HTML, source code, images with OCR)
- Real-time streaming AI responses
- Conversation memory and history
- Export conversations to PDF, Markdown, or JSON
- Dark mode support
- Mobile-friendly with swipe gestures

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software

1. **Python 3.11+**
   ```bash
   python --version  # Should be 3.11 or higher
   ```

2. **Node.js 20+**
   ```bash
   node --version   # Should be 20.x or higher
   npm --version
   ```

3. **PostgreSQL** (Optional - uses in-memory SQLite by default)
   ```bash
   psql --version
   ```

4. **Tesseract OCR** (for image text extraction)
   - **macOS**: `brew install tesseract`
   - **Ubuntu/Debian**: `sudo apt-get install tesseract-ocr`
   - **Windows**: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

5. **Ollama** (for AI models)
   - Download from [ollama.ai](https://ollama.ai)
   - Pull a model: `ollama pull llama2`

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd docuchat
```

### 2. Backend Setup (Python)

#### Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Note**: If you get a `pg_config` error with `psycopg2-binary`, you can either:
- Install PostgreSQL development files: `sudo apt-get install libpq-dev` (Ubuntu/Debian)
- Or use SQLite instead (modify `app/database.py`)

### 3. Frontend Setup (Node.js)

```bash
# Install Node.js dependencies
npm install
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Server Configuration
PORT=8000

# Database (Optional - defaults to SQLite)
# DATABASE_URL=postgresql://user:password@localhost:5432/docuchat
```

## 🚀 Running the Application

### Development Mode

You have two options to run the application:

#### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev
```

This starts:
- Backend (FastAPI) on `http://localhost:8000`
- Frontend (Vite) on `http://localhost:5000`

#### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
source venv/bin/activate  # Activate virtual environment first
python main.py
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

### Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

The production server serves both the API and the built frontend.

## 📁 Project Structure

```
docuchat/
├── app/                      # Backend (Python/FastAPI)
│   ├── routes.py            # API endpoints
│   ├── models.py            # Database models
│   ├── database.py          # Database configuration
│   ├── document_parser.py   # Document text extraction
│   └── init_db.py           # Database initialization
├── client/                   # Frontend (React)
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── lib/            # Utilities
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   └── index.html
├── main.py                  # FastAPI entry point
├── requirements.txt         # Python dependencies
├── package.json            # Node.js dependencies
├── vite.config.js          # Vite configuration
└── README_LOCAL_SETUP.md   # This file
```

## 🔧 Configuration

### Database Setup

By default, the app uses in-memory SQLite. To use PostgreSQL:

1. Install PostgreSQL
2. Create a database:
   ```bash
   createdb docuchat
   ```
3. Update `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/docuchat
   ```
4. Update `app/database.py` to use PostgreSQL connection string

### Ollama Models

1. Ensure Ollama is running:
   ```bash
   ollama serve
   ```

2. Pull models you want to use:
   ```bash
   ollama pull llama2
   ollama pull mistral
   ollama pull codellama
   ```

3. Models will appear in the DocuChat interface automatically

## 🐛 Troubleshooting

### Backend won't start

**Problem**: `ModuleNotFoundError: No module named 'fastapi'`
- **Solution**: Make sure virtual environment is activated and dependencies are installed
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### Frontend can't connect to backend

**Problem**: `ECONNREFUSED` errors in browser console
- **Solution**: Ensure backend is running on port 8000
  ```bash
  # Check if port 8000 is in use
  lsof -i :8000  # macOS/Linux
  netstat -ano | findstr :8000  # Windows
  ```

### OCR not working

**Problem**: `TesseractNotFoundError`
- **Solution**: Install Tesseract OCR (see Prerequisites)

### Ollama models not loading

**Problem**: "Failed to fetch Ollama models"
- **Solution**: 
  1. Check Ollama is running: `ollama list`
  2. Verify OLLAMA_BASE_URL in `.env`
  3. Make sure you've pulled at least one model

### Database errors

**Problem**: `pg_config executable not found`
- **Solution**: Either install PostgreSQL dev files OR switch to SQLite

## 📝 Available Scripts

```bash
npm run dev          # Run both backend and frontend
npm run build        # Build frontend for production
npm start           # Run production server
npm run check       # TypeScript type checking
```

## 🌐 API Endpoints

- `GET /api/documents` - List all documents
- `POST /api/documents/upload` - Upload a document
- `DELETE /api/documents/:id` - Delete a document
- `GET /api/models` - List available Ollama models
- `POST /api/chat` - Send a chat message (streaming)
- `GET /api/conversations/:documentId` - Get conversation for document
- `GET /api/messages/:conversationId` - Get messages for conversation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues or questions:
- Check the Troubleshooting section above
- Review the project documentation
- Open an issue on GitHub
