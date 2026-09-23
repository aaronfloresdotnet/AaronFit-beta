// Pantalla: cronómetro de descanso (encargo 6.5). Anillo que se vacía con la
// cuenta regresiva grande, la siguiente serie, y frases que pasan despacio.
// Tres pitidos en los últimos 3 s; vibración corta a los 10 s (esa depende de
// que la página esté activa). Al llegar a cero suena y vibra; un toque lo calla.
// Cuenta contra una hora de fin: si el teléfono frena la página, al volver
// muestra el tiempo correcto.
// Guía de respiración (Aarón, 2026-09-23): «Inhala… / Exhala…» dentro del
// anillo, al ritmo con el que ya «respira» (4 s crece, 6 s baja). Es solo CSS:
// empieza al mismo tiempo que el anillo, así que no se desfasa.

import { reloj } from '../logica/formato.js';
import { h } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const RADIO = 45;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const CADA_FRASE_MS = 12_000;

function crearAnillo() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'anillo-svg');
  svg.setAttribute('aria-hidden', 'true');
  const fondo = document.createElementNS(SVG, 'circle');
  const progreso = document.createElementNS(SVG, 'circle');
  for (const [c, clase] of [[fondo, 'anillo-fondo'], [progreso, 'anillo-progreso']]) {
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', String(RADIO));
    c.setAttribute('class', clase);
    svg.append(c);
  }
  progreso.style.strokeDasharray = String(CIRCUNFERENCIA);
  return { svg, fijar: (fraccion) => (progreso.style.strokeDashoffset = String(CIRCUNFERENCIA * (1 - Math.max(0, Math.min(1, fraccion))))) };
}

export function crearCronometro({ alarma }) {
  let finEn = 0;
  let total = 0;
  let intervalo = null;
  let rotacion = null;
  let vibroA10 = false;
  let estado = 'inactivo'; // inactivo | contando | sonando
  let alDeshacer = null;

  const titulo = h('div', { class: 'crono-titulo' });
  const cifra = h('div', { class: 'crono-cifra' });
  const anillo = crearAnillo();
  const respira = h(
    'div',
    { class: 'crono-respira', 'aria-hidden': 'true' },
    h('span', { class: 'inhala' }, 'Inhala…'),
    h('span', { class: 'exhala' }, 'Exhala…'),
    h('span', { class: 'quieto' }, 'Respira despacio'), // sin animaciones (prefers-reduced-motion)
  );
  const circulo = h('div', { class: 'anillo' }, anillo.svg, cifra, respira);
  const siguiente = h('div', { class: 'crono-siguiente' });
  const frase = h('div', { class: 'crono-frase', 'aria-live': 'off' });
  const pista = h('div', { class: 'crono-pista' }, 'Toca en cualquier parte para seguir');
  const saltar = h('button', { type: 'button', class: 'boton secundario crono-boton' }, 'Saltar descanso');
  const deshacer = h('button', { type: 'button', class: 'enlace crono-deshacer' }, 'Deshacer la serie');
  const capa = h('div', { class: 'crono', role: 'timer', hidden: true }, titulo, circulo, siguiente, frase, pista, saltar, deshacer);
  document.body.append(capa);

  function tic() {
    if (estado !== 'contando') return;
    const restante = (finEn - Date.now()) / 1000;
    cifra.textContent = reloj(restante);
    anillo.fijar(restante / total);
    if (!vibroA10 && total > 15 && restante <= 10 && restante > 0) {
      vibroA10 = true;
      alarma.avisoCorto();
    }
    if (restante <= 0) sonar();
  }

  function sonar() {
    estado = 'sonando';
    clearInterval(intervalo);
    intervalo = null;
    titulo.textContent = '¡A darle!';
    cifra.textContent = '0:00';
    anillo.fijar(0);
    capa.classList.add('sonando');
    pista.hidden = false;
    saltar.hidden = true;
    alarma.vibrar();
  }

  function mostrarFrases(frases) {
    clearInterval(rotacion);
    rotacion = null;
    if (!frases.length) {
      frase.textContent = '';
      return;
    }
    let i = 0;
    const siguienteFrase = () => {
      frase.classList.remove('entra');
      void frase.offsetWidth; // reinicia la animación
      frase.textContent = frases[i % frases.length];
      frase.classList.add('entra');
      i++;
    };
    siguienteFrase();
    rotacion = setInterval(siguienteFrase, CADA_FRASE_MS);
  }

  function cerrar() {
    clearInterval(intervalo);
    clearInterval(rotacion);
    intervalo = null;
    rotacion = null;
    estado = 'inactivo';
    alDeshacer = null;
    alarma.detener();
    capa.hidden = true;
    capa.classList.remove('sonando');
  }

  /**
   * Arranca el descanso. Con 0 segundos no aparece (ejercicios sin descanso).
   * @param {number} segundos
   * @param {{texto?:string, frases?:string[], deshacer?:() => void, respiracion?:boolean}} [opciones]
   */
  function iniciar(segundos, { texto = '', frases = [], deshacer: accionDeshacer = null, respiracion = false } = {}) {
    cerrar();
    if (!segundos) return;
    total = segundos;
    finEn = Date.now() + segundos * 1000;
    vibroA10 = false;
    estado = 'contando';
    alDeshacer = accionDeshacer;
    titulo.textContent = 'Descanso';
    siguiente.textContent = texto;
    pista.hidden = true;
    saltar.hidden = false;
    deshacer.hidden = !accionDeshacer;
    capa.classList.toggle('con-respiracion', respiracion); // antes de mostrarla: así empieza junto con el anillo
    capa.hidden = false;
    alarma.programar(segundos);
    mostrarFrases(frases);
    tic();
    intervalo = setInterval(tic, 250);
  }

  saltar.addEventListener('click', (evento) => {
    evento.stopPropagation();
    cerrar();
  });
  deshacer.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const accion = alDeshacer;
    cerrar();
    accion?.();
  });
  capa.addEventListener('click', () => {
    if (estado === 'sonando') cerrar();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tic();
  });

  return {
    iniciar,
    detener: cerrar,
    get activo() {
      return estado !== 'inactivo';
    },
  };
}
