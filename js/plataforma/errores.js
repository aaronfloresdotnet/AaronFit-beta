// Plataforma: registro local de errores, para copiarlo y pegárselo a Claude.
// Se guarda en localStorage (sobrevive a recargas y no depende de IndexedDB,
// que puede ser justo lo que falló). La llave lleva el nombre de la base para
// que la app real y la beta, que comparten dominio, no mezclen sus errores.

import { CONFIG } from '../config.js';

const LLAVE = `${CONFIG.nombreBD}:errores`;
const MAXIMO = 30;

export function leerErrores() {
  try {
    return JSON.parse(localStorage.getItem(LLAVE) ?? '[]');
  } catch {
    return [];
  }
}

export function registrarError(error, contexto = '') {
  const registro = {
    hora: new Date().toISOString(),
    ruta: location.hash || '#/',
    contexto,
    mensaje: String(error?.message ?? error),
    pila: String(error?.stack ?? '').split('\n').slice(0, 6).join('\n'),
  };
  try {
    localStorage.setItem(LLAVE, JSON.stringify([...leerErrores(), registro].slice(-MAXIMO)));
  } catch {
    // Sin almacenamiento no hay registro; la app sigue.
  }
}

export function borrarErrores() {
  try {
    localStorage.removeItem(LLAVE);
  } catch {
    // nada que hacer
  }
}

export function escucharErrores() {
  window.addEventListener('error', (evento) => registrarError(evento.error ?? evento.message, 'error'));
  window.addEventListener('unhandledrejection', (evento) => registrarError(evento.reason, 'promesa'));
}

/** Texto listo para pegarle a Claude: versión, teléfono y cada error. */
export function textoParaClaude(lista = leerErrores()) {
  const encabezado = [
    `Errores de ${CONFIG.nombre} (${CONFIG.variante}, versión ${CONFIG.version})`,
    `Navegador: ${navigator.userAgent}`,
    `Copiado: ${new Date().toISOString()}`,
    `Total: ${lista.length}`,
  ];
  const cuerpo = lista.map((e, i) =>
    [`#${i + 1} ${e.hora} en ${e.ruta}${e.contexto ? ` (${e.contexto})` : ''}`, e.mensaje, e.pila].filter(Boolean).join('\n'),
  );
  return [...encabezado, '', ...cuerpo].join('\n');
}
