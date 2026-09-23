// Pantalla: aviso breve en la parte de abajo ("Serie guardada", errores).
// Puede llevar un botón de acción (p. ej. "Deshacer").

import { h } from './dom.js';

export function crearAvisos() {
  const texto = h('span', { class: 'toast-texto' });
  const accion = h('button', { type: 'button', class: 'toast-accion', hidden: true });
  const zona = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true }, texto, accion);
  document.body.append(zona);
  let temporizador = null;
  let alTocar = null;

  accion.addEventListener('click', () => {
    const f = alTocar;
    zona.hidden = true;
    alTocar = null;
    f?.();
  });

  /**
   * @param {string} mensaje
   * @param {number} [milisegundos]
   * @param {{etiqueta:string, alTocar:() => void}} [conAccion]
   */
  return (mensaje, milisegundos = 2500, conAccion = null) => {
    texto.textContent = mensaje;
    alTocar = conAccion?.alTocar ?? null;
    accion.hidden = !conAccion;
    accion.textContent = conAccion?.etiqueta ?? '';
    zona.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      zona.hidden = true;
      alTocar = null;
    }, milisegundos);
  };
}
