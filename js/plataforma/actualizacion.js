// Plataforma: registro del service worker y aviso de versión nueva.
// En desarrollo (localhost) no se registra, para no servir archivos viejos;
// se puede forzar con ?sw en la dirección.

export function registrarServiceWorker({ alHaberNuevaVersion }) {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;

  // Si ya había un service worker, un cambio de controlador es una versión nueva.
  // Si no había, es la primera instalación y no hay nada que recargar.
  const habiaControlador = Boolean(navigator.serviceWorker.controller);
  let avisado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || avisado) return;
    avisado = true;
    alHaberNuevaVersion();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registro) => {
      // Al volver a la app, buscar si hay versión nueva.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registro.update().catch(() => {});
      });
    })
    .catch(() => {});
}
