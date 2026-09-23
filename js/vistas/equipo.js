// Pantalla: tu equipo y la voz del descanso (tanda 3). Se llega desde Respaldo
// y desde la calculadora de discos del ejercicio.
// Dos inventarios que no se mezclan: discos de kg (2 pulgadas: barra y polea)
// y discos de lb (1 pulgada: solo mancuernas).

import { h, pintar } from '../componentes/dom.js';
import { crearSpinner } from '../componentes/spinner.js';
import { numero } from '../logica/formato.js';

const TAMANOS_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const TAMANOS_LB = [45, 35, 25, 15, 10, 5, 2.5];

export async function montar(raiz, _parametros, app) {
  const equipo = await app.servicios.ajustes.equipo();
  const cuantosDe = (discos, peso) => discos.find((d) => d.peso === peso)?.cuantos ?? 0;

  // Un control por tamaño de disco; los que no tienes quedan plegados en «Otros tamaños».
  function discos(tamanos, actuales, unidad) {
    const controles = new Map();
    const control = (peso) => {
      const spinner = crearSpinner({ etiqueta: `Discos de ${numero(peso)} ${unidad}`, valor: cuantosDe(actuales, peso), paso: 1, min: 0, max: 20, compacto: true });
      controles.set(peso, spinner);
      return spinner.elemento;
    };
    const tengo = tamanos.filter((p) => cuantosDe(actuales, p) > 0);
    const otros = tamanos.filter((p) => cuantosDe(actuales, p) === 0);
    const elemento = h(
      'div',
      { class: 'grupo-controles' },
      tengo.map(control),
      otros.length ? h('details', { class: 'mas-medidas' }, h('summary', {}, 'Otros tamaños'), h('div', { class: 'grupo-controles' }, otros.map(control))) : null,
    );
    const leer = () => [...controles].map(([peso, s]) => ({ peso, cuantos: s.valor ?? 0 })).filter((d) => d.cuantos > 0);
    return { elemento, leer };
  }

  const barra = crearSpinner({ etiqueta: 'Barra olímpica', valor: equipo.barra, paso: 0.5, min: 0, max: 50, sufijo: 'kg' });
  const kg = discos(TAMANOS_KG, equipo.discosKg, 'kg');
  const polea = crearSpinner({ etiqueta: 'Carro de la polea (si no cuenta, 0)', valor: equipo.polea, paso: 0.5, min: 0, max: 50, sufijo: 'kg' });
  const mango = crearSpinner({ etiqueta: 'Mango de cada mancuerna (si no cuenta, 0)', valor: equipo.maneral, paso: 0.5, min: 0, max: 30, sufijo: 'lb' });
  const tope = crearSpinner({ etiqueta: 'Tope por mancuerna', valor: equipo.topeMancuerna, paso: 5, min: 5, max: 200, sufijo: 'lb' });
  const lb = discos(TAMANOS_LB, equipo.discosLb, 'lb');
  const texto = h('textarea', { class: 'entrada-nota', rows: '8' }, equipo.texto);
  // Un interruptor del descanso: guarda la preferencia en cuanto lo cambias.
  const interruptor = (llave, encendida, apagada) => {
    const caja = h('input', { type: 'checkbox', checked: Boolean(app.preferencias[llave]) });
    caja.addEventListener('change', async () => {
      try {
        app.preferencias = await app.servicios.ajustes.guardarPreferencias({ [llave]: caja.checked });
        app.aviso(caja.checked ? encendida : apagada);
      } catch (error) {
        app.error(error);
      }
    });
    return caja;
  };
  const voz = interruptor('voz', 'Voz encendida', 'Voz apagada');
  const respiracion = interruptor('respiracion', 'Guía de respiración encendida', 'Guía de respiración apagada');

  pintar(
    raiz,
    h('nav', { class: 'barra-superior' }, h('a', { class: 'boton-icono', href: '#/respaldo', 'aria-label': 'Volver' }, '‹'), h('div', { class: 'barra-titulo' }, h('strong', {}, 'Tu equipo')), h('span', { class: 'boton-icono vacio' })),
    h('p', { class: 'nota' }, 'Con esto la app te dice qué discos poner. Los de kg (2 pulgadas) van en la barra y la polea; los de lb (1 pulgada), solo en las mancuernas.'),
    h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'Barra y polea (kg)'),
      barra.elemento,
      polea.elemento,
      h('p', { class: 'nota' }, 'La barra y la polea se cargan igual de cada lado. Discos por pieza: un par son 2.'),
      kg.elemento,
    ),
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Mancuernas (lb)'), mango.elemento, tope.elemento, lb.elemento),
    h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'Tu equipo en palabras'),
      h('p', { class: 'nota' }, 'Va en el prompt para cambiar de rutina: lo que tienes, cómo se ajusta y lo que no.'),
      texto,
    ),
    h('button', { type: 'button', class: 'boton primario enorme', onclick: guardar }, 'Guardar equipo'),
    h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'En el descanso'),
      h('label', { class: 'interruptor' }, respiracion, h('span', {}, h('strong', {}, 'Guía de respiración'), h('small', {}, '«Inhala… / Exhala…» dentro del anillo, a su ritmo: 4 s y 6 s.'))),
      h('label', { class: 'interruptor' }, voz, h('span', {}, h('strong', {}, 'Decir la siguiente serie'), h('small', {}, 'Al empezar el descanso, p. ej. «Sigue: serie 2, 55 kilos por 8».'))),
      h('p', { class: app.voz.disponible ? 'nota' : 'nota aviso' }, app.voz.disponible ? `Voz: ${app.voz.nombre}.` : 'Este teléfono no tiene (o todavía no carga) una voz en español.'),
      h('button', { type: 'button', class: 'boton ancho', onclick: probar }, 'Probar la voz'),
    ),
  );

  function probar() {
    if (!app.voz.hablar('Sigue: serie 2, 55 kilos por 8.')) app.aviso('No hay voz en español en este teléfono', 4000);
  }

  async function guardar() {
    try {
      await app.servicios.ajustes.guardarEquipo({
        barra: barra.valor ?? 0,
        polea: polea.valor ?? 0,
        discosKg: kg.leer(),
        maneral: mango.valor,
        topeMancuerna: tope.valor,
        discosLb: lb.leer(),
        texto: texto.value,
      });
      app.aviso('Equipo guardado');
      app.refrescar();
    } catch (error) {
      app.error(error);
    }
  }
}
