@echo off
cd /d "%~dp0"
echo Installing packages - this WILL work, please wait 20-30 seconds...
echo.

REM This line forces pip to use only pre-compiled packages + unofficial Windows binaries
python -m pip install --upgrade pip -q
python -m pip install --only-binary=all --find-links https://github.com/indiana-university/pypi-wheels/releases/download/all/ -r requirements.txt -q

echo.
echo Starting Carbon Emissions Calculator...
streamlit run carbon_emissions_calculator.py --server.port=8501
pause