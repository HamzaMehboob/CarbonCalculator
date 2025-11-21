@echo off
REM ============================================
REM Deploy Carbon Calculator to GitHub
REM ============================================

echo.
echo ========================================
echo  Deploy to GitHub - Setup Script
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com
    pause
    exit /b 1
)

echo [1/5] Git detected successfully!
echo.

REM Initialize git repository if not already
if not exist ".git" (
    echo [2/5] Initializing Git repository...
    git init
    git branch -M main
) else (
    echo [2/5] Git repository already initialized!
)
echo.

REM Add all files
echo [3/5] Adding files to Git...
git add .

REM Commit
echo [4/5] Creating commit...
git commit -m "Phase 1 Carbon Calculator - Ready for deployment"

echo.
echo [5/5] Repository ready!
echo.
echo ========================================
echo  Next Steps:
echo ========================================
echo.
echo 1. Create a new repository on GitHub:
echo    https://github.com/new
echo.
echo 2. Copy and run this command:
echo.
echo    git remote add origin https://github.com/YOUR_USERNAME/carbon-calculator.git
echo    git push -u origin main
echo.
echo 3. Then deploy on Streamlit Cloud:
echo    https://share.streamlit.io
echo.
echo Replace YOUR_USERNAME with your GitHub username
echo.
echo ========================================

pause

