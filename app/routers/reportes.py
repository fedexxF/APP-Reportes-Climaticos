from fastapi import APIRouter, UploadFile, Form
from sqlmodel import Session, select
from typing import Optional
import shutil, json, os

from app.models import Reporte
from app.database import engine
from app.utils.geo import geolocalizar_ciudad

router = APIRouter()

@router.post("/reportes/")
async def crear_reporte(
    localidad: str = Form(...),
    fecha: str = Form(...),
    descripcion: str = Form(""),
    tipo_evento: str = Form("[]"),
    temperatura: Optional[float] = Form(None),
    humedad: Optional[float] = Form(None),
    archivo: UploadFile = None
):
    ruta_archivo = None
    if archivo:
        ruta_archivo = f"uploads/{archivo.filename}"
        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

    lat, lon = geolocalizar_ciudad(localidad)
    eventos = json.loads(tipo_evento) if tipo_evento else []

    nuevo_reporte = Reporte(
        ciudad=localidad,
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

@router.get("/reportes/")
def listar_reportes():
    with Session(engine) as session:
        reportes = session.exec(select(Reporte)).all()
        return reportes