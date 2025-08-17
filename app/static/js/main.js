import { sombrearArgentina } from './map.js';
import { setupGeolocation } from './geolocation.js';
import { setupForm } from './form.js';
import { loadReportes } from './reportes.js';
import { setupManualSelection } from './seleccion_manual.js';

window.addEventListener("DOMContentLoaded", async () => {
  sombrearArgentina();
  setupGeolocation();
  setupForm();
  setupManualSelection();
  await loadReportes();
});