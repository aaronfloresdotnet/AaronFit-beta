// Lógica pura: una rutina completa (un «plan») en TSV. La usan el generador de
// la semilla (tu hoja, plan 1) y el cambio de rutina de la tanda 4 (lo que
// devuelve la IA, planes 2, 3…). Lee, convierte, valida y compara.
//
// ids: plan 1 = diaSemana * 100 + orden (los de siempre, sin campo `plan`);
// plan N ≥ 2 = N * 1000 + diaSemana * 100 + orden, con `plan: N`. Los renglones
// de planes viejos NUNCA se borran: las series apuntan a ellos. El historial de
// un ejercicio sigue entre planes por su clave, que se hereda por nombre (sin
// mayúsculas ni acentos): ver asignarClaves.

import {
  nulo, parsearDescanso, parsearEntero, parsearPeso, parsearRegla, parsearReps, parsearRir, quitarAcentos, reglaATexto, slug,
} from './parseo.js';

export const COLUMNAS_RUTINA = Object.freeze([
  'Día', 'Orden', 'Grupo', 'Ejercicio', 'Equipo', 'Accesorio polea', 'Peso sugerido',
  'Series', 'Reps', 'RIR', 'Descanso', 'Progresión', 'Link MuscleWiki', 'Regla',
]);

const DIAS = { LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6, DOMINGO: 7 };

/** 'MIÉRCOLES - Jalón' → 3. Acepta el día sin acentos. */
export function diaDeTexto(dia) {
  return DIAS[quitarAcentos(dia.split(' - ')[0].trim()).toUpperCase()] ?? null;
}

/** Un día es de caminata si su nombre lo dice: 'SÁBADO - Caminata'. No se recorre ni cuenta como día de fuerza. */
export const esDiaDeCaminata = (dia) => /caminata/i.test(dia.split(' - ').slice(1).join(' - '));

export const numeroDePlan = (renglon) => renglon.plan ?? 1;

/**
 * Lee un TSV de rutina. Acepta el bloque ```tsv … ``` que devuelve la IA, texto
 * antes o después de la tabla, y saltos de línea de Windows.
 * @returns {{filas: object[], errores: string[]}}  cada fila trae `_renglon` (su número en el TSV)
 */
export function leerTSV(texto) {
  let cuerpo = String(texto ?? '').replace(/\r\n?/g, '\n');
  const bloque = cuerpo.match(/```[a-z]*\n([\s\S]*?)```/i);
  if (bloque) cuerpo = bloque[1];
  const lineas = cuerpo.split('\n');
  const inicio = lineas.findIndex((l) => l.split('\t')[0].trim() === COLUMNAS_RUTINA[0]);
  if (inicio < 0) return { filas: [], errores: [`No encontré el encabezado. Debe ser: ${COLUMNAS_RUTINA.join(' | ')}`] };
  const encabezado = lineas[inicio].split('\t').map((c) => c.trim());
  if (encabezado.join('|') !== COLUMNAS_RUTINA.join('|')) {
    return { filas: [], errores: [`El encabezado debe ser exactamente: ${COLUMNAS_RUTINA.join(' | ')}. Llegó: ${encabezado.join(' | ')}`] };
  }
  const filas = [];
  const errores = [];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea.trim() === '') continue;
    if (!linea.includes('\t')) break; // terminó la tabla
    const celdas = linea.split('\t');
    if (celdas.length !== COLUMNAS_RUTINA.length) {
      errores.push(`Renglón ${i - inicio + 1}: tiene ${celdas.length} columnas y deben ser ${COLUMNAS_RUTINA.length}.`);
      continue;
    }
    filas.push({ _renglon: i - inicio + 1, ...Object.fromEntries(COLUMNAS_RUTINA.map((c, j) => [c, celdas[j].trim()])) });
  }
  if (!filas.length && !errores.length) errores.push('La tabla no trae ejercicios.');
  return { filas, errores };
}

/** Una fila del TSV → un renglón de rutina. Lanza error con el motivo si algo no se entiende. */
function convertir(fila, plan) {
  const diaSemana = diaDeTexto(fila['Día']);
  if (!diaSemana) throw new Error(`día no reconocido: "${fila['Día']}"`);
  const orden = parsearEntero(fila.Orden);
  const liga = fila['Link MuscleWiki'];
  const renglon = {
    id: plan === 1 ? diaSemana * 100 + orden : plan * 1000 + diaSemana * 100 + orden,
    dia: fila['Día'],
    diaSemana,
    orden,
    clave: null, // se asigna viendo todo el plan
    grupo: fila.Grupo,
    ejercicio: fila.Ejercicio,
    equipo: fila.Equipo,
    accesorioPolea: nulo(fila['Accesorio polea']),
    pesoTexto: fila['Peso sugerido'],
    ...parsearPeso(fila['Peso sugerido']),
    series: parsearEntero(fila.Series),
    repsTexto: fila.Reps,
    ...parsearReps(fila.Reps),
    rir: parsearRir(fila.RIR),
    descansoTexto: fila.Descanso,
    descansoSeg: parsearDescanso(fila.Descanso),
    progresionTexto: fila['Progresión'],
    progresionRegla: parsearRegla(fila.Regla),
    liga: liga === 'SIN LIGA' ? null : liga,
  };
  if (!renglon.ejercicio) throw new Error('falta el nombre del ejercicio');
  if (renglon.series < 1) throw new Error('las series deben ser 1 o más');
  const regla = renglon.progresionRegla;
  if (renglon.unidadPeso !== 'corporal' && regla.unidad && regla.unidad !== renglon.unidadPeso && regla.tipo === 'todas_las_series') {
    throw new Error(`la regla sube en ${regla.unidad} pero el peso es en ${renglon.unidadPeso}`);
  }
  if (plan !== 1) renglon.plan = plan;
  return renglon;
}

/**
 * La clave junta el historial de un ejercicio. Se hereda por nombre, para que
 * una rutina nueva no lo pierda (Aarón, 2026-09-23):
 * - si el ejercicio ya tenía UNA clave, todos sus renglones la heredan, aunque
 *   ahora su prescripción cambie entre días;
 * - si tenía una por día (tu elevación lateral de lunes y viernes), cada día
 *   hereda la suya y un día nuevo lleva la propia;
 * - si es nuevo, comparte clave en toda la semana solo si su prescripción es
 *   idéntica; si cambia entre días, cada día lleva la suya.
 * @param {object[]} renglones  los del plan nuevo
 * @param {object[]} previos  los de tus rutinas anteriores
 */
function asignarClaves(renglones, previos) {
  const prescripcion = (r) => {
    const { id, dia, diaSemana, orden, clave, ...resto } = r;
    return JSON.stringify(resto);
  };
  const deDia = (nombre, r) => `${nombre}-${slug(r.dia.split(' - ')[0])}`;
  // Lo que ya había de cada nombre: sus claves y la de cada día en la rutina más reciente.
  const antes = new Map();
  for (const r of previos) {
    const nombre = slug(r.ejercicio);
    const info = antes.get(nombre) ?? { claves: new Set(), dias: new Map() };
    info.claves.add(r.clave);
    const visto = info.dias.get(r.diaSemana);
    if (!visto || numeroDePlan(r) > visto.plan) info.dias.set(r.diaSemana, { plan: numeroDePlan(r), clave: r.clave });
    antes.set(nombre, info);
  }
  for (const [nombre, grupo] of Map.groupBy(renglones, (r) => slug(r.ejercicio))) {
    const previo = antes.get(nombre);
    if (previo?.claves.size === 1) {
      const [clave] = previo.claves;
      for (const r of grupo) r.clave = clave;
    } else if (previo) {
      for (const r of grupo) r.clave = previo.dias.get(r.diaSemana)?.clave ?? deDia(nombre, r);
    } else {
      const distintas = new Set(grupo.map(prescripcion));
      for (const r of grupo) r.clave = distintas.size === 1 ? nombre : deDia(nombre, r);
    }
  }
}

/**
 * Filas de un TSV → renglones del plan `plan`, con claves. Si hay errores, no
 * devuelve renglones (nada a medias). Una liga que no está en `ligasValidas`
 * no es error: el ejercicio queda sin video y se avisa.
 * @param {object[]} filas  de leerTSV
 * @param {{plan?:number, ligasValidas?:Set<string>|null, previos?:object[]}} [opciones]
 *   previos: los renglones de tus rutinas anteriores, de donde se heredan las claves
 * @returns {{renglones:object[], errores:string[], avisos:string[]}}
 */
export function renglonesDePlan(filas, { plan = 1, ligasValidas = null, previos = [] } = {}) {
  const renglones = [];
  const errores = [];
  const avisos = [];
  for (const fila of filas) {
    try {
      const renglon = convertir(fila, plan);
      if (ligasValidas && renglon.liga && !ligasValidas.has(renglon.liga)) {
        avisos.push(`Renglón ${fila._renglon} (${renglon.ejercicio}): la liga no es de la lista; queda sin video.`);
        renglon.liga = null;
      }
      renglones.push(renglon);
    } catch (error) {
      errores.push(`Renglón ${fila._renglon}: ${error.message}.`);
    }
  }
  const vistos = new Set();
  for (const r of renglones) {
    const llave = `${r.diaSemana}-${r.orden}`;
    if (vistos.has(llave)) errores.push(`${r.dia}: hay dos ejercicios con orden ${r.orden}.`);
    vistos.add(llave);
  }
  if (!errores.length && !renglones.some((r) => !esDiaDeCaminata(r.dia))) errores.push('La rutina no trae ningún día de fuerza.');
  if (errores.length) return { renglones: [], errores, avisos };
  asignarClaves(renglones, previos);
  return { renglones, errores, avisos };
}

/** Un plan en TSV (lo inverso de leerTSV + renglonesDePlan), en orden de día y ejercicio. */
export function rutinaATSV(renglones) {
  const filas = [...renglones]
    .sort((a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden)
    .map((r) =>
      [
        r.dia, r.orden, r.grupo, r.ejercicio, r.equipo, r.accesorioPolea ?? '-', r.pesoTexto, r.series, r.repsTexto,
        r.rir ?? '-', r.descansoTexto, r.progresionTexto, r.liga ?? 'SIN LIGA', reglaATexto(r.progresionRegla),
      ].join('\t'),
    );
  return [COLUMNAS_RUTINA.join('\t'), ...filas].join('\n');
}

/** Los días de un plan: de fuerza y de caminata. */
export function diasDelPlan(renglones) {
  const fuerza = new Set();
  const caminata = new Set();
  for (const r of renglones) (esDiaDeCaminata(r.dia) ? caminata : fuerza).add(r.diaSemana);
  const orden = (conjunto) => [...conjunto].sort((a, b) => a - b);
  return { fuerza: orden(fuerza), caminata: orden(caminata) };
}

export const PLAN_INICIAL = Object.freeze({ numero: 1, nombre: 'Rutina 1', desde: null });

/** La lista de planes guardada (o solo el inicial). */
export const listaDePlanes = (guardados) => (Array.isArray(guardados) && guardados.length ? guardados : [PLAN_INICIAL]);

/** El plan que rige en una semana ISO: el más nuevo que ya empezó. */
export function planDeSemana(planes, semana) {
  return listaDePlanes(planes)
    .filter((p) => p.desde === null || p.desde <= semana)
    .reduce((a, p) => (p.numero > a ? p.numero : a), 1);
}

/** Los renglones del plan que rige en `semana`. */
export function renglonesDeSemana(rutina, planes, semana) {
  const numero = planDeSemana(planes, semana);
  return rutina.filter((r) => numeroDePlan(r) === numero);
}

const CAMPOS = [
  ['series', 'series'], ['repsTexto', 'reps'], ['pesoTexto', 'peso'], ['rir', 'RIR'], ['descansoTexto', 'descanso'],
  ['equipo', 'equipo'], ['accesorioPolea', 'accesorio'], ['progresionTexto', 'progresión'],
];

/** Lo que cambia de un renglón a otro, en palabras. */
function cambiosEntre(a, b) {
  const cambios = [];
  for (const [campo, etiqueta] of CAMPOS) {
    const x = a[campo] ?? '-';
    const y = b[campo] ?? '-';
    if (x !== y) cambios.push(`${etiqueta}: ${x} → ${y}`);
  }
  if (reglaATexto(a.progresionRegla) !== reglaATexto(b.progresionRegla)) cambios.push('regla de progresión');
  return cambios;
}

/**
 * Qué cambia entre el plan actual y uno nuevo, por ejercicio (clave): los
 * nuevos empiezan sin historial; los que se quedan y los que vuelven de una
 * rutina anterior conservan el suyo. Cada día se compara con el mismo día de
 * antes; un cambio que no es de todos los días dice de cuáles.
 * @param {object[]} actual  los renglones del plan que rige
 * @param {object[]} nuevo
 * @param {object[]} [anteriores]  los de todas tus rutinas anteriores (para saber qué vuelve)
 * @returns {{nuevos:string[], vuelven:string[], salen:string[], cambian:Array<{ejercicio:string, cambios:string[]}>, iguales:string[]}}
 */
export function diferencias(actual, nuevo, anteriores = []) {
  const porClave = (lista) => Map.groupBy([...lista].sort((a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden), (r) => r.clave);
  const antes = porClave(actual);
  const despues = porClave(nuevo);
  const conHistorial = new Set(anteriores.map((r) => r.clave));
  const diaDe = (r) => r.dia.split(' - ')[0];
  const dias = (grupo) => grupo.map(diaDe).join(', ');
  // «Elevación lateral (viernes)» cuando el ejercicio lleva una clave por día.
  const nombre = (grupo) => (grupo[0].clave === slug(grupo[0].ejercicio) ? grupo[0].ejercicio : `${grupo[0].ejercicio} (${dias(grupo).toLowerCase()})`);
  const resultado = { nuevos: [], vuelven: [], salen: [], cambian: [], iguales: [] };
  for (const [clave, grupo] of despues) {
    const previo = antes.get(clave);
    if (!previo) {
      (conHistorial.has(clave) ? resultado.vuelven : resultado.nuevos).push(nombre(grupo));
      continue;
    }
    const cambios = [];
    if (dias(previo) !== dias(grupo)) cambios.push(`días: ${dias(previo)} → ${dias(grupo)}`);
    const enDias = new Map();
    for (const r of grupo) {
      const base = previo.find((p) => p.diaSemana === r.diaSemana) ?? previo[0];
      for (const cambio of cambiosEntre(base, r)) enDias.set(cambio, [...(enDias.get(cambio) ?? []), diaDe(r).toLowerCase()]);
    }
    for (const [cambio, cuales] of enDias) cambios.push(cuales.length === grupo.length ? cambio : `${cambio} (${cuales.join(', ')})`);
    if (cambios.length) resultado.cambian.push({ ejercicio: nombre(grupo), cambios });
    else resultado.iguales.push(nombre(grupo));
  }
  for (const [clave, grupo] of antes) if (!despues.has(clave)) resultado.salen.push(nombre(grupo));
  return resultado;
}
