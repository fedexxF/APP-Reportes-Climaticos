from pydantic import BaseModel
from datetime import datetime

class ReporteCreate(BaseModel):
    archivo: str
    latitud: float
    longitud: float

class ReporteOut(BaseModel):
    id: int
    archivo: str
    latitud: float
    longitud: float
    fecha: datetime

    class Config:
        orm_mode = True