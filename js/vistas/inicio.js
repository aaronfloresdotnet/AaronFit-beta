// Pantalla: Inicio (encargo 6.2). Lo que toca hoy, la semana con sus marcas,
// y si hay un día perdido, la pregunta de saltar o recorrer (la app no decide).

import { h, pintar } from '../componentes/dom.js';
import { preguntar } from '../componentes/dialogo.js';
import { INICIALES_DIA, fechaCorta, fechaLarga, partesDia } from '../logica/formato.js';

const ICONO = { hecho: '✓', en_curso: '◐', saltado: '✕', no_cabe: '✕', no_hecho: '✕', vencido: '!', hoy: '●', pendiente: '·' };
const ESTADO = {
  hecho: 'hecho', en_curso: 'en curso', saltado: 'saltado', no_cabe: 'no cupo', no_hecho: 'no hecho',
  vencido: 'pendiente', hoy: 'hoy', pendiente: 'por venir',
};

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export async function montar(raiz, _parametros, app) {
  const d = await app.servicios.entrenamiento.resumenInicio();
  const enCursoOtroDia = d.enCurso && d.enCurso.diaSemanaPlan !== d.hoyToca?.dia ? d.enCurso : null;

  pintar(
    raiz,
    h(
      'header',
      { class: 'encabezado' },
      h('div', { class: 'marca' }, app.config.nombre, app.config.variante === 'beta' ? h('span', { class: 'insignia-beta' }, 'prueba') : null),
      h('div', { class: 'encabezado-fecha' }, mayuscula(fechaLarga(d.fecha))),
      h('div', { class: 'encabezado-semana' }, `Semana ${Number(d.semana.slice(6))} del año · semana ${d.semanaPrograma} del programa`),
    ),
    enCursoOtroDia ? tarjetaEnCurso(enCursoOtroDia) : null,
    d.vencido ? tarjetaVencido(d) : tarjetaHoy(d),
    d.caminata ? tarjetaCaminata(d.caminata) : null,
    tiraSemana(d),
    d.recordarMedidas ? h('a', { class: 'tarjeta recordatorio', href: '#/medidas' }, 'Es sábado: toca tomarte medidas ›') : null,
  );

  async function entrenar(dia) {
    const id = await app.servicios.entrenamiento.iniciarSesion(dia);
    app.ir(`#/dia/${id}`);
  }

  function tarjetaHoy(datos) {
    if (datos.hoyToca) {
      const { dia, nombre } = partesDia(datos.hoyToca.nombre);
      const continuar = datos.enCurso?.diaSemanaPlan === datos.hoyToca.dia;
      return h(
        'section',
        { class: 'tarjeta tarjeta-hoy' },
        h('div', { class: 'etiqueta' }, 'Hoy toca'),
        h('h1', { class: 'titulo-hoy' }, nombre),
        h('p', { class: 'sub' }, `${dia} · ${datos.hoyToca.ejercicios} ejercicios${datos.hoyToca.recorrido ? ' · recorrido' : ''}`),
        continuar ? h('p', { class: 'sub' }, `Vas en ${datos.enCurso.hechas} de ${datos.enCurso.total} series`) : null,
        h('button', { type: 'button', class: 'boton primario enorme', onclick: () => entrenar(datos.hoyToca.dia) }, continuar ? 'Continuar' : 'Entrenar'),
      );
    }
    if (datos.hechasHoy.length) {
      return h(
        'section',
        { class: 'tarjeta tarjeta-hoy hecho' },
        h('div', { class: 'etiqueta' }, 'Hoy'),
        h('h1', { class: 'titulo-hoy' }, '¡Listo por hoy!'),
        datos.hechasHoy.map((s) =>
          h('a', { class: 'fila-simple', href: `#/dia/${s.id}` }, `✓ ${partesDia(s.diaRutina).nombre} · ${s.hechas} de ${s.total} series ›`),
        ),
      );
    }
    return h(
      'section',
      { class: 'tarjeta tarjeta-hoy' },
      h('div', { class: 'etiqueta' }, 'Hoy'),
      h('h1', { class: 'titulo-hoy' }, 'Hoy no toca fuerza'),
      h('p', { class: 'sub' }, datos.caminata ? 'Toca caminata.' : 'Descansa.'),
    );
  }

  function tarjetaVencido(datos) {
    const { dia, nombre } = partesDia(datos.vencido.nombre);
    const noCabrian = datos.vencido.noCabrian.map((n) => partesDia(n).nombre);
    return h(
      'section',
      { class: 'tarjeta tarjeta-pregunta' },
      h('div', { class: 'etiqueta aviso' }, 'Día pendiente'),
      h('h1', { class: 'titulo-hoy' }, `${dia}: ${nombre}`),
      h('p', {}, 'No se entrenó y ya pasó su día. ¿Qué hacemos?'),
      h(
        'div',
        { class: 'opciones' },
        h(
          'button',
          { type: 'button', class: 'boton opcion', onclick: () => decidir('saltar') },
          h('strong', {}, 'Saltarlo'),
          h('span', {}, 'Queda como no hecho y sigues con lo que toca hoy.'),
        ),
        h(
          'button',
          { type: 'button', class: 'boton opcion', onclick: () => decidir('recorrer') },
          h('strong', {}, 'Recorrerlo'),
          h(
            'span',
            {},
            `Hoy entrenas ${nombre} y el resto de la semana se corre un día.`,
            noCabrian.length ? ` Ya no cabría antes del domingo: ${noCabrian.join(', ')}.` : '',
          ),
        ),
      ),
    );

    async function decidir(accion) {
      await app.servicios.entrenamiento.decidirDiaVencido(datos.vencido.dia, accion);
      app.refrescar();
    }
  }

  function tarjetaCaminata(c) {
    return h(
      'section',
      { class: 'tarjeta' },
      h('div', { class: 'etiqueta' }, 'Caminata'),
      h('h2', {}, c.primero),
      h('p', { class: 'sub' }, '30 min. No se recorre ni bloquea nada.'),
      h('button', { type: 'button', class: 'boton primario', onclick: () => entrenar(c.dia) }, 'Registrar caminata'),
    );
  }

  function tarjetaEnCurso(s) {
    return h(
      'section',
      { class: 'tarjeta tarjeta-pregunta' },
      h('div', { class: 'etiqueta aviso' }, 'Sin terminar'),
      h('h2', {}, `${partesDia(s.diaRutina).nombre} del ${fechaCorta(s.fecha)}`),
      h('p', { class: 'sub' }, `${s.hechas} de ${s.total} series`),
      h(
        'div',
        { class: 'botones-fila' },
        h('a', { class: 'boton primario', href: `#/dia/${s.id}` }, 'Continuar'),
        h('button', { type: 'button', class: 'boton', onclick: () => terminar(s) }, 'Terminarlo'),
      ),
    );
  }

  async function terminar(s) {
    const faltan = s.total - s.hechas;
    const ok = await preguntar({
      titulo: '¿Terminar ese entrenamiento?',
      cuerpo: s.hechas ? `Las ${faltan} series que faltan quedan como saltadas.` : 'No tiene series hechas: el día quedará como no hecho.',
      botones: [
        { etiqueta: 'Cancelar', valor: false },
        { etiqueta: 'Terminar', valor: true, clase: 'primario' },
      ],
    });
    if (!ok) return;
    await app.servicios.entrenamiento.terminarSesion(s.id);
    app.refrescar();
  }
}

function tiraSemana(d) {
  return h(
    'section',
    { class: 'semana-bloque' },
    h('h2', { class: 'subtitulo' }, 'Esta semana'),
    h(
      'ol',
      { class: 'semana' },
      d.dias.map((x) => {
        const partes = partesDia(x.nombre);
        return h(
          'li',
          { class: `dia-chip ${x.estado}`, title: `${partes.dia} ${partes.nombre}: ${ESTADO[x.estado]}` },
          h('span', { class: 'dia-inicial', 'aria-hidden': 'true' }, INICIALES_DIA[x.dia]),
          h('span', { class: 'dia-icono', 'aria-hidden': 'true' }, ICONO[x.estado]),
          h('span', { class: 'solo-lector' }, `${partes.dia}: ${ESTADO[x.estado]}`),
        );
      }),
    ),
    h('p', { class: 'leyenda' }, '✓ hecho · ● hoy · ! pendiente · ✕ no hecho · ◐ en curso'),
  );
}
