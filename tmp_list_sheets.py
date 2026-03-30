import pandas as pd

file_path = 'requirements/00 Stage 1 Datasheet Carbon Conversion APP v DATA SET GRAPHS 2.xlsx'
try:
    xls = pd.ExcelFile(file_path)
    print("Sheet Names:", xls.sheet_names)
except Exception as e:
    print(f"Error: {e}")
