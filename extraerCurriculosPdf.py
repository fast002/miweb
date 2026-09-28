import os
import json
import pdfplumber

# Configuración de niveles y rutas
niveles = {
    'elemental': ['SEGUNDO GRADO (EGB Elemental)', 'TERCER GRADO (EGB Elemental)', 'CUARTO GRADO (EGB Elemental)'],
    'media': ['QUINTO GRADO (EGB Media)', 'SEXTO GRADO (EGB Media)', 'SÉPTIMO GRADO (EGB Media)'],
    'superior': ['OCTAVO AÑO EGB (EGB Superior)', 'NOVENO AÑO EGB (EGB Superior)', 'DECIMO AÑO EGB (EGB Superior)'],
    'bachillerato': ['PRIMER AÑO BGU (Tronco Común)', 'SEGUNDO AÑO BGU (Tronco Común)', 'TERCER AÑO BGU (Tronco Común)']
}

def extraer_datos_pdf(ruta_pdf):
    datos_estructurados = []
    with pdfplumber.open(ruta_pdf) as pdf:
        for pagina in pdf.pages:
            # Extraer tablas directamente
            tablas = pagina.extract_tables()
            for tabla in tablas:
                # Asumimos que la tabla sigue el formato: Competencia | Indicador | Declarativos | Procedimentales | Actitudinales
                # Debes ajustar los índices según cómo pdfplumber detecte tus tablas
                if len(tabla) >= 2: 
                    # Aquí se procesa cada fila de la tabla
                    for fila in tabla[1:]: # saltar cabecera
                        datos_estructurados.append({
                            "competencia": fila[0] if len(fila) > 0 else "",
                            "indicador": fila[1] if len(fila) > 1 else "",
                            "declarativo": fila[2] if len(fila) > 2 else "",
                            "procedimental": fila[3] if len(fila) > 3 else "",
                            "actitudinal": fila[4] if len(fila) > 4 else ""
                        })
    return datos_estructurados

# Ejecución principal
master_data = {}
base_path = 'public/curriculos'

for nivel, grados in niveles.items():
    ruta_nivel = os.path.join(base_path, nivel)
    if os.path.exists(ruta_nivel):
        for archivo in os.listdir(ruta_nivel):
            if archivo.endswith('.pdf'):
                # Mapear nombre archivo a asignatura (puedes añadir un diccionario aquí)
                asignatura = archivo.replace('.pdf', '').capitalize()
                if asignatura not in master_data: master_data[asignatura] = {}
                
                contenido = extraer_datos_pdf(os.path.join(ruta_nivel, archivo))
                
                for grado in grados:
                    master_data[asignatura][grado] = contenido

# Escribir el archivo TypeScript
ts_content = f"export const PLAN_PILOTO_CURRICULO = {json.dumps(master_data, indent=2, ensure_ascii=False)};"
with open('src/data/planPilotoData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)