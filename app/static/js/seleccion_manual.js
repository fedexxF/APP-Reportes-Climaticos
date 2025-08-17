import { mapa } from './map.js';
import { dentroDeArgentina } from './utils.js';
import { obtenerLocalidadGeoref } from './geolocation.js';

export function setupManualSelection() {
  let marcadorManual;
  const inputLocalidad = document.getElementById("localidad");
  const inputLat = document.getElementById("lat");
  const inputLon = document.getElementById("lon");

  mapa.on("click", async (e) => {
    const { lat, lng } = e.latlng;

    if (!dentroDeArgentina(lat, lng)) {
      alert("❌ Ubicación fuera de Argentina.");
      return;
    }

    inputLat.value = lat.toFixed(6);
    inputLon.value = lng.toFixed(6);

    const localidad = await obtenerLocalidadGeoref(lat, lng);
    inputLocalidad.value = localidad;
    mapa.setView([lat, lng], 8);

    if (marcadorManual) {
      marcadorManual.setLatLng([lat, lng]);
    } else {
      marcadorManual = L.marker([lat, lng], { draggable: true }).addTo(mapa);
      marcadorManual.on("dragend", async (ev) => {
        const pos = ev.target.getLatLng();
        if (!dentroDeArgentina(pos.lat, pos.lng)) {
          alert("❌ Ubicación fuera de Argentina.");
          return;
        }
        inputLat.value = pos.lat.toFixed(6);
        inputLon.value = pos.lng.toFixed(6);
        const locDrag = await obtenerLocalidadGeoref(pos.lat, pos.lng);
        inputLocalidad.value = locDrag;
      });
    }
  });
}