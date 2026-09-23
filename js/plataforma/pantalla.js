// Plataforma: pantalla despierta durante el entrenamiento (Wake Lock API).
// El navegador suelta el candado cuando la app se oculta; al volver se pide
// otra vez. Si el navegador no lo soporta, la app sigue igual sin avisar.

export function crearPantallaDespierta() {
  let deseado = false;
  let candado = null;

  async function pedir() {
    if (!deseado || candado || document.hidden || !('wakeLock' in navigator)) return;
    try {
      candado = await navigator.wakeLock.request('screen');
      candado.addEventListener('release', () => {
        candado = null;
      });
    } catch {
      candado = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pedir();
  });

  return {
    activar() {
      deseado = true;
      pedir();
    },
    desactivar() {
      deseado = false;
      candado?.release().catch(() => {});
      candado = null;
    },
    get activa() {
      return Boolean(candado);
    },
  };
}
