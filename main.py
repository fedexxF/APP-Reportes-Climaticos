from fastapi import FastAPI, UploadFile, Form, Request, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, SQLModel, create_engine, select
from models import Reporte
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse



from typing import Optional, List
import os
import shutil
import requests

# 🚀 Inicializar app
app = FastAPI()

# 🧱 Montar carpetas estáticas
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="static/uploads"), name="uploads")
app.mount("/images", StaticFiles(directory="static/images"), name="images")
app.mount("/css", StaticFiles(directory="static/css"), name="css")
app.mount("/js", StaticFiles(directory="static/js"), name="js")

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
def geolocalizar_localidad(localidad: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": localidad + ", Argentina", "format": "json", "limit": 1}
    headers = {"User-Agent": "clima-app"}
    res = requests.get(url, params=params, headers=headers)
    if res.ok and res.json():
        datos = res.json()[0]
        return float(datos["lat"]), float(datos["lon"])
    print(f"⚠️ No se pudo geolocalizar la localidad: {localidad}")
    return None, None

# 📤 Crear reporte
@app.post("/reportes/")
async def crear_reporte(request: Request, archivo: Optional[UploadFile] = File(None)):
    form = await request.form()

    localidad = form.get("localidad") or "Desconocida"
    fecha = form.get("fecha")
    descripcion = form.get("descripcion") or ""
    temperatura = form.get("temperatura")
    humedad = form.get("humedad")
    tipo_evento = form.getlist("tipo_evento")

    print("📨 Datos recibidos:")
    print("Localidad:", localidad)
    print("Fecha:", fecha)
    print("Descripción:", descripcion)
    print("Tipo evento (lista):", tipo_evento)
    print("Temperatura:", temperatura)
    print("Humedad:", humedad)
    print("Archivo:", archivo.filename if archivo else "Sin archivo")

    # 🧾 Guardar archivo si existe
    ruta_archivo = None
    if archivo and archivo.filename:
        try:
            os.makedirs("uploads", exist_ok=True)
            ruta_archivo = f"uploads/{archivo.filename}"
            with open(ruta_archivo, "wb") as buffer:
                shutil.copyfileobj(archivo.file, buffer)
        except Exception as e:
            print(f"❌ Error al guardar archivo: {e}")
            raise HTTPException(status_code=500, detail="No se pudo guardar el archivo")

    # 📍 Geolocalización
    lat, lon = geolocalizar_localidad(localidad)
    print("Lat/Lon:", lat, lon)
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="No se pudo geolocalizar la localidad")

    # 🧪 Validar eventos
    eventos_validos = {
        "Granizo", "Viento", "Lluvia", "Rayo", "Tornado", "Nubes", "Frente de ráfagas"
    }
    eventos = [e for e in tipo_evento if e in eventos_validos]

    # 🆕 Crear instancia
    nuevo_reporte = Reporte(
        ciudad=localidad,
        fecha=fecha,
        descripcion=descripcion,
        archivo=ruta_archivo,
        lat=lat,
        lon=lon,
        tipo_evento=eventos,
        temperatura=float(temperatura) if temperatura else None,
        humedad=float(humedad) if humedad else None
    )

    # 💾 Guardar en DB
    try:
        with Session(engine) as session:
            session.add(nuevo_reporte)
            session.commit()
            session.refresh(nuevo_reporte)
        print(f"✅ Reporte guardado: {nuevo_reporte}")
        return JSONResponse(content=nuevo_reporte.dict())
    except Exception as e:
        print(f"❌ Error al guardar en DB: {e}")
        raise HTTPException(status_code=500, detail="No se pudo guardar el reporte")


# 📄 Listar reportes
@app.get("/reportes/")
def listar_reportes():
    with Session(engine) as session:
        reportes = session.exec(select(Reporte)).all()
        print(f"📥 Total reportes: {len(reportes)}")
        return reportes

# 🕵️‍♂️ Último reporte (debug opcional)
@app.get("/ultimo-reporte/")
def ultimo_reporte():
    with Session(engine) as session:
        reporte = session.exec(select(Reporte).order_by(Reporte.id.desc())).first()
        return reporte

# 🏠 Ruta principal (renderiza HTML)
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})