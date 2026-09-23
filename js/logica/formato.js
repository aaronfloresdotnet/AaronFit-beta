// Lógica pura: cómo se escriben números, pesos, tiempos y fechas en pantalla.

import { deTexto, diaSemana } from './semana.js';

export const NOMBRES_DIA = Object.freeze(['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
export const INICIALES_DIA = Object.freeze(['', 'L', 'M', 'M', 'J', 'V', 'S', 'D']);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 50 → '50'; 2.5 → '2.5'; 80.50 → '80.5'. */
export function numero(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n * 100) / 100);
}

/** Cifras fijas, para estimaciones: 18.37 → '18.4'; decimal(0.5, 2) → '0.50'. */
export function decimal(n, cifras = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(cifras);
}

/** Un cambio con su signo: 1.5 → '+1.5'; −0.7 → '−0.7'; 0 → '0'. */
export function cambio(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${numero(Math.abs(n))}`;
}

/** '50 kg', '35 lb c/u', '' si es peso corporal. */
export function peso(valor, unidad, porLado = false) {
  if (unidad === 'corporal' || valor === null || valor === undefined) return '';
  return `${numero(valor)} ${unidad}${porLado ? ' c/u' : ''}`;
}

/** El valor guardado en la unidad del ejercicio: '10', '40 s', '40 m', '2 min'. */
export function valor(v, tipoMedida) {
  if (v === null || v === undefined) return '—';
  if (tipoMedida === 'segundos') return `${numero(v)} s`;
  if (tipoMedida === 'metros') return `${numero(v)} m`;
  if (tipoMedida === 'minutos') return `${numero(v / 60)} min`;
  return numero(v);
}

/** Una serie en corto: '50 kg × 10', '40 s', '40 lb c/u · 40 m'. */
export function serie({ peso: p, unidadPeso, pesoPorLado, valor: v }, tipoMedida) {
  const textoPeso = peso(p, unidadPeso, pesoPorLado);
  const textoValor = valor(v, tipoMedida);
  if (!textoPeso) return textoValor;
  return tipoMedida === 'reps' ? `${textoPeso} × ${textoValor}` : `${textoPeso} · ${textoValor}`;
}

/** 150 → '2:30'. */
export function reloj(segundos) {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 900 → '15 min'; 3720 → '1 h 02 min'. */
export function duracion(segundos) {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/** '2026-09-22' → '22 sep'. */
export function fechaCorta(texto) {
  const { mes, dia } = deTexto(texto);
  return `${dia} ${MESES[mes - 1]}`;
}

/** '2026-09-22' → 'martes 22 sep'. */
export function fechaLarga(texto) {
  const fecha = deTexto(texto);
  return `${NOMBRES_DIA[diaSemana(fecha)].toLowerCase()} ${fecha.dia} ${MESES[fecha.mes - 1]}`;
}

/** 'LUNES - Empuje A' → { dia: 'Lunes', nombre: 'Empuje A' }. */
export function partesDia(dia) {
  const [nombreDia, nombre = ''] = dia.split(' - ');
  const minusculas = nombreDia.toLowerCase();
  return { dia: minusculas.charAt(0).toUpperCase() + minusculas.slice(1), nombre };
}
