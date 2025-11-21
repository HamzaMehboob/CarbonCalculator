#!/bin/bash

# ============================================
# Carbon Calculator Phase 1 - Launch Script
# For macOS and Linux
# ============================================

echo ""
echo "========================================"
echo " Carbon Calculator Phase 1 - Launcher"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python is not installed!"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

echo "[1/4] Python detected successfully!"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "[2/4] Creating virtual environment..."
    python3 -m venv venv
    echo "Virtual environment created!"
else
    echo "[2/4] Virtual environment already exists!"
fi
echo ""

# Activate virtual environment
echo "[3/4] Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "[4/4] Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "Starting Carbon Calculator..."
echo ""
echo "Frontend: Open frontend/index.html in your browser"
echo "Backend API: Starting on http://localhost:8501"
echo ""
echo "Login credentials:"
echo "  Email: admin@company.com"
echo "  Password: admin123"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Start Streamlit backend
cd backend
streamlit run app.py --server.port 8501 --server.headless true

