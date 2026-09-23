// Pantalla: diálogos modales con <dialog> (fondo oscuro, foco atrapado; el
// botón atrás de Android lo cierra como "cancelar").

import { h } from './dom.js';

/**
 * Muestra un diálogo y resuelve con el valor del botón elegido, o null si se cierra.
 * Si `valor` es una función, se llama al tocar el botón (p. ej. para leer un control).
 * @param {{titulo:string, cuerpo?:any, botones:Array<{etiqueta:string, valor:any, clase?:string}>, clase?:string}} opciones
 */
export function preguntar({ titulo, cuerpo = null, botones, clase = '' }) {
  return new Promise((resolver) => {
    let cerrado = false;
    const cerrar = (valor) => {
      if (cerrado) return;
      cerrado = true;
      dialogo.close();
      dialogo.remove();
      resolver(valor);
    };
    const dialogo = h(
      'dialog',
      { class: `dialogo ${clase}`.trim() },
      h('h2', { class: 'dialogo-titulo' }, titulo),
      cuerpo === null ? null : h('div', { class: 'dialogo-cuerpo' }, cuerpo),
      h(
        'div',
        { class: 'dialogo-botones' },
        botones.map((b) =>
          h(
            'button',
            {
              type: 'button',
              class: `boton ${b.clase ?? ''}`.trim(),
              onclick: () => cerrar(typeof b.valor === 'function' ? b.valor() : b.valor),
            },
            b.etiqueta,
          ),
        ),
      ),
    );
    dialogo.addEventListener('cancel', (evento) => {
      evento.preventDefault();
      cerrar(null);
    });
    document.body.append(dialogo);
    dialogo.showModal();
  });
}
