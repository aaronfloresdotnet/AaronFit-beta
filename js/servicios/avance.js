// Capa de aplicación: tu avance (tanda 2). Lee lo guardado y lo resume con
// las reglas de logica/avance.js. No escribe nada.

import {
  constancia, ejercicioPorDefecto, ejerciciosConHistorial, estancamiento, marcasDeAvisos, puntosDeEjercicio, puntosPorClave,
  records, resumenSemana, SEMANAS_CONSTANCIA, seriesPorGrupo, ultimasSemanas,
} from '../logica/avance.js';
import { DECISIONES_VACIAS } from '../logica/dias.js';
import { diasDelPlan, numeroDePlan, renglonesDeSemana } from '../logica/plan.js';
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
    const [rutina, sesiones, series, inicio, planes] = await Promise.all([
      repos.rutina.todas(),
      repos.sesiones.todas(),
      repos.series.todas(),
      repos.estado.leer('inicioPrograma'),
      repos.estado.leer('planes'),
    ]);
    return {
      rutina,
      sesiones,
      series,
      inicio: inicio ?? null,
      puntos: puntosPorClave({ rutina, sesiones, series }),
      // Tanda 4: los renglones de la rutina que regía cada semana.
      deSemana: (semana) => renglonesDeSemana(rutina, planes, semana),
    };
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
    const base = (semana) => ({ semana, rutina: d.deSemana(semana), sesiones: d.sesiones, series: d.series, puntos: d.puntos });
    const ejercicios = ejerciciosConHistorial({ rutina: d.rutina, puntos: d.puntos });
    // Estancados (tanda 3): solo ejercicios con regla de progresión y de la rutina de esta semana.
    const avisos = (await repos.estado.leer('avisosAceptados')) ?? [];
    const deHoy = new Set(d.deSemana(t.semana).map((r) => r.clave));
    const estancados = ejercicios
      .filter((e) => e.conRegla && deHoy.has(e.clave))
      .map((e) => ({ clave: e.clave, nombre: e.nombre, ...estancamiento(d.puntos.get(e.clave), avisos.filter((a) => a.clave === e.clave)) }))
      .filter((e) => e.estancado);
    return {
      estancados,
      hoy: t,
      hayDatos: d.series.some((s) => s.completada),
      semana: resumenSemana(base(t.semana)),
      semanaPasada: d.inicio && d.inicio <= previa ? resumenSemana(base(previa)) : null,
      constancia: constancia({
        semanas,
        sesiones: d.sesiones,
        decisiones,
        hoy: t,
        diasPorSemana: Object.fromEntries(semanas.map((s) => [s, diasDelPlan(d.deSemana(s))])),
      }),
      ejercicios,
      porDefecto: ejercicioPorDefecto(ejercicios),
      grupos: seriesPorGrupo({
        actual: { semana: t.semana, rutina: d.deSemana(t.semana) },
        anterior: { semana: previa, rutina: d.deSemana(previa) },
        series: d.series,
      }),
    };
  }

  /** Para Inicio: el resumen de la semana pasada, solo lunes y martes (y si el programa ya había empezado). */
  async function semanaPasadaParaInicio() {
    const t = ahora();
    if (t.dia > 2) return null;
    const previa = semanaAnterior(t.semana);
    const d = await leerTodo();
    if (!d.inicio || d.inicio > previa) return null;
    return resumenSemana({ semana: previa, rutina: d.deSemana(previa), sesiones: d.sesiones, series: d.series, puntos: d.puntos });
  }

  /** Gráfica, récords y avisos aceptados de un ejercicio (por clave). */
  async function ejercicio(clave) {
    const [rutina, sesiones, avisos, referencia, nota] = await Promise.all([
      repos.rutina.todas(),
      repos.sesiones.todas(),
      repos.estado.leer('avisosAceptados'),
      repos.estado.leer(`referencia:${clave}`),
      repos.estado.leer(`nota:${clave}`),
    ]);
    // El renglón de la rutina más nueva que trae el ejercicio da nombre y unidad.
    const filas = rutina.filter((r) => r.clave === clave).sort((x, y) => numeroDePlan(y) - numeroDePlan(x) || porDiaYOrden(x, y));
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
      nota: nota ?? null,
    };
  }

  return { resumen, semanaPasadaParaInicio, ejercicio };
}
