from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
from datetime import datetime

class Reporte(Base):
    __tablename__ = "reportes"

    id = Column(Integer, primary_key=True, index=True)
    archivo = Column(String, nullable=False)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)