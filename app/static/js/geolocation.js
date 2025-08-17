import { mapa } from './map.js';
import { dentroDeArgentina } from './utils.js';

let inputLocalidad;
const cacheLocalidad = new Map();

export async function obtenerLocalidad(lat, lon) {
  const clave = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cacheLocalidad.has(clave)) {
    inputLocalidad.value = cacheLocalidad.get(clave);
    return cacheLocalidad.get(clave);
  }

  inputLocalidad.value = "";
  inputLocalidad.placeholder = "Buscando localidad…";
  inputLocalidad.classList.add("loading");
  inputLocalidad.disabled = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=es`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "tu-app/1.0 (contacto@tudominio.com)" }
    });
    if (!res.ok) throw new Error(res.statusText);

    const data = await res.json();
    const addr = data.address || {};
    const localidad = addr.city || addr.town || addr.village ||
                      addr.municipality || addr.county || "Desconocida";
    cacheLocalidad.set(clave, localidad);
    inputLocalidad.value = localidad;
    return localidad;
  } catch {
    inputLocalidad.placeholder = "Localidad (no disponible)";
    return "Desconocida";
  } finally {
    clearTimeout(timeoutId);
    inputLocalidad.disabled = false;
    inputLocalidad.classList.remove("loading");
    inputLocalidad.placeholder = "Localidad";
  }
}

export async function obtenerLocalidadGeoref(lat, lon) {
  try {
    const url = `https://apis.datos.gob.ar/georef/api/ubicacion?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    const data = await response.json();
    const loc = data.ubicacion;
    const nombre = loc.localidad?.nombre ||
                   loc.departamento?.nombre ||
                   loc.provincia?.nombre ||
                   "Ubicación sin nombre";
    return nombre;
  } catch (error) {
    console.error("❌ Error al obtener localidad:", error);
    return "Error de geolocalización";
  }
}

export function setupGeolocation() {
  inputLocalidad = document.getElementById("localidad");
  const btnUbicacion = document.getElementById("btn-ubicacion");

  btnUbicacion.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = +pos.coords.latitude.toFixed(6);
        const lon = +pos.coords.longitude.toFixed(6);

        if (!dentroDeArgentina(lat, lon)) {
          alert("❌ Tu ubicación está fuera de Argentina.");
          return;
        }

        document.getElementById("lat").value = lat;
        document.getElementById("lon").value = lon;
        mapa.setView([lat, lon], 7);
        L.circle([lat, lon], { radius: 100, color: "blue" }).addTo(mapa);

        await obtenerLocalidad(lat, lon);
      },
      (err) => {
        alert("No se pudo obtener tu ubicación.");
        console.error(err);
      }
    );
  });
}