// Lógica pura: lo que se calcula de las medidas corporales (tanda 2).
//
// % de grasa: método de circunferencias de la Marina de EE. UU. (Hodgdon y
// Beckett, 1984), versión en centímetros. Es una ESTIMACIÓN: una báscula de
// bioimpedancia o un DEXA dan otros números. La fórmula (hombre o mujer) la
// elige el usuario en su perfil; aquí nunca se supone.

import { CAMPOS_MEDIDA } from './medidas.js';
import { deTexto, diasEntre } from './semana.js';

export const FORMULAS = Object.freeze(['hombre', 'mujer']);

/** NICE (Reino Unido, 2022): mantener la cintura en menos de la mitad de la estatura. */
export const LIMITE_CINTURA_ESTATURA = 0.5;

/** Cada cuánto conviene tomarse fotos. */
export const DIAS_ENTRE_FOTOS = 28;

// Comparación "contra hace ~4 semanas": la medición más cercana a 28 días
// antes de la última, siempre que tenga al menos 21 días de diferencia.
const DIAS_OBJETIVO = 28;
const DIAS_MINIMOS = 21;

const positivo = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * % de grasa estimado, o null si falta un dato o las medidas no dan un
 * resultado posible (p. ej. un cuello igual o mayor que la cintura).
 * @param {{formula:string, estatura:number, cintura:number|null, cuello:number|null, cadera?:number|null}} p  en cm
 */
export function grasaMarina({ formula, estatura, cintura, cuello, cadera = null }) {
  if (!positivo(estatura) || !positivo(cintura) || !positivo(cuello)) return null;
  let denominador;
  if (formula === 'hombre') {
    if (cintura - cuello <= 0) return null;
    denominador = 1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(estatura);
  } else if (formula === 'mujer') {
    if (!positivo(cadera) || cintura + cadera - cuello <= 0) return null;
    denominador = 1.29579 - 0.35004 * Math.log10(cintura + cadera - cuello) + 0.221 * Math.log10(estatura);
  } else {
    return null;
  }
  const grasa = 495 / denominador - 450;
  return Number.isFinite(grasa) && grasa > 0 && grasa < 75 ? grasa : null;
}

/** Cintura entre estatura (las dos en cm), o null si falta una. */
export function cinturaEstatura(cintura, estatura) {
  return positivo(cintura) && positivo(estatura) ? cintura / estatura : null;
}

/**
 * La medición contra la cual comparar `ultima`: la más cercana a 4 semanas
 * antes, con al menos 3 semanas de diferencia. null si no hay ninguna.
 */
export function medicionDeComparacion(lista, ultima) {
  if (!ultima) return null;
  const fin = deTexto(ultima.fecha);
  let mejor = null;
  let mejorDistancia = Infinity;
  for (const m of lista) {
    const dias = diasEntre(deTexto(m.fecha), fin);
    if (dias < DIAS_MINIMOS) continue;
    const distancia = Math.abs(dias - DIAS_OBJETIVO);
    // Empate: gana la más reciente.
    if (distancia < mejorDistancia || (distancia === mejorDistancia && m.fecha > mejor.fecha)) {
      mejor = m;
      mejorDistancia = distancia;
    }
  }
  return mejor;
}

/** Campo por campo, lo que cambió entre dos mediciones (solo campos medidos en las dos). */
export function comparar(antes, ahora) {
  const cambios = [];
  for (const { campo, etiqueta, unidad } of CAMPOS_MEDIDA) {
    const a = antes[campo];
    const b = ahora[campo];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    cambios.push({ campo, etiqueta, unidad, antes: a, ahora: b, cambio: Math.round((b - a) * 100) / 100 });
  }
  return cambios;
}

/**
 * ¿Ya tocan fotos? Sí, si las últimas anotadas tienen 4 semanas o más, o si
 * hay mediciones y nunca se han anotado fotos.
 * @returns {{toca:boolean, ultima:string|null, dias:number|null}}
 */
export function fotosPendientes(lista, hoyTexto) {
  const conFotos = lista.filter((m) => m.fotosTomadas).map((m) => m.fecha).sort();
  const ultima = conFotos.at(-1) ?? null;
  if (!ultima) return { toca: lista.length > 0, ultima: null, dias: null };
  const dias = diasEntre(deTexto(ultima), deTexto(hoyTexto));
  return { toca: dias >= DIAS_ENTRE_FOTOS, ultima, dias };
}

/** Los valores de un campo en orden de fecha, para graficar (sin los no medidos). */
export function serieDeCampo(lista, campo) {
  return lista
    .filter((m) => typeof m[campo] === 'number')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({ fecha: m.fecha, valor: m[campo] }));
}
