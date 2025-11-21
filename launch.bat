@echo off
REM ============================================
REM Carbon Calculator Phase 1 - Launch Script
REM ============================================

echo.
echo ========================================
echo  Carbon Calculator Phase 1 - Launcher
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed!
    echo Please install Python 3.11 or higher from https://www.python.org
    pause
    exit /b 1
)

echo [1/4] Python detected successfully!
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo [2/4] Creating virtual environment...
    python -m venv venv
    echo Virtual environment created!
) else (
    echo [2/4] Virtual environment already exists!
)
echo.

REM Activate virtual environment
echo [3/4] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [4/4] Installing dependencies...
pip install -q --upgrade pip
pip install -q -r backend\requirements.txt

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Starting Carbon Calculator...
echo.
echo Frontend: Open frontend\index.html in your browser
echo Backend API: Starting on http://localhost:8501
echo.
echo Login credentials:
echo   Email: admin@company.com
echo   Password: admin123
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start Streamlit backend
cd backend
streamlit run app.py --server.port 8501 --server.headless true

pause

