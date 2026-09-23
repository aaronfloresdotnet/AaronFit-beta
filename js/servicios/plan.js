// Capa de aplicación: cambiar de rutina (tanda 4). Arma el prompt con tus
// datos, revisa la respuesta de la IA sin tocar nada, y la programa desde el
// lunes siguiente. La rutina actual sigue hasta ese día; sus renglones nunca
// se borran (las series apuntan a ellos). Una rutina programada que todavía no
// empieza se puede quitar o reemplazar.

import { estancamiento, puntosPorClave, records, resumenSemana, ultimasSemanas } from '../logica/avance.js';
import { cinturaEstatura, comparar, grasaMarina, medicionDeComparacion } from '../logica/cuerpo.js';
import { cargar, implementoDe, normalizarEquipo, UNIDAD_DE } from '../logica/equipo.js';
import { decimal, fechaCorta, numero as num } from '../logica/formato.js';
import {
  diasDelPlan, diferencias, esDiaDeCaminata, leerTSV, listaDePlanes, numeroDePlan, planDeSemana, renglonesDePlan,
  renglonesDeSemana, rutinaATSV,
} from '../logica/plan.js';
import { armarPrompt } from '../logica/prompt.js';
import { porNumero } from '../logica/referencia.js';
import { aTexto, fechaLocal, lunesDeSemana, semanaAnterior, semanaISO, sumarDias } from '../logica/semana.js';

const porDiaYOrden = (a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden;

/** Cada día de un plan con cuántos ejercicios trae. */
function diasConEjercicios(renglones) {
  return [...Map.groupBy([...renglones].sort(porDiaYOrden), (r) => r.dia)].map(([dia, lista]) => ({ dia, ejercicios: lista.length }));
}

export function crearServicioPlan({ repos, reloj = () => new Date(), ligasConVideo = async () => [], despuesDeCambiar = () => {} }) {
  function ahora() {
    const instante = reloj();
    const fecha = fechaLocal(instante);
    return { hora: instante.toISOString(), fecha: aTexto(fecha), semana: semanaISO(fecha) };
  }

  const siguienteLunes = (semana) => semanaISO(sumarDias(lunesDeSemana(semana), 7));

  async function leer() {
    const [rutina, guardados] = await Promise.all([repos.rutina.todas(), repos.estado.leer('planes')]);
    return { rutina, planes: listaDePlanes(guardados) };
  }

  /** La rutina que rige esta semana y la programada que todavía no empieza (si hay). */
  function vigenteYProgramado(rutina, planes, semana) {
    const numero = planDeSemana(planes, semana);
    const programado = planes.filter((p) => p.desde && p.desde > semana).sort((a, b) => b.numero - a.numero)[0] ?? null;
    const describir = (plan) => {
      const renglones = rutina.filter((r) => numeroDePlan(r) === plan.numero);
      return { ...plan, dias: diasConEjercicios(renglones), ejercicios: new Set(renglones.map((r) => r.clave)).size };
    };
    return { vigente: describir(planes.find((p) => p.numero === numero) ?? { numero, nombre: `Rutina ${numero}`, desde: null }), programado: programado ? describir(programado) : null };
  }

  async function situacion() {
    const t = ahora();
    const { rutina, planes } = await leer();
    return vigenteYProgramado(rutina, planes, t.semana);
  }

  /** Las ligas que la IA puede usar: las que tienen video y las de tus rutinas. */
  async function ligasPermitidas(rutina) {
    return [...new Set([...(await ligasConVideo()), ...rutina.map((r) => r.liga).filter(Boolean)])].sort();
  }

  /** El prompt con tu rutina actual, tu avance, tus notas y (si quieres) tus medidas. */
  async function prompt({ queQuiero = '', conMedidas = true } = {}) {
    const t = ahora();
    const [{ rutina, planes }, sesiones, series, equipo, avisos, inicio, medidas, perfil] = await Promise.all([
      leer(),
      repos.sesiones.todas(),
      repos.series.todas(),
      repos.estado.leer('equipo'),
      repos.estado.leer('avisosAceptados'),
      repos.estado.leer('inicioPrograma'),
      repos.medidas.todas(),
      repos.estado.leer('perfil'),
    ]);
    const actual = renglonesDeSemana(rutina, planes, t.semana);
    const puntos = puntosPorClave({ rutina, sesiones, series });

    // Una línea por ejercicio de la rutina actual: la última vez, el récord y si está estancado.
    const avance = [];
    const notas = [];
    for (const [clave, grupo] of Map.groupBy([...actual].sort(porDiaYOrden), (r) => r.clave)) {
      const e = grupo[0];
      const dias = grupo.map((r) => r.dia.split(' - ')[0].toLowerCase()).join(', ');
      const nota = await repos.estado.leer(`nota:${clave}`);
      if (nota) notas.push(`${e.ejercicio}: ${nota.texto} (${fechaCorta(nota.fecha)})`);
      const deClave = puntos.get(clave) ?? [];
      if (!deClave.length) {
        avance.push(`${e.ejercicio} (${dias}): sin registros.`);
        continue;
      }
      const ultimo = deClave.at(-1);
      const ids = new Set(rutina.filter((r) => r.clave === clave).map((r) => r.id));
      const deSesion = series.filter((s) => s.sesionId === ultimo.sesionId && ids.has(s.rutinaId));
      const hechas = [...porNumero(deSesion, e.tipoMedida).values()].sort((a, b) => a.numeroSerie - b.numeroSerie).map((s) => {
        const valor = e.tipoMedida === 'minutos' ? `${num(s.valor / 60)} min` : e.tipoMedida === 'segundos' ? `${num(s.valor)} s` : e.tipoMedida === 'metros' ? `${num(s.valor)} m` : num(s.valor);
        return s.unidadPeso === 'corporal' || s.peso === null ? valor : `${num(s.peso)} ${s.unidadPeso} × ${valor}`;
      });
      const r = records(deClave);
      const partes = [`${e.ejercicio} (${dias}): última vez ${fechaCorta(ultimo.fecha)}: ${hechas.join(', ')}`];
      if (r?.peso) partes.push(`récord ${num(r.peso.valor)} ${r.unidad}`);
      const estancado = (e.progresionRegla?.tipo ?? 'manual') !== 'manual' ? estancamiento(deClave, (avisos ?? []).filter((a) => a.clave === clave)) : null;
      if (estancado?.estancado) partes.push(`${estancado.semanas} semanas sin subir`);
      avance.push(`${partes.join('; ')}.`);
    }

    // Constancia de las últimas 4 semanas cerradas.
    const cerradas = ultimasSemanas(inicio ?? null, semanaAnterior(t.semana), 4);
    let constancia = null;
    if (cerradas.length) {
      const resumenes = cerradas.map((semana) => resumenSemana({ semana, rutina: renglonesDeSemana(rutina, planes, semana), sesiones, series, puntos }));
      const hechos = resumenes.reduce((s, r) => s + r.dias.hechos, 0);
      const plan = resumenes.reduce((s, r) => s + r.dias.plan, 0);
      constancia = `En las últimas ${cerradas.length} semanas cerradas hice ${hechos} de ${plan} días de fuerza.`;
    }

    // Medidas: la última, la de hace ~4 semanas y el % de grasa estimado si hay perfil.
    let lineasMedidas = null;
    if (conMedidas) {
      lineasMedidas = [];
      const lista = [...medidas].sort((a, b) => b.fecha.localeCompare(a.fecha));
      const ultima = lista[0];
      if (ultima) {
        const campos = [['pesoCorporal', 'peso', 'kg'], ['cintura', 'cintura', 'cm'], ['cadera', 'cadera', 'cm'], ['cuello', 'cuello', 'cm']]
          .filter(([c]) => ultima[c] !== null)
          .map(([c, etiqueta, unidad]) => `${etiqueta} ${num(ultima[c])} ${unidad}`);
        lineasMedidas.push(`${fechaCorta(ultima.fecha)}: ${campos.join(', ')}.`);
        const antes = medicionDeComparacion(lista, ultima);
        if (antes) {
          const cambios = comparar(antes, ultima).map((c) => `${c.etiqueta.toLowerCase()} ${c.cambio > 0 ? '+' : ''}${num(c.cambio)} ${c.unidad}`);
          if (cambios.length) lineasMedidas.push(`Desde el ${fechaCorta(antes.fecha)}: ${cambios.join(', ')}.`);
        }
        if (perfil) {
          const grasa = grasaMarina({ formula: perfil.formula, estatura: perfil.estatura, cintura: ultima.cintura, cuello: ultima.cuello, cadera: ultima.cadera });
          if (grasa !== null) lineasMedidas.push(`% de grasa estimado (fórmula de la Marina): ${decimal(grasa)} %.`);
          const relacion = cinturaEstatura(ultima.cintura, perfil.estatura);
          if (relacion !== null) lineasMedidas.push(`Cintura entre estatura: ${decimal(relacion, 2)} (estatura ${num(perfil.estatura)} cm).`);
        }
      }
    }

    const texto = armarPrompt({
      queQuiero,
      equipo: normalizarEquipo(equipo).texto,
      rutinaTSV: rutinaATSV(actual),
      avance,
      constancia,
      medidas: lineasMedidas,
      notas,
      ligas: await ligasPermitidas(rutina),
      fecha: t.fecha,
    });
    return { texto };
  }

  /** Revisa la respuesta de la IA sin guardar nada: errores, avisos, qué cambia y desde cuándo. */
  async function revisar(texto) {
    const t = ahora();
    const { rutina, planes } = await leer();
    const { vigente, programado } = vigenteYProgramado(rutina, planes, t.semana);
    const numero = programado ? programado.numero : Math.max(...planes.map((p) => p.numero)) + 1;
    const { filas, errores: erroresTSV } = leerTSV(texto);
    if (erroresTSV.length) return { ok: false, errores: erroresTSV, avisos: [] };
    const { renglones, errores, avisos } = renglonesDePlan(filas, { plan: numero, ligasValidas: new Set(await ligasPermitidas(rutina)) });
    if (errores.length) return { ok: false, errores, avisos };

    // Pesos que no salen exactos con tus discos: aviso, no error (el primer día lo ajustas).
    const equipo = normalizarEquipo(await repos.estado.leer('equipo'));
    for (const r of renglones) {
      const implemento = implementoDe(r);
      if (!implemento || r.pesoSugerido === null || r.unidadPeso !== UNIDAD_DE[implemento]) continue;
      const carga = cargar({ implemento, peso: r.pesoSugerido, equipo });
      if (carga.estado === 'aproximado') {
        avisos.push(`${r.ejercicio}: ${num(r.pesoSugerido)} ${r.unidadPeso} no sale exacto con tus discos (${carga.cercanos.map((c) => `${num(c)} ${r.unidadPeso}`).join(' o ')}).`);
      }
    }

    const actual = rutina.filter((r) => numeroDePlan(r) === vigente.numero);
    const { fuerza, caminata } = diasDelPlan(renglones);
    return {
      ok: true,
      errores: [],
      avisos,
      renglones,
      numero,
      desde: siguienteLunes(t.semana),
      reemplaza: programado,
      resumen: {
        dias: diasConEjercicios(renglones),
        diasFuerza: fuerza.length,
        diasCaminata: caminata.length,
        ejercicios: new Set(renglones.map((r) => r.clave)).size,
        seriesSemana: renglones.filter((r) => !esDiaDeCaminata(r.dia)).reduce((s, r) => s + r.series, 0),
      },
      diferencias: diferencias(actual, renglones),
    };
  }

  /** Guarda la rutina nueva desde el lunes siguiente (reemplaza la programada, si había). */
  async function programar(texto) {
    const revision = await revisar(texto);
    if (!revision.ok) return revision;
    const t = ahora();
    const { rutina, planes } = await leer();
    const quitar = revision.reemplaza ? rutina.filter((r) => numeroDePlan(r) === revision.reemplaza.numero).map((r) => r.id) : [];
    const siguen = planes.filter((p) => p.numero !== revision.reemplaza?.numero);
    const nuevo = { numero: revision.numero, nombre: `Rutina ${revision.numero}`, desde: revision.desde, creado: t.hora };
    await repos.rutina.cambiarPlanes({ agregar: revision.renglones, quitar, planes: [...siguen, nuevo] });
    despuesDeCambiar();
    return { ok: true, numero: nuevo.numero, desde: nuevo.desde, avisos: revision.avisos };
  }

  /** Quita la rutina programada que todavía no empieza. */
  async function quitarProgramada() {
    const t = ahora();
    const { rutina, planes } = await leer();
    const { programado } = vigenteYProgramado(rutina, planes, t.semana);
    if (!programado) return { ok: false, error: 'No hay una rutina programada.' };
    const ids = rutina.filter((r) => numeroDePlan(r) === programado.numero).map((r) => r.id);
    if ((await repos.series.deRutinas(ids)).length) return { ok: false, error: 'Esa rutina ya tiene series: no se puede quitar.' };
    await repos.rutina.cambiarPlanes({ quitar: ids, planes: planes.filter((p) => p.numero !== programado.numero) });
    despuesDeCambiar();
    return { ok: true };
  }

  return { situacion, prompt, revisar, programar, quitarProgramada };
}
