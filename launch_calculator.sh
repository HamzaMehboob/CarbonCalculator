#!/bin/bash
cd "$(dirname "$0")"

echo "Installing required packages (first time only)..."
pip install --quiet --upgrade pip

# Use pre-compiled wheels from trusted source to avoid compilation
pip install --quiet --only-binary=all \
  --find-links https://github.com/indiana-university/pypi-wheels/releases/download/all/ \
  -r requirements.txt

echo "Starting Carbon Emissions Calculator..."
streamlit run carbon_emissions_calculator.py --server.port=8501