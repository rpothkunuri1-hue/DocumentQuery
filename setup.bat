@echo off
REM DocuChat Local Setup Script for Windows

echo ========================================
echo  DocuChat Local Setup for Windows
echo ========================================
echo.

REM Check Python
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11 or higher from python.org
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo Found Python %PYTHON_VERSION%

REM Check Node.js
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 20 or higher from nodejs.org
    pause
    exit /b 1
)

for /f %%i in ('node --version') do set NODE_VERSION=%%i
echo Found Node.js %NODE_VERSION%

REM Create virtual environment
echo.
echo Creating Python virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)
echo Virtual environment created

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install Python dependencies
echo.
echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    echo.
    echo If you see pg_config errors:
    echo   - Install PostgreSQL from postgresql.org
    echo   - Or modify app\database.py to use SQLite instead
    pause
    exit /b 1
)

echo Python dependencies installed

REM Install Node.js dependencies
echo.
echo Installing Node.js dependencies...
call npm install

if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo Node.js dependencies installed

REM Create .env file if it doesn't exist
if not exist .env (
    echo.
    echo Creating .env file from template...
    copy .env.example .env
    echo Created .env file - please review and update if needed
)

REM Check for Tesseract
echo.
echo Checking optional dependencies...
tesseract --version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Tesseract OCR not found ^(optional for image text extraction^)
    echo   Install from: https://github.com/UB-Mannheim/tesseract/wiki
) else (
    echo Tesseract OCR found
)

REM Check for Ollama
ollama --version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama not found ^(required for AI chat^)
    echo   Install from: https://ollama.ai
) else (
    echo Ollama found
    echo   Make sure you have pulled a model: ollama pull llama2
)

echo.
echo ========================================
echo  Setup complete!
echo.
echo To start the application:
echo   1. Activate virtual environment: venv\Scripts\activate
echo   2. Run the app: npm run dev
echo.
echo The app will be available at:
echo   - Frontend: http://localhost:5000
echo   - Backend API: http://localhost:8000
echo.
echo For more details, see README_LOCAL_SETUP.md
echo ========================================
echo.
pause
