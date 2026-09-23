// Capa de aplicación: tu avance (tanda 2). Lee lo guardado y lo resume con
// las reglas de logica/avance.js. No escribe nada.

import {
  constancia, ejercicioPorDefecto, ejerciciosConHistorial, marcasDeAvisos, puntosDeEjercicio, puntosPorClave, records,
  resumenSemana, SEMANAS_CONSTANCIA, seriesPorGrupo, ultimasSemanas,
} from '../logica/avance.js';
import { DECISIONES_VACIAS } from '../logica/dias.js';
import { aTexto, diaSemana, fechaLocal, semanaAnterior, semanaISO } from '../logica/semana.js';

/** La gráfica de un ejercicio muestra sus sesiones más recientes (la tabla, las mismas). */
export const SESIONES_EN_GRAFICA = 26;

const porDiaYOrden = (a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden;

export function crearServicioAvance({ repos, reloj = () => new Date() }) {
  function ahora() {
    const fecha = fechaLocal(reloj());
    return { fecha: aTexto(fecha), semana: semanaISO(fecha), dia: diaSemana(fecha) };
  }

  async function leerTodo() {
    const [rutina, sesiones, series, inicio] = await Promise.all([
      repos.rutina.todas(),
      repos.sesiones.todas(),
      repos.series.todas(),
      repos.estado.leer('inicioPrograma'),
    ]);
    return { rutina, sesiones, series, inicio: inicio ?? null, puntos: puntosPorClave({ rutina, sesiones, series }) };
  }

  /** Todo lo de la pantalla Avance, menos la gráfica de un ejercicio. */
  async function resumen() {
    const t = ahora();
    const d = await leerTodo();
    const previa = semanaAnterior(t.semana);
    const semanas = ultimasSemanas(d.inicio, t.semana, SEMANAS_CONSTANCIA);
    const decisiones = Object.fromEntries(
      await Promise.all(semanas.map(async (s) => [s, (await repos.estado.leer(`semana:${s}`)) ?? DECISIONES_VACIAS])),
    );
    const base = { rutina: d.rutina, sesiones: d.sesiones, series: d.series, puntos: d.puntos };
    const ejercicios = ejerciciosConHistorial({ rutina: d.rutina, puntos: d.puntos });
    return {
      hoy: t,
      hayDatos: d.series.some((s) => s.completada),
      semana: resumenSemana({ semana: t.semana, ...base }),
      semanaPasada: d.inicio && d.inicio <= previa ? resumenSemana({ semana: previa, ...base }) : null,
      constancia: constancia({ semanas, sesiones: d.sesiones, decisiones, hoy: t }),
      ejercicios,
      porDefecto: ejercicioPorDefecto(ejercicios),
      grupos: seriesPorGrupo({ rutina: d.rutina, series: d.series, actual: t.semana, anterior: previa }),
    };
  }

  /** Para Inicio: el resumen de la semana pasada, solo lunes y martes (y si el programa ya había empezado). */
  async function semanaPasadaParaInicio() {
    const t = ahora();
    if (t.dia > 2) return null;
    const previa = semanaAnterior(t.semana);
    const d = await leerTodo();
    if (!d.inicio || d.inicio > previa) return null;
    return resumenSemana({ semana: previa, rutina: d.rutina, sesiones: d.sesiones, series: d.series, puntos: d.puntos });
  }

  /** Gráfica, récords y avisos aceptados de un ejercicio (por clave). */
  async function ejercicio(clave) {
    const [rutina, sesiones, avisos, referencia] = await Promise.all([
      repos.rutina.todas(),
      repos.sesiones.todas(),
      repos.estado.leer('avisosAceptados'),
      repos.estado.leer(`referencia:${clave}`),
    ]);
    const filas = rutina.filter((r) => r.clave === clave).sort(porDiaYOrden);
    if (!filas.length) return null;
    const e = filas[0];
    const series = await repos.series.deRutinas(filas.map((r) => r.id));
    const todos = puntosDeEjercicio({ series, sesiones, tipoMedida: e.tipoMedida });
    const recs = records(todos);
    const unidad = recs?.unidad ?? e.unidadPeso;
    const mismos = todos.filter((p) => p.unidad === unidad);
    const puntos = mismos.slice(-SESIONES_EN_GRAFICA);
    // Los avisos aceptados antes de la tanda 2 solo dejaron la última referencia.
    const propios = (avisos ?? []).filter((a) => a.clave === clave);
    if (referencia && !propios.some((a) => a.hora === referencia.hora)) propios.push({ clave, ...referencia });
    return {
      clave,
      nombre: e.ejercicio,
      grupo: e.grupo,
      tipoMedida: e.tipoMedida,
      pesoPorLado: e.pesoPorLado,
      pesoNota: e.pesoNota ?? null,
      unidad,
      puntos,
      marcas: [...marcasDeAvisos(puntos, propios)].map(([indice, lista]) => ({ indice, avisos: lista })),
      records: recs,
      sesiones: todos.length,
      recortadas: mismos.length - puntos.length,
    };
  }

  return { resumen, semanaPasadaParaInicio, ejercicio };
}
