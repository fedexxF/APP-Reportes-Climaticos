export const mapa = L.map("mapa").setView([-34.6, -58.4], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(mapa);

export const clusterGroup = L.markerClusterGroup();
mapa.addLayer(clusterGroup);

// Variable que almacenará el MultiPolygon de Argentina
export let argentinaFeature = null;

export function sombrearArgentina() {
  const worldRing = [
    [-90, -180], [-90, 180],
    [90, 180],  [90, -180],
    [-90, -180]
  ];

  mapa.whenReady(() => {
    fetch("https://raw.githubusercontent.com/georgique/world-geojson/master/countries/argentina.json")
      .then(res => res.json())
      .then(data => {
        let coordsArray = null;

        // Extraemos coordenadas según el tipo de GeoJSON
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

        // Asignamos el feature para validación en utils
        argentinaFeature = {
          type: "Feature",
          geometry: { type: "MultiPolygon", coordinates: coordsArray }
        };

        // Transformamos en anillos de lat/lon para dibujar
        const argRings = coordsArray.map(polygon => {
          const exterior = polygon[0];
          const latlngRing = exterior.map(([lon, lat]) => [lat, lon]);
          latlngRing.push(latlngRing[0]);
          return latlngRing;
        });

        L.polygon(
          [worldRing, ...argRings],
          { fillColor: "#999", fillOpacity: 0.5, stroke: false, interactive: false }
        ).addTo(mapa);
      })
      .catch(err => {
        console.error("❌ Error al cargar GeoJSON de Argentina:", err);
      });
  });
}