// Pantalla: Avance (tanda 2). La semana, tu constancia, cada ejercicio con su
// gráfica y sus récords, y las series por grupo muscular.

import { h, pintar } from '../componentes/dom.js';
import { crearGrafica } from '../componentes/grafica.js';
import * as formato from '../logica/formato.js';

// El ejercicio que estabas viendo, mientras la app siga abierta.
let elegido = null;

const ICONO = { hecho: '✓', recorrido: '↻', saltado: '–', no_hecho: '✕', en_curso: '◐', pendiente: '!', hoy: '●', por_venir: '·', antes: '' };
const NOMBRE = {
  hecho: 'hecho', recorrido: 'hecho, recorrido', saltado: 'saltado', no_hecho: 'no hecho', en_curso: 'sin terminar',
  pendiente: 'pendiente', hoy: 'hoy', por_venir: 'por venir', antes: 'antes de empezar',
};
const LEYENDA = [['hecho', 'hecho'], ['recorrido', 'recorrido'], ['saltado', 'saltado'], ['no_hecho', 'no hecho'], ['en_curso', 'sin terminar'], ['hoy', 'hoy']];

const reps = (tipoMedida) => (tipoMedida === 'reps' ? ' reps' : '');
const SUFIJO = { reps: 'reps', segundos: 's', minutos: 'min', metros: 'm' };
const NOMBRE_MEDIDA = { reps: 'Repeticiones', segundos: 'Segundos', minutos: 'Minutos', metros: 'Metros' };
const unDecimal = (v) => (v === null ? null : Math.round(v * 10) / 10);

export async function montar(raiz, _parametros, app) {
  const d = await app.servicios.avance.resumen();
  let grafica = null;

  if (!d.hayDatos) {
    pintar(
      raiz,
      h('h1', { class: 'titulo-seccion' }, 'Avance'),
      h('section', { class: 'tarjeta' }, h('p', {}, 'Todavía no hay series registradas. Aquí vas a ver tu semana, tu constancia, tus récords y la gráfica de cada ejercicio.')),
    );
    return undefined;
  }

  const panel = h('div', { class: 'panel-ejercicio' });
  elegido = d.ejercicios.some((e) => e.clave === elegido) ? elegido : d.porDefecto;
  await pintarEjercicio(elegido);

  pintar(
    raiz,
    h('h1', { class: 'titulo-seccion' }, 'Avance'),
    tarjetaSemana(d.semana, 'Esta semana'),
    d.semanaPasada ? tarjetaSemana(d.semanaPasada, 'La semana pasada') : null,
    tarjetaConstancia(d.constancia),
    tarjetaEstancados(d.estancados),
    tarjetaEjercicio(),
    tarjetaGrupos(d.grupos),
  );
  return () => grafica?.destruir();

  function tarjetaEjercicio() {
    const porDia = Map.groupBy(d.ejercicios, (e) => e.dia);
    const selector = h(
      'select',
      { class: 'entrada-select', 'aria-label': 'Ejercicio', onchange: (evento) => pintarEjercicio((elegido = evento.target.value)) },
      [...porDia].map(([dia, lista]) => {
        const partes = formato.partesDia(dia);
        return h(
          'optgroup',
          { label: `${partes.dia} · ${partes.nombre}` },
          lista.map((e) => h('option', { value: e.clave, selected: e.clave === elegido }, e.nombre)),
        );
      }),
    );
    return h('section', { class: 'tarjeta' }, h('h2', {}, 'Por ejercicio'), selector, panel);
  }

  async function pintarEjercicio(clave) {
    const datos = clave ? await app.servicios.avance.ejercicio(clave) : null;
    grafica?.destruir();
    grafica = null;
    if (!datos || !datos.puntos.length) {
      pintar(panel, h('p', { class: 'nota' }, 'Sin series de este ejercicio.'));
      return;
    }
    const conPeso = datos.unidad !== 'corporal';
    const unidad = `${datos.unidad}${datos.pesoPorLado ? ' c/u' : ''}${datos.pesoNota === '+ barra' ? ' + barra' : ''}`;
    // Sin peso se grafica la mejor serie; los minutos se guardan en segundos.
    const enPantalla = (v) => (v === null ? null : datos.tipoMedida === 'minutos' ? v / 60 : v);
    const texto = conPeso ? (v) => `${formato.numero(v)} ${unidad}` : (v) => `${formato.numero(unDecimal(v))} ${SUFIJO[datos.tipoMedida]}`;
    const series = conPeso
      ? [
          { nombre: 'Peso de trabajo', valores: datos.puntos.map((p) => p.peso) },
          ...(datos.tipoMedida === 'reps' ? [{ nombre: '1RM estimado', valores: datos.puntos.map((p) => unDecimal(p.e1rm)) }] : []),
        ]
      : [{ nombre: 'Mejor serie', valores: datos.puntos.map((p) => enPantalla(p.valor)) }];
    grafica = crearGrafica({
      titulo: `${datos.nombre}: ${series.map((s) => s.nombre).join(' y ')} por sesión`,
      fechas: datos.puntos.map((p) => p.fecha),
      series,
      formato: texto,
      marcas: datos.marcas.map((m) => ({ indice: m.indice, texto: m.avisos.map(textoAviso).join(' · ') })),
    });
    pintar(
      panel,
      datos.nota ? h('p', { class: 'nota-ejercicio' }, h('span', { class: 'nota-icono', 'aria-hidden': 'true' }, '✎'), h('span', {}, datos.nota.texto)) : null,
      bloqueRecords(datos, texto, enPantalla),
      h(
        'p',
        { class: 'nota' },
        conPeso ? `En ${unidad}, por sesión.` : `${NOMBRE_MEDIDA[datos.tipoMedida]} de tu mejor serie, por sesión.`,
        datos.recortadas ? ` Se ven las últimas ${datos.puntos.length} sesiones.` : '',
      ),
      grafica.elemento,
      datos.records?.omitidas
        ? h('p', { class: 'nota' }, `La gráfica y los récords usan solo tus sesiones en ${datos.unidad}: no cuentan ${datos.records.omitidas} sesiones anteriores en otra unidad o sin peso.`)
        : null,
    );
  }

  function textoAviso(a) {
    if (a.implemento) return `cambiar a ${a.implemento}${'peso' in a ? ` (${formato.peso(a.peso, a.unidadPeso, a.pesoPorLado)})` : ''}`;
    if ('peso' in a) return `subir a ${formato.peso(a.peso, a.unidadPeso, a.pesoPorLado)}`;
    if (a.tipo === 'tiempo') return `subir a ${formato.valor(a.valor, 'segundos')}`;
    return 'aviso aceptado';
  }
}

function bloqueRecords(datos, texto, enPantalla) {
  const r = datos.records;
  if (!r) return null;
  const cifra = (etiqueta, valor, detalle) =>
    h('li', { class: 'cifra' }, h('span', { class: 'cifra-etiqueta' }, etiqueta), h('strong', { class: 'cifra-valor' }, valor), h('span', { class: 'cifra-detalle' }, detalle));
  return h(
    'ul',
    { class: 'cifras' },
    r.peso ? cifra('Peso máximo', texto(r.peso.valor), formato.fechaCorta(r.peso.fecha)) : null,
    r.e1rm ? cifra('1RM estimado', texto(unDecimal(r.e1rm.valor)), `${formato.numero(r.e1rm.peso)} × ${r.e1rm.reps} · ${formato.fechaCorta(r.e1rm.fecha)}`) : null,
    r.valor ? cifra('Mejor serie', texto(enPantalla(r.valor.valor)), formato.fechaCorta(r.valor.fecha)) : null,
    cifra('Sesiones', String(datos.sesiones), 'con este ejercicio'),
  );
}

function tarjetaSemana(r, titulo) {
  const subio = r.subio.map((s) => {
    if (s.tipo === 'peso') return `${s.ejercicio}: ${formato.numero(s.antes)} → ${formato.numero(s.ahora)} ${s.unidad}${s.pesoPorLado ? ' c/u' : ''}`;
    return `${s.ejercicio}: ${formato.valor(s.antes, s.tipoMedida)} → ${formato.valor(s.ahora, s.tipoMedida)}${reps(s.tipoMedida)}`;
  });
  return h(
    'section',
    { class: 'tarjeta' },
    h('h2', {}, titulo),
    h(
      'ul',
      { class: 'cifras' },
      h('li', { class: 'cifra' }, h('span', { class: 'cifra-etiqueta' }, 'Días de fuerza'), h('strong', { class: 'cifra-valor' }, `${r.dias.hechos} de ${r.dias.plan}`)),
      h('li', { class: 'cifra' }, h('span', { class: 'cifra-etiqueta' }, 'Series'), h('strong', { class: 'cifra-valor' }, `${r.series.hechas} de ${r.series.plan}`)),
      h('li', { class: 'cifra' }, h('span', { class: 'cifra-etiqueta' }, 'Caminatas'), h('strong', { class: 'cifra-valor' }, `${r.caminatas.hechas} de ${r.caminatas.plan}`)),
    ),
    subio.length
      ? [h('p', { class: 'sub' }, 'Subiste:'), h('ul', { class: 'lista-subio' }, subio.map((texto) => h('li', {}, `↑ ${texto}`)))]
      : h('p', { class: 'nota' }, 'Nada subió contra la vez anterior.'),
  );
}

function tarjetaConstancia(c) {
  const { semanas, hechos, posibles } = c.cerradas;
  const resumen = semanas
    ? `En ${semanas === 1 ? 'la semana cerrada' : `las ${semanas} semanas cerradas`}: ${hechos} de ${posibles} días de fuerza (${Math.round((hechos / Math.max(1, posibles)) * 100)} %). La semana en curso no cuenta.`
    : 'Todavía no se cierra ninguna semana del programa.';
  return h(
    'section',
    { class: 'tarjeta' },
    h('h2', {}, 'Constancia'),
    h('p', { class: 'sub' }, resumen),
    h(
      'table',
      { class: 'constancia' },
      h('caption', { class: 'solo-lector' }, 'Días de fuerza por semana, de lunes a viernes'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Semana'), ['L', 'M', 'M', 'J', 'V'].map((l) => h('th', { scope: 'col' }, l)), h('th', { scope: 'col' }, 'Hechos'))),
      h(
        'tbody',
        {},
        c.filas.map((f) =>
          h(
            'tr',
            { class: f.actual ? 'actual' : '' },
            h('th', { scope: 'row' }, formato.fechaCorta(f.lunes)),
            f.dias.map((dia) =>
              h(
                'td',
                {},
                h('span', { class: `celda-dia ${dia.estado}`, 'aria-hidden': 'true' }, ICONO[dia.estado]),
                h('span', { class: 'solo-lector' }, NOMBRE[dia.estado]),
              ),
            ),
            h('td', { class: 'constancia-cuenta' }, `${f.hechos}/${f.cuentan}`),
          ),
        ),
      ),
    ),
    h('p', { class: 'leyenda' }, LEYENDA.map(([estado, texto]) => `${ICONO[estado]} ${texto}`).join(' · ')),
  );
}

/** Tanda 3: ejercicios con 3 semanas o más sin subir. La app avisa; tú decides. */
function tarjetaEstancados(estancados) {
  if (!estancados.length) return null;
  return h(
    'section',
    { class: 'tarjeta tarjeta-pregunta' },
    h('div', { class: 'etiqueta aviso' }, 'Sin subir en 3 semanas o más'),
    h(
      'ul',
      { class: 'lista-subio' },
      estancados.map((e) => h('li', {}, `${e.nombre}: ${e.semanas} semanas (desde el ${formato.fechaCorta(e.desde)})`)),
    ),
    h('p', { class: 'nota' }, 'Opciones: bajar el peso una semana y volver a subir, o cambiar el ejercicio. «Sin subir» es sin récord de peso ni de 1RM estimado (o de tu mejor serie, sin peso) y sin aceptar un aviso.'),
  );
}

function tarjetaGrupos(grupos) {
  const conSeries = grupos.filter((g) => g.actual || g.anterior);
  const sinSeries = grupos.length - conSeries.length;
  return h(
    'section',
    { class: 'tarjeta' },
    h('h2', {}, 'Series por grupo'),
    h('p', { class: 'nota' }, 'Series hechas de las planeadas, con los grupos de tu hoja.'),
    conSeries.length
      ? h(
          'table',
          { class: 'conteos' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Grupo'), h('th', { scope: 'col' }, 'Esta semana'), h('th', { scope: 'col' }, 'Anterior'))),
          h(
            'tbody',
            {},
            conSeries.map((g) => h('tr', {}, h('th', { scope: 'row' }, g.grupo), h('td', {}, `${g.actual} de ${g.plan}`), h('td', {}, `${g.anterior} de ${g.plan}`))),
          ),
        )
      : h('p', {}, 'Ninguna serie en estas dos semanas.'),
    sinSeries && conSeries.length ? h('p', { class: 'nota' }, `${sinSeries} ${sinSeries === 1 ? 'grupo' : 'grupos'} sin series en ninguna de las dos semanas.`) : null,
  );
}
