import { argentinaFeature } from './map.js';

export const iconos = {
  "Granizo": "🌩️",
  "Viento": "💨",
  "Lluvia": "🌧️",
  "Tornado": "🌪️",
  "Rayo": "⚡",
  "Nubes": "☁️",
  "Frente de ráfagas": "🌬️"
};

export function dentroDeArgentina(lat, lon) {
  // Rango aproximado de lat/lon en Argentina
  if (!(lat > -55 && lat < -21 && lon > -75 && lon < -53)) {
    return false;
  }

  // Si aún no cargó el GeoJSON, lo ignoramos
  if (!argentinaFeature) {
    return true;
  }

  // Validamos que Turf exista
  if (typeof turf === "undefined" ||
      !turf.point ||
      !turf.booleanPointInPolygon) {
    console.error("❌ Turf.js no está cargado correctamente.");
    return false;
  }

  const punto = turf.point([lon, lat]);
  return turf.booleanPointInPolygon(punto, argentinaFeature);
}