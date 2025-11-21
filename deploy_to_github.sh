#!/bin/bash

# ============================================
# Deploy Carbon Calculator to GitHub
# ============================================

echo ""
echo "========================================"
echo " Deploy to GitHub - Setup Script"
echo "========================================"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "ERROR: Git is not installed!"
    echo "Please install Git from https://git-scm.com"
    exit 1
fi

echo "[1/5] Git detected successfully!"
echo ""

# Initialize git repository if not already
if [ ! -d ".git" ]; then
    echo "[2/5] Initializing Git repository..."
    git init
    git branch -M main
else
    echo "[2/5] Git repository already initialized!"
fi
echo ""

# Add all files
echo "[3/5] Adding files to Git..."
git add .

# Commit
echo "[4/5] Creating commit..."
git commit -m "Phase 1 Carbon Calculator - Ready for deployment"

echo ""
echo "[5/5] Repository ready!"
echo ""
echo "========================================"
echo " Next Steps:"
echo "========================================"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   https://github.com/new"
echo ""
echo "2. Copy and run this command:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/carbon-calculator.git"
echo "   git push -u origin main"
echo ""
echo "3. Then deploy on Streamlit Cloud:"
echo "   https://share.streamlit.io"
echo ""
echo "Replace YOUR_USERNAME with your GitHub username"
echo ""
echo "========================================"

