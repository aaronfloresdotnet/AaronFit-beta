// Lógica pura: los nombres de tus ejercicios entre rutinas. El historial se
// junta por nombre (sin mayúsculas, acentos ni signos), así que si la IA
// escribe «Press bank» en lugar de «Press de banca», ese ejercicio empezaría de
// cero. Aquí: la lista de nombres que ya tienes y cuáles se parecen a uno que
// no tienes. La app nunca los une sola: pregunta (Aarón, 2026-09-23).

import { numeroDePlan } from './plan.js';
import { slug } from './parseo.js';

// Palabras que no distinguen un ejercicio de otro.
const PALABRAS_VACIAS = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'sobre', 'un', 'una', 'y']);

/**
 * Los nombres que ya tienes: uno por nombre (sin mayúsculas ni acentos), escrito
 * como en la rutina más reciente que lo trae.
 * @param {object[]} renglones  de tus rutinas
 * @returns {Map<string, string>} slug → nombre
 */
export function nombresConocidos(renglones) {
  const nombres = new Map();
  const planDe = new Map();
  for (const r of renglones) {
    const s = slug(r.ejercicio);
    if (!planDe.has(s) || numeroDePlan(r) > planDe.get(s)) {
      nombres.set(s, r.ejercicio);
      planDe.set(s, numeroDePlan(r));
    }
  }
  return nombres;
}

/** Cuántas letras hay que cambiar, poner o quitar para pasar de `a` a `b` (Levenshtein). */
function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      siguiente[j] = Math.min(fila[j] + 1, siguiente[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    fila = siguiente;
  }
  return fila[b.length];
}

const palabras = (nombre) => slug(nombre).split('-').filter((p) => p && !PALABRAS_VACIAS.has(p));

/** La misma palabra con una letra de diferencia (dos, si es larga): «pres»/«press», «mancuerna»/«mancuernas». */
function mismaPalabra(a, b) {
  if (a === b) return true;
  const corta = Math.min(a.length, b.length);
  return corta >= 4 && distancia(a, b) <= (corta >= 7 ? 2 : 1);
}

/** Qué tanto se parecen dos nombres escritos de corrido, sin palabras vacías: de 0 a 1. */
function parecido(a, b) {
  const x = palabras(a).join('');
  const y = palabras(b).join('');
  return x && y ? 1 - distancia(x, y) / Math.max(x.length, y.length) : 0;
}

/**
 * ¿Se parecen lo suficiente para preguntar si son el mismo ejercicio?
 * - escritos de corrido difieren poco (un error de dedo): «Press bank» y «Press de banca»;
 * - o las palabras de uno están en el otro, con hasta 2 de más: «Face pull» y
 *   «Face pull con cuerda»; «Elevaciones laterales» y «Elevación lateral».
 */
export function seParecen(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.length || !pb.length) return false;
  if (parecido(a, b) >= 0.75) return true;
  const [menor, mayor] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (mayor.length - menor.length > 2) return false;
  const libres = [...mayor];
  return menor.every((p) => {
    const i = libres.findIndex((q) => mismaPalabra(p, q));
    if (i < 0) return false;
    libres.splice(i, 1);
    return true;
  });
}

/** Tus nombres que se parecen a `nombre`, del más parecido al menos. */
export function parecidos(nombre, conocidos) {
  return [...conocidos.values()]
    .filter((conocido) => slug(conocido) !== slug(nombre) && seParecen(nombre, conocido))
    .sort((a, b) => parecido(nombre, b) - parecido(nombre, a) || a.localeCompare(b, 'es'));
}

/**
 * Los nombres de una rutina nueva que no tienes, cada uno con los tuyos que se
 * le parecen y lo que decidiste en `equivalencias` (por nombre, como lo escribió
 * la IA): null = es nuevo; 'Nombre tuyo' = es ese; sin respuesta = undefined.
 * @param {string[]} nombres  los de la rutina nueva, en orden
 * @param {Map<string, string>} conocidos  de nombresConocidos
 * @param {Record<string, string|null>} [equivalencias]
 * @returns {Array<{nombre:string, parecidos:string[], decision:(string|null|undefined)}>}
 */
export function nombresNuevos(nombres, conocidos, equivalencias = {}) {
  const nuevos = new Map();
  for (const nombre of nombres) {
    const s = slug(nombre);
    if (!s || conocidos.has(s) || nuevos.has(s)) continue;
    const elegido = equivalencias[nombre];
    const decision = elegido === null ? null : typeof elegido === 'string' ? conocidos.get(slug(elegido)) : undefined;
    nuevos.set(s, { nombre, parecidos: parecidos(nombre, conocidos), decision });
  }
  return [...nuevos.values()];
}
