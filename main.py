from fastapi import FastAPI, File, UploadFile, Form, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os

from database import SessionLocal, engine
from models import Reporte
from schemas import ReporteCreate, ReporteOut

app = FastAPI()

# Crear tablas
Reporte.metadata.create_all(bind=engine)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Dependencia para obtener sesión de DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/reportar", response_model=ReporteOut)
async def subir_archivo(
    file: UploadFile = File(...),
    latitud: float = Form(...),
    longitud: float = Form(...),
    db: Session = Depends(get_db)
):
    # Guardar archivo
    file_location = f"{UPLOAD_FOLDER}/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())

    # Crear y guardar reporte en la base de datos
    nuevo_reporte = Reporte(
        archivo=file.filename,
        latitud=latitud,
        longitud=longitud,
        fecha=datetime.utcnow()
    )
    db.add(nuevo_reporte)
    db.commit()
    db.refresh(nuevo_reporte)

    return nuevo_reporte