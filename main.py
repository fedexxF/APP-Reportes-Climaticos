from fastapi import FastAPI, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from sqlmodel import Session, SQLModel, create_engine, select
from models import Reporte

from typing import Optional
import os
import shutil
import requests
import json

# 🚀 Inicializar app
app = FastAPI()

# 🧱 Montar carpeta estática
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="static/uploads"), name="uploads")

# 🧩 Configurar templates
templates = Jinja2Templates(directory="templates")

# 🌐 CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🗃️ Base de datos SQLite
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
    archivo: Optional[UploadFile] = None
):
    # 🧾 Guardar archivo si existe
    ruta_archivo = None
    if archivo:
        os.makedirs("uploads", exist_ok=True)
        ruta_archivo = f"uploads/{archivo.filename}"
        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

    # 📍 Geolocalización
    lat, lon = geolocalizar_ciudad(ciudad)

    # 🧪 Parsear eventos
    try:
        eventos = json.loads(tipo_evento) if tipo_evento else []
    except json.JSONDecodeError:
        eventos = []

    # 🆕 Crear instancia
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

    # 💾 Guardar en DB
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

# 🏠 Ruta principal (renderiza HTML)
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})