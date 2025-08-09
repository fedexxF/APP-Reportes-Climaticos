from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, SQLModel, create_engine, select
from models import Reporte
from typing import Optional
import os
import shutil
import requests
import json


app = FastAPI()

# CORS para permitir frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base de datos SQLite
engine = create_engine("sqlite:///database.db")

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    os.makedirs("uploads", exist_ok=True)

# 🌍 Geolocalización automática
def geolocalizar_ciudad(ciudad: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": ciudad + ", Argentina", "format": "json", "limit": 1}
    headers = {"User-Agent": "clima-app"}
    res = requests.get(url, params=params, headers=headers)
    if res.ok and res.json():
        datos = res.json()[0]
        return float(datos["lat"]), float(datos["lon"])
    return None, None

# 📤 Crear reporte
@app.post("/reportes/")
async def crear_reporte(
    ciudad: str = Form(...),
    fecha: str = Form(...),
    descripcion: str = Form(""),
    tipo_evento: str = Form("[]"),  # Recibimos como string JSON
    temperatura: Optional[float] = Form(None),
    humedad: Optional[float] = Form(None),
    archivo: UploadFile = None
):
    ruta_archivo = None
    if archivo:
        ruta_archivo = f"uploads/{archivo.filename}"
        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

    lat, lon = geolocalizar_ciudad(ciudad)

    eventos = json.loads(tipo_evento) if tipo_evento else []

    nuevo_reporte = Reporte(
        ciudad=ciudad,
        fecha=fecha,
        temperatura=temperatura,
        humedad=humedad,
        descripcion=descripcion,
        archivo=ruta_archivo,
        lat=lat,
        lon=lon,
        tipo_evento=eventos
    )

    with Session(engine) as session:
        session.add(nuevo_reporte)
        session.commit()
        session.refresh(nuevo_reporte)

    return nuevo_reporte

# 📄 Listar reportes
@app.get("/reportes/")
def listar_reportes():
    with Session(engine) as session:
        reportes = session.exec(select(Reporte)).all()
        return reportes