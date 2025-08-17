import { clusterGroup, mapa } from './map.js';
import { iconos } from './utils.js';

export function agruparPorUbicacion(reportes) {
  const grupos = {};
  reportes.forEach(r => {
    const key = `${r.lat},${r.lon}`;
    grupos[key] = grupos[key] || [];
    grupos[key].push(r);
  });
  return grupos;
}

export function distribuirEnCirculo(lat, lon, total, idx, radio = 0.002) {
  const ang = (2 * Math.PI / total) * idx;
  return [
    lat + radio * Math.cos(ang),
    lon + radio * Math.sin(ang)
  ];
}

export function dibujarReporte(reporte) {
  if (!reporte || !reporte.lat || !reporte.lon) {
    console.warn("⚠️ Reporte inválido:", reporte);
    return;
  }

  const nombre = reporte.ciudad || reporte.localidad || "Desconocida";
  const eventos = Array.isArray(reporte.tipo_evento)
    ? reporte.tipo_evento
    : [];
  const archivoUrl = reporte.archivo
    ? (reporte.archivo.startsWith("uploads/")
        ? `/${reporte.archivo}`
        : `/uploads/${reporte.archivo}`)
    : "";

  eventos.forEach((evt, i) => {
    const emoji = iconos[evt] || "❓";
    const divIco = L.divIcon({ className: "emoji-marker", html: emoji });
    const popup = `
      <strong>${nombre}</strong><br>
      ${reporte.fecha}<br>
      ${reporte.descripcion}<br>
      Evento: ${emoji} ${evt}<br>
      ${archivoUrl
        ? `<a href="${archivoUrl}" target="_blank">📎 Ver archivo</a>`
        : ""
      }
    `;

    const [latD, lonD] = distribuirEnCirculo(
      reporte.lat, reporte.lon, eventos.length, i
    );
    const marker = L.marker([latD, lonD], { icon: divIco })
      .bindPopup(popup)
      .addTo(clusterGroup);

    console.log(`🟢 Marcador dibujado: ${evt} en ${nombre} (${latD}, ${lonD})`);
  });

  // Lista lateral
  const lista = document.getElementById("lista-reportes");
  const iconosEvt = eventos.map(e => `${iconos[e] || "❓"} ${e}`).join(", ")
                   || "Ninguno";
  const item = document.createElement("li");
  item.innerHTML = `
    <strong>${reporte.fecha}</strong> - ${nombre}: ${reporte.descripcion}<br>
    Eventos: ${iconosEvt}<br>
    ${archivoUrl
      ? `<a href="${archivoUrl}" target="_blank">📎 Ver archivo</a>`
      : ""
    }
  `;
  lista.prepend(item);
}

export async function loadReportes() {
  try {
    const res = await fetch("http://127.0.0.1:8000/reportes/");
    const reportes = await res.json();

    const lista = document.getElementById("lista-reportes");
    lista.innerHTML = "";
    clusterGroup.clearLayers();

    const grupos = agruparPorUbicacion(reportes);
    let bounds = null, marcadorValido = 0;

    Object.values(grupos).forEach(grupo => {
      grupo.forEach(r => {
        if (r.lat && r.lon) {
          dibujarReporte(r);
          const punto = L.latLng(r.lat, r.lon);
          bounds = bounds
            ? bounds.extend(punto)
            : L.latLngBounds(punto, punto);
          marcadorValido++;
        } else {
          console.warn("⚠️ Reporte omitido por falta de coordenadas:", r);
        }
      });
    });

    if (bounds && marcadorValido > 0) {
      mapa.fitBounds(bounds);
      console.log("🗺️ Ajustando vista del mapa a los reportes");
    } else {
      console.log("ℹ️ No se ajusta el mapa porque no hay marcadores válidos.");
    }
  } catch (error) {
    console.error("❌ Error al cargar reportes:", error);
  }
}