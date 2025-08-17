from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON

class Reporte(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ciudad: str = Field(min_length=2, max_length=100)
    fecha: str
    temperatura: Optional[float] = None
    humedad: Optional[float] = None
    descripcion: Optional[str] = Field(default="", max_length=500)
    archivo: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    tipo_evento: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))