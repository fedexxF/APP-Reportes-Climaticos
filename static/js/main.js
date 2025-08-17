// 📍 Configuración inicial
const iconos = {
  "Granizo": "🌩️", "Viento": "💨", "Lluvia": "🌧️",
  "Tornado": "🌪️", "Rayo": "⚡", "Nubes": "☁️",
  "Frente de ráfagas": "🌬️"
};

const form = document.getElementById("formulario");
const lista = document.getElementById("lista-reportes");
const inputLocalidad = document.getElementById("localidad");
const btnUbicacion = document.getElementById("btn-ubicacion");

const mapa = L.map("mapa").setView([-34.6, -58.4], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(mapa);

const clusterGroup = L.markerClusterGroup();
mapa.addLayer(clusterGroup);

// 🗺️ Sombreado de Argentina
let argentinaFeature = null;

mapa.whenReady(() => {
  const worldRing = [
    [-90, -180], [-90, 180],
    [90, 180],  [90, -180],
    [-90, -180]
  ];

  fetch("https://raw.githubusercontent.com/georgique/world-geojson/master/countries/argentina.json")
    .then(res => res.json())
    .then(data => {
      let coordsArray = null;

      if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        coordsArray = data.features.flatMap(f => {
          const g = f.geometry;
          if (!g) return [];
          if (g.type === "MultiPolygon") return g.coordinates;
          if (g.type === "Polygon") return [g.coordinates];
          return [];
        });
      } else if (data.type === "Feature" && data.geometry) {
        const g = data.geometry;
        coordsArray = g.type === "MultiPolygon"
          ? g.coordinates
          : g.type === "Polygon"
            ? [g.coordinates]
            : null;
      } else if (data.type === "MultiPolygon") {
        coordsArray = data.coordinates;
      } else if (data.type === "Polygon") {
        coordsArray = [data.coordinates];
      } else if (data.type === "GeometryCollection") {
        coordsArray = data.geometries.flatMap(g => {
          if (g.type === "MultiPolygon") return g.coordinates;
          if (g.type === "Polygon") return [g.coordinates];
          return [];
        });
      }

      if (!coordsArray) {
        console.error("❌ No pude extraer coordenadas de este GeoJSON:", data);
        return;
      }

      argentinaFeature = {
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: coordsArray }
      };

      const argRings = coordsArray.map(polygon => {
        const exterior = polygon[0];
        const latlngRing = exterior.map(([lon, lat]) => [lat, lon]);
        latlngRing.push(latlngRing[0]);
        return latlngRing;
      });

      L.polygon([worldRing, ...argRings], {
        fillColor: "#999",
        fillOpacity: 0.5,
        stroke: false,
        interactive: false
      }).addTo(mapa);
    })
    .catch(err => {
      console.error("❌ Error al cargar GeoJSON de Argentina:", err);
    });
});

// 🌍 Reverse geocoding
const cacheLocalidad = new Map();
async function obtenerLocalidad(lat, lon) {
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
    const localidad = addr.city || addr.town || addr.village || addr.municipality || addr.county || "Desconocida";
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

// 📍 Botón de ubicación
btnUbicacion.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Tu navegador no soporta geolocalización.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
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
      const localidad = await obtenerLocalidad(lat, lon);
      inputLocalidad.value = localidad;
    },
    err => {
      alert("No se pudo obtener tu ubicación.");
      console.error(err);
    }
  );
});

// 📤 Envío de formulario
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  const tipo_evento = Array.from(
    document.querySelectorAll('input[name="tipo_evento"]:checked')
  ).map(i => i.value);

  formData.delete("tipo_evento");
  tipo_evento.forEach(evt => {
    formData.append("tipo_evento", evt);
  });

  const res = await fetch("http://127.0.0.1:8000/reportes/", {
    method: "POST",
    body: formData
  });

  if (res.ok) {
    alert("✅ Reporte enviado correctamente.");
    form.reset();
    const reporte = await res.json();
    dibujarReporte(reporte);
  } else {
    const error = await res.json();
    alert("❌ Error al enviar el reporte: " + (error?.detail?.[0]?.msg || error?.error || "Error desconocido"));
    console.error("🚨 Error al enviar:", error);
  }
});

// 📊 Visualización de reportes
function agruparPorUbicacion(reportes) {
  const grupos = {};
  reportes.forEach(r => {
    const key = `${r.lat},${r.lon}`;
    grupos[key] = grupos[key] || [];
    grupos[key].push(r);
  });
  return grupos;
}

function distribuirEnCirculo(lat, lon, total, idx, radio = 0.002) {
  const ang = (2 * Math.PI / total) * idx;
  return [lat + radio * Math.cos(ang), lon + radio * Math.sin(ang)];
}

function dibujarReporte(reporte) {
  if (!reporte || !reporte.lat || !reporte.lon) {
    console.warn("⚠️ Reporte inválido:", reporte);
    return;
  }

  const nombre = reporte.ciudad || reporte.localidad || "Desconocida";
  const eventos = Array.isArray(reporte.tipo_evento) ? reporte.tipo_evento : [];
  const archivoUrl = reporte.archivo?.startsWith("uploads/")
    ? `/${reporte.archivo}`
    : `/uploads/${reporte.archivo}`;

  eventos.forEach((evt, i) => {
    const emoji = iconos[evt] || "❓";
    const divIco = L.divIcon({ className: "emoji-marker", html: emoji });
    const popup = `
      <strong>${nombre}</strong><br>
      ${reporte.fecha}<br>
      ${reporte.descripcion}<br>
      Evento: ${emoji} ${evt}<br>
      ${archivoUrl ? `<a href="${archivoUrl}" target="_blank">📎 Ver archivo</a>` : ""}
    `;
        const [latD, lonD] = distribuirEnCirculo(reporte.lat, reporte.lon, eventos.length, i);
    const marker = L.marker([latD, lonD], { icon: divIco }).bindPopup(popup);
    marker.addTo(clusterGroup);
    console.log(`🟢 Marcador dibujado: ${evt} en ${nombre} (${latD}, ${lonD})`);
  });

  // 📝 Agregar a la lista lateral
  const iconosEvt = eventos.map(e => `${iconos[e] || "❓"} ${e}`).join(", ") || "Ninguno";
  const item = document.createElement("li");
  item.innerHTML = `
    <strong>${reporte.fecha}</strong> - ${nombre}: ${reporte.descripcion}<br>
    Eventos: ${iconosEvt}<br>
    ${archivoUrl ? `<a href="${archivoUrl}" target="_blank">📎 Ver archivo</a>` : ""}
  `;
  lista.prepend(item);
}

// 🔄 Inicializar cuando el DOM esté listo
window.addEventListener("DOMContentLoaded",
   async () => {
  console.log("Mapa cargado");

  try {
    const res = await fetch("http://127.0.0.1:8000/reportes/");
    const reportes = await res.json();

    lista.innerHTML = "";
    clusterGroup.clearLayers();

    const grupos = agruparPorUbicacion(reportes);
    let bounds = null;
    let marcadorValido = 0;

    Object.values(grupos).forEach(grupo => {
      grupo.forEach(r => {
        if (r.lat && r.lon) {
          dibujarReporte(r);
          const punto = L.latLng(r.lat, r.lon);
          bounds = bounds ? bounds.extend(punto) : L.latLngBounds(punto, punto);
          marcadorValido++;
        } else {
          console.warn("⚠️ Reporte omitido por falta de coordenadas:", r);
        }
      });
    });

    if (window.map && bounds && marcadorValido > 0) {
      window.map.fitBounds(bounds);
      console.log("🗺️ Ajustando vista del mapa a los reportes");
    } else {
      console.log("ℹ️ No se ajusta el mapa porque no hay marcadores válidos.");
    }
  } catch (error) {
    console.error("❌ Error al cargar reportes:", error);
  }
});

// 📌 Selección manual en el mapa
let marcadorManual;

mapa.on("click", async function (e) {
  const { lat, lng } = e.latlng;

  if (!dentroDeArgentina(lat, lng)) {
    alert("❌ Ubicación fuera de Argentina.");
    return;
  }

  document.getElementById("lat").value = lat.toFixed(6);
  document.getElementById("lon").value = lng.toFixed(6);

  const localidad = await obtenerLocalidadGeoref(lat, lng);
  inputLocalidad.value = localidad;

  mapa.setView([lat, lng], 8);

  if (marcadorManual) {
    marcadorManual.setLatLng([lat, lng]);
  } else {
    marcadorManual = L.marker([lat, lng], { draggable: true }).addTo(mapa);
    marcadorManual.on("dragend", async function (ev) {
      const pos = ev.target.getLatLng();
      document.getElementById("lat").value = pos.lat.toFixed(6);
      document.getElementById("lon").value = pos.lng.toFixed(6);

      if (!dentroDeArgentina(pos.lat, pos.lng)) {
        alert("❌ Ubicación fuera de Argentina.");
        return;
      }

      const localidadDrag = await obtenerLocalidadGeoref(pos.lat, pos.lng);
      inputLocalidad.value = localidadDrag;
    });
  }
});

// 📍 Validación geográfica dentro de Argentina
function dentroDeArgentina(lat, lon) {
  if (!(lat > -55 && lat < -21 && lon > -75 && lon < -53)) {
    return false;
  }

  if (!argentinaFeature) {
    return true;
  }

  if (typeof turf === "undefined" || !turf.point || !turf.booleanPointInPolygon) {
    console.error("❌ Turf.js no está cargado correctamente.");
    return false;
  }

  const punto = turf.point([lon, lat]);
  return turf.booleanPointInPolygon(punto, argentinaFeature);
}

// 🌎 Reverse geocoding con API de georef
async function obtenerLocalidadGeoref(lat, lon) {
  const url = `https://apis.datos.gob.ar/georef/api/ubicacion?lat=${lat}&lon=${lon}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const localidad = data.ubicacion.localidad?.nombre;
    const departamento = data.ubicacion.departamento?.nombre;
    const provincia = data.ubicacion.provincia?.nombre;

    if (localidad) {
      return localidad;
    } else if (departamento) {
      return `${departamento}, ${provincia}`;
    } else if (provincia) {
      return provincia;
    } else {
      return "Ubicación sin nombre";
    }
  } catch (error) {
    console.error("❌ Error al obtener localidad:", error);
    return "Error de geolocalización";
  }
}