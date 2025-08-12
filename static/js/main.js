// 📍 Configuración inicial
const iconos = {
  "Granizo": "🌩️", "Viento": "💨", "Lluvia": "🌧️",
  "Tornado": "🌪️", "Rayo": "⚡", "Nubes": "☁️",
  "Frente de ráfagas": "🌬️"
};

const form = document.getElementById("formulario");
const lista = document.getElementById("lista-reportes");
const inputCiudad = document.getElementById("ciudad");
const inputLocalidad = document.getElementById("localidad");
const btnUbicacion = document.getElementById("btn-ubicacion");

const mapa = L.map("mapa").setView([-34.6, -58.4], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(mapa);

const clusterGroup = L.markerClusterGroup();
mapa.addLayer(clusterGroup);


// 🗺️ Sombreado de Argentina (compatible con cualquier formato)
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
      console.log("🔍 GeoJSON Argentina raw:", data);

      let coordsArray = null;

      // 1) FeatureCollection
      if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        coordsArray = data.features.flatMap(f => {
          const g = f.geometry;
          if (!g) return [];
          if (g.type === "MultiPolygon") return g.coordinates;
          if (g.type === "Polygon") return [g.coordinates];
          return [];
        });

      // 2) Feature
      } else if (data.type === "Feature" && data.geometry) {
        const g = data.geometry;
        coordsArray = g.type === "MultiPolygon"
          ? g.coordinates
          : g.type === "Polygon"
            ? [g.coordinates]
            : null;

      // 3) MultiPolygon puro
      } else if (data.type === "MultiPolygon" && Array.isArray(data.coordinates)) {
        coordsArray = data.coordinates;

      // 4) Polygon puro
      } else if (data.type === "Polygon" && Array.isArray(data.coordinates)) {
        coordsArray = [data.coordinates];

      // 5) GeometryCollection
      } else if (data.type === "GeometryCollection" && Array.isArray(data.geometries)) {
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

      // Guardamos un Feature estándar para turf
      argentinaFeature = {
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: coordsArray }
      };

      // Transformar lon/lat → lat/lon y crear anillos exteriores
      const argRings = coordsArray.map(polygon => {
        const exterior = polygon[0];
        const latlngRing = exterior.map(([lon, lat]) => [lat, lon]);
        latlngRing.push(latlngRing[0]);
        return latlngRing;
      });

      // Dibujar
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
const cacheCiudad = new Map();
async function obtenerCiudad(lat, lon) {
  const clave = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cacheCiudad.has(clave)) {
    inputCiudad.value = cacheCiudad.get(clave);
    return cacheCiudad.get(clave);
  }

  inputCiudad.value = "";
  inputCiudad.placeholder = "Buscando ciudad…";
  inputCiudad.classList.add("loading");
  inputCiudad.disabled = true;

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
    const ciudad = addr.city || addr.town || addr.village || addr.municipality || addr.county || "Desconocida";
    cacheCiudad.set(clave, ciudad);
    inputCiudad.value = ciudad;
    return ciudad;
  } catch {
    inputCiudad.placeholder = "Ciudad (no disponible)";
    return "Desconocida";
  } finally {
    clearTimeout(timeoutId);
    inputCiudad.disabled = false;
    inputCiudad.classList.remove("loading");
    inputCiudad.placeholder = "Ciudad";
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
      const ciudad = await obtenerCiudad(lat, lon);
      inputLocalidad.value = ciudad;
    },
    err => {
      alert("No se pudo obtener tu ubicación.");
      console.error(err);
    }
  );
});

// 📤 Envío de formulario
form.addEventListener("submit", async e => {
  e.preventDefault();
  const formData = new FormData(form);
  formData.delete("tipo_evento");
  const eventosSeleccionados = Array.from(
    document.querySelectorAll('input[name="tipo_evento"]:checked')
  ).map(i => i.value);
  formData.append("tipo_evento", JSON.stringify(eventosSeleccionados));

  const res = await fetch("http://127.0.0.1:8000/reportes/", {
    method: "POST",
    body: formData
  });
  if (res.ok) {
    alert("Reporte enviado");
    form.reset();
    cargarReportes();
  } else {
    alert("Error al enviar el reporte");
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

async function cargarReportes() {
  const res = await fetch("http://127.0.0.1:8000/reportes/");
  const reportes = await res.json();
  lista.innerHTML = "";
  clusterGroup.clearLayers();

  const grupos = agruparPorUbicacion(reportes);
  Object.values(grupos).forEach(grupo => {
    const eventosTot = [];
    grupo.forEach(r => {
      if (r.lat && r.lon && Array.isArray(r.tipo_evento)) {
        r.tipo_evento.forEach(evt =>
          eventosTot.push({
            evento: evt,
            ciudad: r.ciudad,
            fecha: r.fecha,
            descripcion: r.descripcion,
            archivo: r.archivo,
            lat: r.lat,
            lon: r.lon
          })
        );
      }

      const iconosEvt = r.tipo_evento
        ?.map(e => `${iconos[e] || "❓"} ${e}`)
        .join(", ") || "Ninguno";

      const item = document.createElement("li");
      item.innerHTML = `
        <strong>${r.fecha}</strong> - ${r.ciudad}: ${r.descripcion}<br>
        Eventos: ${iconosEvt}<br>
        ${r.archivo ? `<a href="/${r.archivo}" target="_blank">📎 Ver archivo</a>` : ""}
      `;
      lista.appendChild(item);
    });

    eventosTot.forEach((ev, i) => {
      const emoji = iconos[ev.evento] || "❓";
      const divIco = L.divIcon({ className: "emoji-marker", html: emoji });
      const popup = `
        <strong>${ev.ciudad}</strong><br>
        ${ev.fecha}<br>
        ${ev.descripcion}<br>
        Evento: ${emoji} ${ev.evento}<br>
        ${ev.archivo ? `<a href="/${ev.archivo}" target="_blank">📎 Ver archivo</a>` : ""}
      `;
      const [latD, lonD] = distribuirEnCirculo(ev.lat, ev.lon, eventosTot.length, i);
      L.marker([latD, lonD], { icon: divIco })
        .bindPopup(popup)
        .addTo(clusterGroup);
    });
  });
}
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

  const ciudad = await obtenerCiudad(lat, lng);
  inputLocalidad.value = ciudad;

  if (marcadorManual) {
    marcadorManual.setLatLng(e.latlng);
  } else {
    marcadorManual = L.marker(e.latlng, { draggable: true }).addTo(mapa);
    marcadorManual.on("dragend", async function (ev) {
      const pos = ev.target.getLatLng();
      document.getElementById("lat").value = pos.lat.toFixed(6);
      document.getElementById("lon").value = pos.lng.toFixed(6);

      if (!dentroDeArgentina(pos.lat, pos.lng)) {
        alert("❌ Ubicación fuera de Argentina.");
        return;
      }

      const ciudadDrag = await obtenerCiudad(pos.lat, pos.lng);
      inputLocalidad.value = ciudadDrag;
    });
  }
});


// 🔄 Inicializar
console.log("Mapa cargado");
cargarReportes();// 🔄 Inicializar

function dentroDeArgentina(lat, lon) {
  // 1) Bounding box pequeña para descartar rápido
  if (lat < -55 || lat > -21 || lon < -75 || lon > -53) {
    return false;
  }

  // 2) Polígono detallado
  if (!argentinaFeature) {
    // Mientras carga el GeoJSON, asumimos verdadero dentro del bbox
    return true;
  }
  const punto = turf.point([lon, lat]);
  return turf.booleanPointInPolygon(punto, argentinaFeature);
}
console.log("Mapa cargado");
cargarReportes();