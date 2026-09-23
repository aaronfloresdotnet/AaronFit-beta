// Pantalla: Día (encargo 6.3). Los ejercicios en su orden, cada uno con su
// grupo, series por repeticiones y avance. Tocar uno abre la captura.

import { h, pintar } from '../componentes/dom.js';
import { preguntar } from '../componentes/dialogo.js';
import { duracion, partesDia } from '../logica/formato.js';

export async function montar(raiz, [sesionId], app) {
  const datos = await app.servicios.entrenamiento.datosDia(Number(sesionId));
  if (!datos) return app.noEncontrado();
  const { sesion, ejercicios, siguiente } = datos;
  const { dia, nombre } = partesDia(sesion.diaRutina);
  const enCurso = sesion.estado === 'en_curso';
  if (enCurso) app.pantalla.activar();

  pintar(
    raiz,
    h(
      'nav',
      { class: 'barra-superior' },
      h('a', { class: 'boton-icono', href: '#/', 'aria-label': 'Volver al inicio' }, '‹'),
      h('div', { class: 'barra-titulo' }, h('strong', {}, nombre), h('span', {}, `${dia} · ${sesion.hechas} de ${sesion.total} series`)),
      h('span', { class: 'boton-icono vacio' }),
    ),
    sesion.estado === 'completa' ? resumenFinal() : null,
    enCurso && siguiente
      ? h(
          'button',
          { type: 'button', class: 'boton primario enorme', onclick: () => app.ir(`#/ejercicio/${sesion.id}/${siguiente}`) },
          sesion.hechas ? 'Seguir' : 'Empezar',
        )
      : null,
    h('ol', { class: 'lista-ejercicios' }, ejercicios.map(fila)),
    enCurso ? h('button', { type: 'button', class: 'boton secundario ancho', onclick: terminar }, 'Terminar entrenamiento') : null,
  );

  function fila({ ejercicio: e, hechas, saltadas, total, terminado, subio }) {
    const estado = terminado ? (hechas === 0 ? 'saltado' : 'hecho') : e.id === siguiente ? 'siguiente' : hechas ? 'a-medias' : '';
    return h(
      'li',
      {},
      h(
        'a',
        { class: `fila-ejercicio ${estado}`, href: `#/ejercicio/${sesion.id}/${e.id}` },
        h('span', { class: 'fila-marca' }, terminado ? (hechas === 0 ? '✕' : '✓') : `${hechas}/${total}`),
        h(
          'span',
          { class: 'fila-texto' },
          h('span', { class: 'fila-nombre' }, e.ejercicio, subio ? h('span', { class: 'insignia' }, '↑ subió') : null),
          h('span', { class: 'fila-meta' }, `${e.grupo} · ${e.series} × ${e.repsTexto}`, saltadas && hechas ? ` · ${saltadas} saltadas` : ''),
        ),
        h('span', { class: 'fila-flecha', 'aria-hidden': 'true' }, '›'),
      ),
    );
  }

  function resumenFinal() {
    const segundos = sesion.fin ? (Date.parse(sesion.fin) - Date.parse(sesion.inicio)) / 1000 : 0;
    return h(
      'section',
      { class: 'tarjeta tarjeta-hoy hecho' },
      h('div', { class: 'etiqueta' }, 'Terminado'),
      h('h1', { class: 'titulo-hoy' }, '¡Entrenamiento terminado!'),
      h('p', { class: 'sub' }, `${sesion.hechas} de ${sesion.total} series${segundos > 0 ? ` · ${duracion(segundos)}` : ''}`),
      h('a', { class: 'boton primario', href: '#/' }, 'Volver al inicio'),
    );
  }

  async function terminar() {
    const faltan = sesion.total - sesion.hechas;
    const cuerpo = sesion.hechas === 0
      ? 'No has hecho ninguna serie: el día seguirá pendiente.'
      : faltan
        ? `Te faltan ${faltan} series; quedarán como saltadas.`
        : 'Ya hiciste todas las series.';
    const ok = await preguntar({
      titulo: '¿Terminar el entrenamiento?',
      cuerpo,
      botones: [
        { etiqueta: 'Seguir entrenando', valor: false },
        { etiqueta: 'Terminar', valor: true, clase: 'primario' },
      ],
    });
    if (!ok) return;
    await app.servicios.entrenamiento.terminarSesion(sesion.id);
    app.pantalla.desactivar();
    if (sesion.hechas === 0) app.ir('#/', { reemplazar: true });
    else app.refrescar();
  }
}
