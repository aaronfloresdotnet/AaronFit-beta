// Pantalla: aviso breve en la parte de abajo ("Serie guardada", errores).

import { h } from './dom.js';

export function crearAvisos() {
  const zona = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
  document.body.append(zona);
  let temporizador = null;
  return (texto, milisegundos = 2500) => {
    zona.textContent = texto;
    zona.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      zona.hidden = true;
    }, milisegundos);
  };
}
