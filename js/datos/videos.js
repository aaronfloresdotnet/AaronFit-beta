// Capa de datos: las ligas de video resueltas (videos.json, fase 4 del encargo).
// Es un archivo estático de la app: el service worker lo guarda con lo demás.

let promesa = null;

/** Devuelve el mapa { ligaOriginal: entrada } o {} si el archivo no está. */
export function cargarVideos() {
  promesa ??= fetch(new URL('./videos.json', import.meta.url))
    .then((respuesta) => (respuesta.ok ? respuesta.json() : { videos: {} }))
    .then((json) => json.videos ?? {})
    .catch(() => ({}));
  return promesa;
}
