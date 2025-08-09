from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from datetime import datetime
import os
import json

app = FastAPI()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.post("/reportar")
async def subir_archivo(
    file: UploadFile = File(...),
    latitud: float = Form(...),
    longitud: float = Form(...)
):
    # Guardar archivo
    file_location = f"{UPLOAD_FOLDER}/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())

    # Crear metadatos
    reporte = {
        "archivo": file.filename,
        "ubicacion": {"lat": latitud, "lon": longitud},
        "fecha": datetime.now().isoformat()
    }

    # Guardar metadatos en archivo JSON (simulación de base de datos)
    with open("reportes.json", "a", encoding="utf-8") as f:
        f.write(json.dumps(reporte) + "\n")

    return JSONResponse(content={"mensaje": "Reporte guardado", "datos": reporte})