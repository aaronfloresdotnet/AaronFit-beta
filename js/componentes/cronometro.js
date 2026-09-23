// Pantalla: cronómetro de descanso (encargo 6.5). Cuenta regresiva grande,
// visible desde lejos. Al llegar a cero suena y vibra; un toque en cualquier
// parte lo calla. Se puede saltar con un botón secundario.
// Cuenta contra una hora de fin (no contando tics): si el teléfono frena la
// página, al volver muestra el tiempo correcto.

import { reloj } from '../logica/formato.js';
import { h } from './dom.js';

export function crearCronometro({ alarma }) {
  let finEn = 0;
  let intervalo = null;
  let estado = 'inactivo'; // inactivo | contando | sonando

  const titulo = h('div', { class: 'crono-titulo' });
  const cifra = h('div', { class: 'crono-cifra' });
  const siguiente = h('div', { class: 'crono-siguiente' });
  const pista = h('div', { class: 'crono-pista' }, 'Toca en cualquier parte para seguir');
  const saltar = h('button', { type: 'button', class: 'boton secundario crono-saltar' }, 'Saltar descanso');
  const capa = h('div', { class: 'crono', role: 'timer', 'aria-live': 'off', hidden: true }, titulo, cifra, siguiente, pista, saltar);
  document.body.append(capa);

  function tic() {
    if (estado !== 'contando') return;
    const restante = (finEn - Date.now()) / 1000;
    cifra.textContent = reloj(restante);
    if (restante <= 0) sonar();
  }

  function sonar() {
    estado = 'sonando';
    clearInterval(intervalo);
    intervalo = null;
    titulo.textContent = '¡A darle!';
    cifra.textContent = '0:00';
    capa.classList.add('sonando');
    pista.hidden = false;
    saltar.hidden = true;
    alarma.vibrar();
  }

  function cerrar() {
    clearInterval(intervalo);
    intervalo = null;
    estado = 'inactivo';
    alarma.detener();
    capa.hidden = true;
    capa.classList.remove('sonando');
  }

  /** Arranca el descanso. Con 0 segundos no aparece (ejercicios sin descanso). */
  function iniciar(segundos, { texto = '' } = {}) {
    cerrar();
    if (!segundos) return;
    finEn = Date.now() + segundos * 1000;
    estado = 'contando';
    titulo.textContent = 'Descanso';
    siguiente.textContent = texto;
    pista.hidden = true;
    saltar.hidden = false;
    capa.hidden = false;
    alarma.programar(segundos);
    tic();
    intervalo = setInterval(tic, 250);
  }

  saltar.addEventListener('click', (evento) => {
    evento.stopPropagation();
    cerrar();
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
