// Lógica pura: una rutina completa (un «plan») en TSV. La usan el generador de
// la semilla (tu hoja, plan 1) y el cambio de rutina de la tanda 4 (lo que
// devuelve la IA, planes 2, 3…). Lee, convierte, valida y compara.
//
// ids: plan 1 = diaSemana * 100 + orden (los de siempre, sin campo `plan`);
// plan N ≥ 2 = N * 1000 + diaSemana * 100 + orden, con `plan: N`. Los renglones
// de planes viejos NUNCA se borran: las series apuntan a ellos. El historial de
// un ejercicio sigue entre planes por su clave (el nombre, sin acentos).

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
 * Un mismo ejercicio comparte historial en toda la semana (misma clave) solo si
 * su prescripción es idéntica; si cambia entre días (p. ej. elevación lateral
 * lunes y viernes), cada día lleva su propia clave.
 */
function asignarClaves(renglones) {
  const prescripcion = (r) => {
    const { id, dia, diaSemana, orden, clave, ...resto } = r;
    return JSON.stringify(resto);
  };
  for (const [nombre, grupo] of Map.groupBy(renglones, (r) => slug(r.ejercicio))) {
    const distintas = new Set(grupo.map(prescripcion));
    for (const r of grupo) r.clave = distintas.size === 1 ? nombre : `${nombre}-${slug(r.dia.split(' - ')[0])}`;
  }
}

/**
 * Filas de un TSV → renglones del plan `plan`, con claves. Si hay errores, no
 * devuelve renglones (nada a medias). Una liga que no está en `ligasValidas`
 * no es error: el ejercicio queda sin video y se avisa.
 * @param {object[]} filas  de leerTSV
 * @param {{plan?:number, ligasValidas?:Set<string>|null}} [opciones]
 * @returns {{renglones:object[], errores:string[], avisos:string[]}}
 */
export function renglonesDePlan(filas, { plan = 1, ligasValidas = null } = {}) {
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
  asignarClaves(renglones);
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

/**
 * Qué cambia entre el plan actual y uno nuevo, por ejercicio (clave): los
 * nuevos empiezan sin historial; los que se quedan conservan el suyo.
 * @returns {{nuevos:string[], salen:string[], cambian:Array<{ejercicio:string, cambios:string[]}>, iguales:string[]}}
 */
export function diferencias(actual, nuevo) {
  const porClave = (lista) => Map.groupBy([...lista].sort((a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden), (r) => r.clave);
  const antes = porClave(actual);
  const despues = porClave(nuevo);
  const dias = (grupo) => grupo.map((r) => r.dia.split(' - ')[0]).join(', ');
  const resultado = { nuevos: [], salen: [], cambian: [], iguales: [] };
  for (const [clave, grupo] of despues) {
    const previo = antes.get(clave);
    if (!previo) {
      resultado.nuevos.push(grupo[0].ejercicio);
      continue;
    }
    const cambios = [];
    if (dias(previo) !== dias(grupo)) cambios.push(`días: ${dias(previo)} → ${dias(grupo)}`);
    for (const [campo, etiqueta] of CAMPOS) {
      const a = previo[0][campo] ?? '-';
      const b = grupo[0][campo] ?? '-';
      if (a !== b) cambios.push(`${etiqueta}: ${a} → ${b}`);
    }
    if (reglaATexto(previo[0].progresionRegla) !== reglaATexto(grupo[0].progresionRegla)) cambios.push('regla de progresión');
    if (cambios.length) resultado.cambian.push({ ejercicio: grupo[0].ejercicio, cambios });
    else resultado.iguales.push(grupo[0].ejercicio);
  }
  for (const [clave, grupo] of antes) if (!despues.has(clave)) resultado.salen.push(grupo[0].ejercicio);
  return resultado;
}
