#!/bin/bash

# DocuChat Local Setup Script for macOS/Linux
echo "🚀 DocuChat Local Setup"
echo "======================="
echo ""

# Check Python
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Found Python $PYTHON_VERSION"

# Check Node.js
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20 or higher."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Found Node.js $NODE_VERSION"

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
python3 -m venv venv
echo "✅ Virtual environment created"

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    echo "💡 If you see pg_config errors, you can:"
    echo "   - Install PostgreSQL: brew install postgresql (macOS) or sudo apt-get install libpq-dev (Ubuntu)"
    echo "   - Or modify app/database.py to use SQLite instead"
    exit 1
fi

echo "✅ Python dependencies installed"

# Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi

echo "✅ Node.js dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file - please review and update if needed"
fi

# Check for Tesseract
echo ""
echo "Checking optional dependencies..."
if ! command -v tesseract &> /dev/null; then
    echo "⚠️  Tesseract OCR not found (optional for image text extraction)"
    echo "   Install with: brew install tesseract (macOS) or sudo apt-get install tesseract-ocr (Ubuntu)"
else
    echo "✅ Tesseract OCR found"
fi

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo "⚠️  Ollama not found (required for AI chat)"
    echo "   Install from: https://ollama.ai"
else
    echo "✅ Ollama found"
    echo "   Make sure you have pulled a model: ollama pull llama2"
fi

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo ""
echo "Starting both frontend and backend servers..."
echo ""

# Build frontend first
echo "Building frontend..."
npm run build

# Check if we're in Replit environment
if [ -n "$REPL_ID" ]; then
    echo "Running in Replit environment - starting backend server..."
    echo "Frontend will be served from backend at http://localhost:5000"
    PORT=5000 python3 main.py
else
    echo "Running in local environment - starting both servers..."
    echo ""
    echo "Terminal 1 - Backend:"
    echo "  source venv/bin/activate"
    echo "  npm run dev:backend"
    echo ""
    echo "Terminal 2 - Frontend:"
    echo "  npm run dev"
    echo ""
    echo "The app will be available at:"
    echo "  - Frontend: http://localhost:5000 (Vite dev server)"
    echo "  - Backend API: http://localhost:8000 (FastAPI)"
    echo ""
    echo "Frontend will proxy API requests to backend automatically."
    echo ""
    echo "For more details, see README_LOCAL_SETUP.md"
fi
echo "=========================================="
