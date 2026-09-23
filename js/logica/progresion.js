// Lógica pura: ¿ya le toca subirle? Patrón estrategia: un evaluador por tipo
// de regla (encargo 5.2). La app AVISA y el usuario decide (decisión 6).
// El RIR nunca cuenta (encargo l.302): solo repeticiones, segundos o metros.

import { porNumero } from './referencia.js';

const NO_CUMPLE = Object.freeze({ cumplida: false, propuesta: null });

/** Paso de peso cuando la regla no dice cuánto subir (el usuario lo ajusta). */
export const PASO_PESO = Object.freeze({ kg: 2.5, lb: 5 });

const redondear = (n) => Math.round(n * 100) / 100;

/** ¿Todas las series planeadas están completas y llegaron a `objetivo`? */
export function todasAlcanzan(series, ejercicio, objetivo) {
  const numeros = porNumero(series, ejercicio.tipoMedida);
  for (let k = 1; k <= ejercicio.series; k++) {
    const valor = numeros.get(k)?.valor;
    if (valor === null || valor === undefined || valor < objetivo) return false;
  }
  return true;
}

/** Peso y unidad de la última serie completada de la sesión. */
function pesoActual(series) {
  const completadas = series.filter((s) => s.completada);
  const ultima = completadas.reduce((a, b) => (b.hora > a.hora ? b : a));
  return { peso: ultima.peso ?? 0, unidadPeso: ultima.unidadPeso };
}

const EVALUADORES = {
  manual: () => NO_CUMPLE,

  todas_las_series({ regla, ejercicio, seriesSesion }) {
    if (!todasAlcanzan(seriesSesion, ejercicio, regla.objetivo)) return NO_CUMPLE;
    const { peso, unidadPeso } = pesoActual(seriesSesion);
    const libre = regla.incremento === null || regla.incremento === undefined;
    const incremento = libre ? PASO_PESO[unidadPeso] ?? 0 : regla.incremento;
    return { cumplida: true, propuesta: { tipo: 'peso', peso: redondear(peso + incremento), unidadPeso, libre } };
  },

  todas_las_series_dos_semanas({ regla, ejercicio, seriesSesion, seriesSemanaAnterior, referencia }) {
    if (!todasAlcanzan(seriesSesion, ejercicio, regla.objetivo)) return NO_CUMPLE;
    if (!seriesSemanaAnterior?.length || !todasAlcanzan(seriesSemanaAnterior, ejercicio, regla.objetivo)) return NO_CUMPLE;
    // La racha vuelve a empezar después de cada cambio aceptado.
    const semanaAnterior = seriesSemanaAnterior[0].semanaISO;
    if (referencia && semanaAnterior <= referencia.semanaISO) return NO_CUMPLE;
    const { peso } = pesoActual(seriesSesion);
    const opciones = regla.opciones.map((o) =>
      o.cambio
        ? { etiqueta: o.etiqueta, tipo: 'implemento', implemento: o.cambio }
        : { etiqueta: o.etiqueta, tipo: 'peso', peso: redondear(peso + o.incremento), unidadPeso: o.unidad },
    );
    return { cumplida: true, propuesta: { tipo: 'opciones', opciones } };
  },

  incremento_semanal_tiempo({ regla, ejercicio, seriesSesion, referencia, semanaISO }) {
    const numeros = porNumero(seriesSesion, ejercicio.tipoMedida);
    const valores = [];
    for (let k = 1; k <= ejercicio.series; k++) {
      const valor = numeros.get(k)?.valor;
      if (valor === null || valor === undefined) return NO_CUMPLE;
      valores.push(valor);
    }
    const base = Math.min(...valores);
    if (base >= regla.tope) return NO_CUMPLE;
    if (referencia && referencia.semanaISO === semanaISO) return NO_CUMPLE; // ya subió esta semana
    return { cumplida: true, propuesta: { tipo: 'tiempo', valor: Math.min(base + regla.incremento, regla.tope) } };
  },

  cambio_de_implemento({ regla, ejercicio, seriesSesion, implemento }) {
    if (implemento === regla.cambio) return NO_CUMPLE; // ese cambio ya se hizo
    if (!todasAlcanzan(seriesSesion, ejercicio, regla.objetivo)) return NO_CUMPLE;
    const propuesta = { tipo: 'implemento', implemento: regla.cambio };
    if (regla.peso !== undefined) {
      Object.assign(propuesta, { peso: regla.peso, unidadPeso: regla.unidad, pesoPorLado: regla.pesoPorLado ?? false });
    }
    return { cumplida: true, propuesta };
  },
};

export const TIPOS_DE_REGLA = Object.freeze(Object.keys(EVALUADORES));

/**
 * @param {object} ctx
 * @param {object} ctx.ejercicio  renglón de rutina (trae progresionRegla)
 * @param {Array<object>} ctx.seriesSesion  series de esta sesión para este ejercicio
 * @param {Array<object>} [ctx.seriesSemanaAnterior]  series de la sesión de la semana ISO anterior
 * @param {object|null} [ctx.referencia]  último aviso aceptado ({ hora, semanaISO, … })
 * @param {string|null} [ctx.implemento]  implemento vigente (p. ej. 'Banda roja')
 * @param {string} ctx.semanaISO  semana de esta sesión
 * @returns {{cumplida:boolean, propuesta:object|null}}
 */
export function evaluarProgresion(ctx) {
  const regla = ctx.ejercicio.progresionRegla ?? { tipo: 'manual' };
  const evaluador = EVALUADORES[regla.tipo];
  if (!evaluador) throw new Error(`Tipo de regla desconocido: ${regla.tipo}`);
  return evaluador({ referencia: null, implemento: null, seriesSemanaAnterior: [], ...ctx, regla });
}

/** Lo que se guarda como nueva referencia al aceptar una propuesta (o una opción). */
export function referenciaDeAceptar(propuesta, { hora, semanaISO }) {
  const referencia = { hora, semanaISO, tipo: propuesta.tipo };
  if ('peso' in propuesta) {
    Object.assign(referencia, { peso: propuesta.peso, unidadPeso: propuesta.unidadPeso });
    if ('pesoPorLado' in propuesta) referencia.pesoPorLado = propuesta.pesoPorLado;
  }
  if (propuesta.tipo === 'tiempo') referencia.valor = propuesta.valor;
  if (propuesta.implemento) referencia.implemento = propuesta.implemento;
  return referencia;
}
