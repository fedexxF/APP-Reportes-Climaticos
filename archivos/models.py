from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON

class Reporte(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ciudad: str
    fecha: str
    temperatura: Optional[float] = None
    humedad: Optional[float] = None
    descripcion: Optional[str] = ""
    archivo: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    tipo_evento: Optional[List[str]] = Field(default=[], sa_column=Column(JSON))