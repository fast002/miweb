import pandas as pd
import os
import json

files_map = {
    'Lengua y Literatura': '2. Lengua y Literatura.xlsx',
    'Matemática': '3. Matemática.xlsx',
    'Ciencias Naturales': '4. Ciencias Naturales.xlsx',
    'Ciencias Sociales': '5. Ciencias Sociales.xlsx',
    'Educación Cultural y Artística': '7. Educación Cultural y Artística.xlsx',
    'Emprendimiento y Gestión': '8. Emprendimiento y Gestión.xlsx',
    'Inicial': '1. Inicial.xlsx'
}

master_data = {}

for asignatura, path in files_map.items():
    if not os.path.exists(path):
        continue
    xls = pd.ExcelFile(path)
    master_data[asignatura] = {}
    
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, header=None)
        if df.shape[0] < 3:
            continue
            
        row_grades = df.iloc[2]
        cols = df.shape[1]
        
        for col_idx in range(0, cols, 5):
            if col_idx + 4 >= cols:
                break
            grade_name = row_grades.iloc[col_idx]
            if pd.isna(grade_name):
                continue
            grade_name = str(grade_name).strip()
            if grade_name == "" or "Matriz" in grade_name or "Competencia" in grade_name:
                continue
                
            if grade_name not in master_data[asignatura]:
                master_data[asignatura][grade_name] = []
                
            for r in range(3, df.shape[0]):
                comp = df.iloc[r, col_idx]
                dec = df.iloc[r, col_idx + 1]
                proc = df.iloc[r, col_idx + 2]
                act = df.iloc[r, col_idx + 3]
                ind = df.iloc[r, col_idx + 4]
                
                if pd.isna(comp) and pd.isna(dec) and pd.isna(proc) and pd.isna(act) and pd.isna(ind):
                    continue
                
                comp_str = str(comp).strip() if not pd.isna(comp) else ""
                if comp_str == "" or comp_str.lower() == "nan" or "Competencia específica" in comp_str:
                    continue
                    
                master_data[asignatura][grade_name].append({
                    "competencia": comp_str,
                    "declarativo": str(dec).strip() if not pd.isna(dec) else "",
                    "procedimental": str(proc).strip() if not pd.isna(proc) else "",
                    "actitudinal": str(act).strip() if not pd.isna(act) else "",
                    "indicador": str(ind).strip() if not pd.isna(ind) else ""
                })

ts_content = "// Base de datos oficial del Plan Piloto extraída de las matrices ministeriales\n\n"
ts_content += "export const PLAN_PILOTO_CURRICULO: Record<string, Record<string, any[]>> = "
ts_content += json.dumps(master_data, ensure_ascii=False, indent=2)
ts_content += ";\n"

os.makedirs('src/data', exist_ok=True)
with open('src/data/planPilotoData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("¡Listo! El archivo src/data/planPilotoData.ts se ha creado correctamente.")