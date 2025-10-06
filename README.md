# DocuChat

DocuChat is a document-based chat application that allows you to upload documents (PDF, TXT, DOCX) and have intelligent conversations about their content using AI.

## Features

- **Document Upload**: Support for PDF, TXT, and DOCX files (max 10MB)
- **Real-time Streaming**: AI responses stream in real-time for a better user experience
- **Conversation History**: All conversations are saved and linked to their respective documents
- **Simple React UI**: Clean, responsive interface built with React and vanilla CSS
- **No Heavy Dependencies**: Uses only essential libraries - React for UI, Express for backend

## Tech Stack

### Frontend
- **React 18**: UI framework
- **Vanilla CSS**: Simple, custom styling without UI libraries
- **esbuild**: Fast JavaScript bundler (no Vite)

### Backend
- **Node.js 20**: Runtime environment
- **Express**: Web framework
- **TypeScript**: Type-safe development
- **Drizzle ORM**: Database operations
- **PostgreSQL**: Database (Neon-backed on Replit)

### Document Processing
- **pdf-parse**: Extract text from PDF files
- **mammoth**: Extract text from DOCX files
- **multer**: Handle file uploads

### AI Integration (Optional)
- **Ollama**: Local AI model server for chat functionality

## Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- (Optional) Ollama running on http://localhost:11434 for AI chat

## Setup Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

The application uses PostgreSQL. On Replit, the database is automatically provisioned. 

Push the database schema:

```bash
npm run db:push
```

### 3. Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string (auto-set on Replit)
- `PORT`: Server port (default: 5000)
- `OLLAMA_BASE_URL`: Ollama server URL (optional, default: http://localhost:11434)
- `OLLAMA_MODEL`: AI model to use (optional, default: llama2)

### 4. Build the Client

Build the React frontend:

```bash
node build.mjs
```

### 5. Run in Development

Start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:5000

### 6. Run in Production

Build and start the production server:

```bash
npm run build
npm start
```

## Project Structure

```
├── client/               # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.tsx      # Main app component
│   │   ├── main.tsx     # Entry point
│   │   └── styles.css   # Global styles
│   └── index.html       # HTML template
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API routes
│   └── storage.ts       # Database operations
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database schema
├── dist/                # Build output
│   ├── public/          # Built frontend files
│   └── index.js         # Built backend
├── build.mjs            # Frontend build script
├── dev.mjs              # Development script
└── package.json         # Dependencies

```

## API Endpoints

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents/upload` - Upload a new document

### Conversations
- `GET /api/conversations/:documentId` - Get or create conversation for a document

### Messages
- `GET /api/messages/:conversationId` - Get all messages in a conversation
- `POST /api/chat` - Send a message and get AI response (streaming)

## Development

### Build Client Only

```bash
node build.mjs
```

### Watch Mode

```bash
node build.mjs --watch
```

### Type Checking

```bash
npm run check
```

### Run Tests

```bash
npm test
```

## Database Schema

The application uses three main tables:

1. **documents**: Stores uploaded documents and their extracted text
2. **conversations**: Links documents to chat conversations
3. **messages**: Stores individual chat messages (user and AI)

## Setting Up Ollama (Optional)

For AI chat functionality, you need Ollama running:

1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama2`
3. Start Ollama: `ollama serve`
4. The app will automatically connect to http://localhost:11434

## Troubleshooting

### "Cannot connect to Ollama"
- Make sure Ollama is running on port 11434
- Or set the `OLLAMA_BASE_URL` environment variable to your Ollama server

### "Database connection failed"
- Verify `DATABASE_URL` is set correctly
- Run `npm run db:push` to create/update tables

### Build errors
- Delete `node_modules` and `dist` folders
- Run `npm install` again
- Run `node build.mjs`

## License

MIT
