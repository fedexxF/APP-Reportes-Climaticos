import { dibujarReporte } from './reportes.js';

export function setupForm() {
  const form = document.getElementById("formulario");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const tipos = Array.from(
      document.querySelectorAll('input[name="tipo_evento"]:checked')
    ).map(i => i.value);

    formData.set("tipo_evento", JSON.stringify(tipos));

    try {
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
        const errJson = await res.json();
        const msg = errJson?.detail?.[0]?.msg
                  || errJson?.error
                  || "Error desconocido";
        alert("❌ Error al enviar el reporte: " + msg);
        console.error("🚨 Error al enviar:", errJson);
      }
    } catch (err) {
      alert("❌ Error de red al enviar reporte.");
      console.error("🚨 Fetch error:", err);
    }
  });
}