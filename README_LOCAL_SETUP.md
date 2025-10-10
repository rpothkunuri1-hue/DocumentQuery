# DocuChat - Local Development Setup

A simplified document viewer with optional AI chat features for PDF and TXT files.

## 🚀 Features

- Upload and view PDF and TXT documents
- Extract text from documents automatically
- Optional AI chat with documents using Ollama (if configured)
- Export conversations to PDF, Markdown, or JSON
- Dark mode support

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

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

3. **Ollama** (Optional - for AI chat features)
   - Download from [ollama.ai](https://ollama.ai)
   - Pull a model: `ollama pull llama3.2` (or any other model)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd docuchat
```

### 2. Run Setup Script (macOS/Linux)

```bash
chmod +x setup.sh
./setup.sh
```

Or install manually:

### 3. Manual Setup

#### Backend (Python)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Frontend (Node.js)

```bash
npm install
```

## 🚀 Running the Application

### Development Mode (Two Terminals)

**Terminal 1 - Backend:**
```bash
# Activate virtual environment first
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows

# Start backend on port 8000
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
# Start frontend dev server on port 5000
npm run dev
```

Then open http://localhost:5000 in your browser.

### Production Build

```bash
# Build frontend
npm run build

# Start production server (serves both API and frontend on port 5000)
npm start
```

## 🔧 Configuration

### Ollama Setup (Optional - for AI chat)

1. **Install Ollama** from [ollama.ai](https://ollama.ai)

2. **Start Ollama service:**
   ```bash
   ollama serve
   ```

3. **Pull at least one model:**
   ```bash
   ollama pull llama3.2
   # Or any other model:
   # ollama pull mistral
   # ollama pull phi
   ```

4. **Select model in the UI** - The app will automatically detect installed models in the dropdown

⚠️ **Important**: You must select a model from the dropdown before using chat features. The app no longer uses a hardcoded default model.

### Environment Variables (Optional)

Create a `.env` file in the root directory:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# No need to set OLLAMA_MODEL - select from UI dropdown
```

## 📁 Project Structure

```
docuchat/
├── app/                      # Backend (Python/FastAPI)
│   ├── routes.py            # API endpoints
│   ├── document_parser.py   # PDF and TXT text extraction
│   └── file_storage.py      # In-memory document storage
├── client/                   # Frontend (React)
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   └── index.html
├── main.py                  # FastAPI entry point
├── requirements.txt         # Python dependencies
├── package.json            # Node.js dependencies
└── vite.config.js          # Vite configuration
```

## 🐛 Troubleshooting

### Backend won't start

**Problem**: `ModuleNotFoundError`
- **Solution**: Ensure virtual environment is activated and dependencies are installed
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### Frontend can't connect to backend

**Problem**: `ECONNREFUSED` errors
- **Solution**: Ensure backend is running on port 8000
  ```bash
  # Check if port 8000 is in use
  lsof -i :8000  # macOS/Linux
  netstat -ano | findstr :8000  # Windows
  ```

### Ollama 404 Error

**Problem**: "Ollama API error: 404"
- **Solution**: 
  1. Check Ollama is running: `ollama list`
  2. Make sure you've pulled a model: `ollama pull llama3.2`
  3. **Select the model from the dropdown in the UI** - don't rely on defaults
  4. If no models appear in dropdown, check Ollama connection

### Export not working

**Problem**: Export buttons return 500 error
- **Solution**: Make sure you have a conversation with the document first. Upload a document, ask a question, then try exporting.

## 📝 Available Scripts

```bash
npm run dev              # Start frontend dev server (port 5000)
npm run dev:frontend     # Same as above
npm run dev:backend      # Start backend server (port 8000)
npm run build            # Build frontend for production
npm start                # Run production server (port 5000)
```

## 🌐 API Endpoints

- `GET /api/documents` - List all documents
- `POST /api/documents/upload` - Upload a document (PDF or TXT only)
- `DELETE /api/documents/:id` - Delete a document
- `GET /api/models` - List available Ollama models
- `POST /api/chat` - Send a chat message (requires model selection)
- `GET /api/conversations/:documentId` - Get conversation for document
- `GET /api/messages/:conversationId` - Get messages for conversation
- `GET /api/documents/:id/export/json` - Export conversation as JSON
- `GET /api/documents/:id/export/markdown` - Export conversation as Markdown
- `GET /api/documents/:id/export/pdf` - Export conversation as PDF

## 📄 License

MIT License

## 🆘 Support

For issues:
- Check the Troubleshooting section above
- Make sure Ollama is configured with at least one model
- Verify you've selected a model from the UI dropdown
