// Pantalla: gráfica de líneas en SVG, hecha a mano (tanda 2, guía dataviz).
// - Un solo eje Y: nunca dos escalas en la misma gráfica.
// - Líneas de 2 px; puntos de 8 px con un anillo del color de la tarjeta;
//   rejilla tenue; leyenda si hay dos series (o marcas de aviso).
// - El último valor de cada línea va escrito al final de la línea.
// - Tocar o arrastrar sobre la gráfica (o las flechas del teclado) pone una
//   línea vertical en la fecha más cercana y una etiqueta con sus valores.
// - Debajo, «Ver en tabla» trae los mismos datos: nada depende de tocar.
// Colores: --serie-1 y --serie-2, validados contra el fondo de la tarjeta.
// Se dibuja a la medida real del contenedor (y otra vez si cambia de ancho).

import { marcasRedondas } from '../logica/escala.js';
import { fechaCorta, fechaLarga, numero } from '../logica/formato.js';
import { deTexto, diasEntre } from '../logica/semana.js';
import { h, pintar } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const ALTO = 200;
const MARGEN = { arriba: 14, abajo: 38, izquierda: 42, derecha: 52 };
const MAX_PUNTOS_VISIBLES = 30; // con más, solo se marca el último
const SEPARACION_ETIQUETAS = 14;

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function s(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElementNS(SVG, etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor !== null && valor !== undefined) elemento.setAttribute(nombre, String(valor));
  }
  elemento.append(...hijos);
  return elemento;
}

/**
 * @param {object} p
 * @param {string} p.titulo  qué se grafica (para lectores de pantalla y la tabla)
 * @param {string[]} p.fechas  'AAAA-MM-DD', de la más vieja a la más nueva
 * @param {Array<{nombre:string, valores:Array<number|null>}>} p.series  una o dos, de la más importante a la menos
 * @param {(v:number) => string} p.formato  el valor completo, con unidad (etiqueta y tabla)
 * @param {Array<{indice:number, texto:string}>} [p.marcas]  eventos de una fecha (avisos aceptados)
 * @param {string} [p.nombreMarca]
 * @returns {{elemento:HTMLElement, destruir:() => void}}
 */
export function crearGrafica({ titulo, fechas, series, formato, marcas = [], nombreMarca = 'Aviso aceptado' }) {
  const marcaEn = new Map(marcas.map((m) => [m.indice, m.texto]));
  const variosAnios = fechas.length > 0 && fechas[0].slice(0, 4) !== fechas.at(-1).slice(0, 4);
  const conAnio = (f) => (variosAnios ? `${fechaCorta(f)} ${f.slice(0, 4)}` : fechaCorta(f));

  const tip = h('div', { class: 'grafica-tip', hidden: true });
  const vivo = h('div', { class: 'solo-lector', 'aria-live': 'polite' });
  const lienzo = h('div', { class: 'grafica-lienzo' }, tip);
  let svg = null;
  let cruz = null;
  let resaltes = [];
  let xs = [];
  let y = () => 0;
  let ancho = 0;
  let actual = null;

  function dibujar() {
    const x0 = MARGEN.izquierda;
    const x1 = ancho - MARGEN.derecha;
    const y0 = MARGEN.arriba;
    const y1 = ALTO - MARGEN.abajo;
    const todos = series.flatMap((serie) => serie.valores).filter(esNumero);
    const escala = marcasRedondas(Math.min(...todos), Math.max(...todos), 4);
    y = (v) => y1 - ((v - escala.desde) / (escala.hasta - escala.desde)) * (y1 - y0);
    const dias = fechas.map((f) => diasEntre(deTexto(fechas[0]), deTexto(f)));
    const total = dias.at(-1);
    xs = dias.map((d) => (total > 0 ? x0 + (d / total) * (x1 - x0) : (x0 + x1) / 2));

    const nuevo = s('svg', {
      class: 'grafica-svg',
      width: ancho,
      height: ALTO,
      viewBox: `0 0 ${ancho} ${ALTO}`,
      role: 'img',
      tabindex: 0,
      'aria-label': `${titulo}. Toca la gráfica para ver cada fecha; la tabla de abajo tiene los mismos datos.`,
    });

    // Rejilla y eje Y (números redondos).
    for (const v of escala.marcas) {
      nuevo.append(
        s('line', { class: 'grafica-rejilla', x1: x0, x2: x1, y1: y(v), y2: y(v) }),
        s('text', { class: 'grafica-eje', x: x0 - 8, y: y(v) + 4, 'text-anchor': 'end' }, numero(v)),
      );
    }

    // Fechas: la primera, la última y, si cabe, la más cercana al centro.
    const indices = fechas.length === 1 ? [0] : [0, fechas.length - 1];
    if (fechas.length >= 3 && x1 - x0 >= 220) {
      const centro = (x0 + x1) / 2;
      const medio = xs.reduce((mejor, x, i) => (Math.abs(x - centro) < Math.abs(xs[mejor] - centro) ? i : mejor), 1);
      if (medio > 0 && medio < fechas.length - 1) indices.push(medio);
    }
    for (const i of indices) {
      const ancla = fechas.length === 1 ? 'middle' : i === 0 ? 'start' : i === fechas.length - 1 ? 'end' : 'middle';
      nuevo.append(s('text', { class: 'grafica-eje', x: xs[i], y: ALTO - 6, 'text-anchor': ancla }, conAnio(fechas[i])));
    }

    // Avisos aceptados: un triángulo bajo la fecha (la leyenda lo explica).
    for (const i of marcaEn.keys()) {
      const x = xs[i];
      nuevo.append(s('path', { class: 'grafica-marca', d: `M${x - 5} ${y1 + 17} L${x + 5} ${y1 + 17} L${x} ${y1 + 8} Z` }));
    }

    // Líneas (se cortan donde no hay valor) y puntos.
    series.forEach((serie, k) => {
      const clase = `serie-${k + 1}`;
      let trazo = '';
      let pluma = 'M';
      serie.valores.forEach((v, i) => {
        if (!esNumero(v)) {
          pluma = 'M';
          return;
        }
        trazo += `${pluma}${xs[i]} ${y(v)} `;
        pluma = 'L';
      });
      if (trazo) nuevo.append(s('path', { class: `grafica-linea ${clase}`, d: trazo.trim() }));
      const conValor = serie.valores.flatMap((v, i) => (esNumero(v) ? [i] : []));
      const visibles = conValor.length <= MAX_PUNTOS_VISIBLES ? conValor : conValor.slice(-1);
      for (const i of visibles) nuevo.append(s('circle', { class: `grafica-punto ${clase}`, cx: xs[i], cy: y(serie.valores[i]), r: 4 }));
    });

    // El último valor de cada línea al final; si dos quedarían encimados, solo el de la primera serie.
    const ocupadas = [];
    for (const serie of series) {
      const i = serie.valores.findLastIndex(esNumero);
      if (i < 0) continue;
      const altura = y(serie.valores[i]);
      if (ocupadas.some((o) => Math.abs(o - altura) < SEPARACION_ETIQUETAS)) continue;
      ocupadas.push(altura);
      nuevo.append(s('text', { class: 'grafica-final', x: xs[i] + 9, y: altura + 4 }, numero(serie.valores[i])));
    }

    // Lo que aparece al tocar: línea vertical y los puntos de esa fecha, resaltados.
    cruz = s('line', { class: 'grafica-cruz', x1: 0, x2: 0, y1: y0, y2: y1, visibility: 'hidden' });
    resaltes = series.map((_, k) => s('circle', { class: `grafica-punto serie-${k + 1}`, r: 5, visibility: 'hidden' }));
    nuevo.append(cruz, ...resaltes);

    nuevo.addEventListener('pointerdown', apuntar);
    nuevo.addEventListener('pointermove', apuntar);
    nuevo.addEventListener('pointerleave', (evento) => {
      if (evento.pointerType === 'mouse') ocultar();
    });
    nuevo.addEventListener('focus', () => mostrar(actual ?? fechas.length - 1));
    nuevo.addEventListener('blur', ocultar);
    nuevo.addEventListener('keydown', teclado);

    if (svg) svg.replaceWith(nuevo);
    else lienzo.prepend(nuevo);
    svg = nuevo;
    if (actual !== null) mostrar(actual);
  }

  function apuntar(evento) {
    const x = evento.clientX - svg.getBoundingClientRect().left;
    let cercano = 0;
    xs.forEach((xi, i) => {
      if (Math.abs(xi - x) < Math.abs(xs[cercano] - x)) cercano = i;
    });
    mostrar(cercano);
  }

  function teclado(evento) {
    const ultimo = fechas.length - 1;
    const desde = actual ?? ultimo;
    const destino = { ArrowLeft: desde - 1, ArrowRight: desde + 1, Home: 0, End: ultimo }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    mostrar(Math.min(ultimo, Math.max(0, destino)));
  }

  function mostrar(i) {
    actual = i;
    const x = xs[i];
    cruz.setAttribute('x1', x);
    cruz.setAttribute('x2', x);
    cruz.setAttribute('visibility', 'visible');
    series.forEach((serie, k) => {
      const v = serie.valores[i];
      if (esNumero(v)) {
        resaltes[k].setAttribute('cx', x);
        resaltes[k].setAttribute('cy', y(v));
      }
      resaltes[k].setAttribute('visibility', esNumero(v) ? 'visible' : 'hidden');
    });
    const filas = series.flatMap((serie, k) =>
      esNumero(serie.valores[i])
        ? [h('div', { class: 'grafica-tip-fila' }, h('span', { class: `clave-linea serie-${k + 1}`, 'aria-hidden': 'true' }), h('strong', {}, formato(serie.valores[i])), h('span', {}, serie.nombre))]
        : [],
    );
    pintar(
      tip,
      h('div', { class: 'grafica-tip-fecha' }, fechaLarga(fechas[i])),
      filas,
      marcaEn.has(i) ? h('div', { class: 'grafica-tip-marca' }, `▲ ${marcaEn.get(i)}`) : null,
    );
    tip.hidden = false;
    const anchoTip = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(x - anchoTip / 2, ancho - anchoTip))}px`;
    vivo.textContent = [
      fechaLarga(fechas[i]),
      ...series.map((serie) => (esNumero(serie.valores[i]) ? `${serie.nombre}: ${formato(serie.valores[i])}` : null)),
      marcaEn.get(i) ?? null,
    ].filter(Boolean).join('. ');
  }

  function ocultar() {
    actual = null;
    tip.hidden = true;
    cruz?.setAttribute('visibility', 'hidden');
    for (const punto of resaltes) punto.setAttribute('visibility', 'hidden');
  }

  function leyenda() {
    if (series.length < 2 && !marcas.length) return null; // una sola serie: el título ya dice qué es
    return h(
      'div',
      { class: 'grafica-leyenda' },
      series.length >= 2
        ? series.map((serie, k) =>
            h('span', { class: 'grafica-leyenda-item' }, h('span', { class: `clave-linea serie-${k + 1}`, 'aria-hidden': 'true' }), serie.nombre),
          )
        : null,
      marcas.length ? h('span', { class: 'grafica-leyenda-item' }, h('span', { class: 'clave-marca', 'aria-hidden': 'true' }, '▲'), nombreMarca) : null,
    );
  }

  function tabla() {
    const orden = fechas.map((_, i) => i).reverse(); // la más reciente arriba
    return h(
      'details',
      { class: 'grafica-tabla' },
      h('summary', {}, 'Ver en tabla'),
      h(
        'table',
        { class: 'conteos' },
        h('caption', { class: 'solo-lector' }, titulo),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, 'Fecha'),
            series.map((serie) => h('th', { scope: 'col' }, serie.nombre)),
            marcas.length ? h('th', { scope: 'col' }, nombreMarca) : null,
          ),
        ),
        h(
          'tbody',
          {},
          orden.map((i) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, conAnio(fechas[i])),
              series.map((serie) => h('td', {}, esNumero(serie.valores[i]) ? formato(serie.valores[i]) : '—')),
              marcas.length ? h('td', {}, marcaEn.get(i) ?? '') : null,
            ),
          ),
        ),
      ),
    );
  }

  const elemento = h('figure', { class: 'grafica' }, leyenda(), lienzo, vivo, tabla());
  // El lienzo tiene alto fijo (CSS) y se dibuja fuera del aviso de cambio de
  // tamaño: si se dibujara dentro, el navegador reporta «ResizeObserver loop…»
  // como error (y terminaría en el registro de errores). setTimeout y no
  // requestAnimationFrame: este último no corre con la página oculta.
  let pendiente = 0;
  const observador = new ResizeObserver((entradas) => {
    const medida = Math.round(entradas[0].contentRect.width);
    if (medida <= 0 || medida === ancho || !fechas.length) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(() => {
      ancho = medida;
      dibujar();
    }, 0);
  });
  observador.observe(lienzo);
  return {
    elemento,
    destruir: () => {
      clearTimeout(pendiente);
      observador.disconnect();
    },
  };
}
