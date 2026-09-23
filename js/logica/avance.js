// Lógica pura: tu avance (tanda 2). Puntos por sesión para graficar, récords,
// resumen de una semana, constancia y series por grupo muscular.
//
// Reglas que valen en todo el archivo:
// - Un ejercicio se sigue por su clave: equilibrio y eversión aparecen cinco
//   veces por semana con renglones distintos.
// - Una serie capturada por lado son dos registros: cuenta UNA vez y vale su
//   peor lado (igual que la precarga, ver porNumero).
// - kg y lb nunca se comparan entre sí.
// - Las fechas llegan como texto local ('2026-09-21'); aquí no se lee el reloj.

import { DECISIONES_VACIAS, DIAS_FUERZA, planSemana } from './dias.js';
import { porNumero } from './referencia.js';
import { aTexto, fechaDeDia, lunesDeSemana, semanaISO, semanasEntre, sumarDias } from './semana.js';

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const porDiaYOrden = (a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden;
const mayor = (valores) => valores.filter(esNumero).reduce((a, b) => Math.max(a, b), -Infinity);

/** Semanas que se muestran en la constancia. */
export const SEMANAS_CONSTANCIA = 8;

/** 1RM estimado con la fórmula de Epley: peso × (1 + reps / 30). Con 1 repetición es el mismo peso. */
export function e1rm(peso, reps) {
  if (!esNumero(peso) || !esNumero(reps) || peso <= 0 || reps <= 0) return null;
  return reps === 1 ? peso : peso * (1 + reps / 30);
}

/** Series lógicas (una por número de serie y sesión; por lado vale el peor lado). */
export function seriesLogicas(series, tipoMedida) {
  const lista = [];
  for (const [sesionId, deSesion] of Map.groupBy(series, (s) => s.sesionId)) {
    for (const serie of porNumero(deSesion, tipoMedida).values()) lista.push({ sesionId, ...serie });
  }
  return lista;
}

/**
 * Un punto por sesión en que se hizo el ejercicio, de la más vieja a la más nueva.
 * peso = el mayor peso de la sesión (peso de trabajo); e1rm = el mayor 1RM
 * estimado de sus series (solo ejercicios de repeticiones con peso);
 * valor = la mejor serie en reps, segundos o metros.
 * @param {{series:object[], sesiones:object[], tipoMedida:string}} p  series de todos los renglones de la clave
 */
export function puntosDeEjercicio({ series, sesiones, tipoMedida }) {
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const puntos = [];
  for (const [sesionId, lista] of Map.groupBy(seriesLogicas(series, tipoMedida), (x) => x.sesionId)) {
    const sesion = sesionPorId.get(sesionId);
    if (!sesion) continue;
    const horas = lista.map((x) => x.hora).sort();
    const unidad = lista.reduce((a, b) => (b.hora > a.hora ? b : a)).unidadPeso;
    const mismas = lista.filter((x) => x.unidadPeso === unidad);
    const punto = {
      sesionId,
      fecha: sesion.fecha,
      semanaISO: sesion.semanaISO,
      inicio: horas[0],
      fin: horas.at(-1),
      unidad,
      peso: null,
      e1rm: null,
      mejor: null,
      valor: null,
    };
    if (unidad !== 'corporal') {
      const peso = mayor(mismas.map((x) => x.peso));
      punto.peso = peso === -Infinity ? null : peso;
      if (tipoMedida === 'reps') {
        for (const x of mismas) {
          const estimado = e1rm(x.peso, x.valor);
          if (estimado !== null && (punto.e1rm === null || estimado > punto.e1rm)) {
            punto.e1rm = estimado;
            punto.mejor = { peso: x.peso, reps: x.valor };
          }
        }
      }
    }
    const valor = mayor(mismas.map((x) => x.valor));
    punto.valor = valor === -Infinity ? null : valor;
    puntos.push(punto);
  }
  return puntos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio));
}

/**
 * Récords en la unidad de la sesión más reciente. Con peso: peso máximo y
 * 1RM estimado máximo. Sin peso: la mejor serie. Si hay empate, el récord es
 * de la primera vez que se alcanzó.
 */
export function records(puntos) {
  if (!puntos.length) return null;
  const unidad = puntos.at(-1).unidad;
  const mismos = puntos.filter((p) => p.unidad === unidad);
  const maximo = (campo) => mismos.reduce((a, p) => (esNumero(p[campo]) && (a === null || p[campo] > a[campo]) ? p : a), null);
  const peso = maximo('peso');
  const estimado = maximo('e1rm');
  const valor = maximo('valor');
  return {
    unidad,
    peso: unidad !== 'corporal' && peso ? { valor: peso.peso, fecha: peso.fecha } : null,
    e1rm: estimado ? { valor: estimado.e1rm, fecha: estimado.fecha, peso: estimado.mejor.peso, reps: estimado.mejor.reps } : null,
    valor: unidad === 'corporal' && valor ? { valor: valor.valor, fecha: valor.fecha } : null,
    omitidas: puntos.length - mismos.length,
  };
}

/**
 * ¿La serie recién guardada es récord? Solo cuenta si ya había series de ese
 * ejercicio, con la misma unidad, en OTRA sesión: la primera vez todo sería récord.
 * @param {{previas:object[], nuevas:object[], tipoMedida:string}} p
 *   previas: registros ya guardados de la clave (sin los que esta captura reemplaza)
 *   nuevas: los registros de esta captura (uno, o dos si fue por lado)
 * @returns {{tipo:'peso'|'e1rm'|'valor', valor:number, unidad:string, peso?:number, reps?:number}|null}
 */
export function recordNuevo({ previas, nuevas, tipoMedida }) {
  const [nueva] = seriesLogicas(nuevas, tipoMedida);
  if (!nueva) return null;
  const antes = seriesLogicas(previas, tipoMedida).filter((x) => x.unidadPeso === nueva.unidadPeso);
  if (!antes.some((x) => x.sesionId !== nueva.sesionId)) return null;
  if (nueva.unidadPeso === 'corporal') {
    return esNumero(nueva.valor) && nueva.valor > mayor(antes.map((x) => x.valor))
      ? { tipo: 'valor', valor: nueva.valor, unidad: 'corporal' }
      : null;
  }
  if (esNumero(nueva.peso) && nueva.peso > mayor(antes.map((x) => x.peso))) {
    return { tipo: 'peso', valor: nueva.peso, unidad: nueva.unidadPeso };
  }
  if (tipoMedida === 'reps') {
    const estimado = e1rm(nueva.peso, nueva.valor);
    if (estimado !== null && estimado > mayor(antes.map((x) => e1rm(x.peso, x.valor)))) {
      return { tipo: 'e1rm', valor: estimado, unidad: nueva.unidadPeso, peso: nueva.peso, reps: nueva.valor };
    }
  }
  return null;
}

/** Los puntos de cada clave (una sola pasada sobre todas las series). */
export function puntosPorClave({ rutina, sesiones, series }) {
  const filaPorId = new Map(rutina.map((r) => [r.id, r]));
  const deClave = Map.groupBy(series.filter((s) => filaPorId.has(s.rutinaId)), (s) => filaPorId.get(s.rutinaId).clave);
  const resultado = new Map();
  for (const [clave, lista] of deClave) {
    const tipoMedida = filaPorId.get(lista[0].rutinaId).tipoMedida;
    resultado.set(clave, puntosDeEjercicio({ series: lista, sesiones, tipoMedida }));
  }
  return resultado;
}

/**
 * Qué subió en `semana` contra la última sesión anterior a esa semana:
 * con peso, el peso de trabajo; sin peso, la mejor serie. Solo días de fuerza.
 */
export function queSubio({ semana, rutina, puntos }) {
  const lista = [];
  const vistas = new Set();
  for (const r of rutina.filter((x) => x.diaSemana <= 5).sort(porDiaYOrden)) {
    if (vistas.has(r.clave)) continue;
    vistas.add(r.clave);
    const deClave = puntos.get(r.clave) ?? [];
    const previo = deClave.filter((p) => p.semanaISO < semana).at(-1);
    const deSemana = deClave.filter((p) => p.semanaISO === semana && p.unidad === previo?.unidad);
    if (!previo || !deSemana.length) continue;
    const campo = previo.unidad === 'corporal' ? 'valor' : 'peso';
    const ahora = mayor(deSemana.map((p) => p[campo]));
    if (!esNumero(previo[campo]) || !(ahora > previo[campo])) continue;
    lista.push({
      clave: r.clave,
      ejercicio: r.ejercicio,
      tipo: campo,
      antes: previo[campo],
      ahora,
      unidad: previo.unidad,
      pesoPorLado: r.pesoPorLado,
      tipoMedida: r.tipoMedida,
    });
  }
  return lista;
}

/** Resumen de una semana: días de fuerza, caminatas, series y qué subió (contra lo planeado). */
export function resumenSemana({ semana, rutina, sesiones, series, puntos }) {
  const fuerza = rutina.filter((r) => r.diaSemana <= 5);
  const diasFuerza = new Set(fuerza.map((r) => r.diaSemana));
  const diasCaminata = new Set(rutina.filter((r) => r.diaSemana > 5).map((r) => r.diaSemana));
  const completas = sesiones.filter((s) => s.semanaISO === semana && s.estado === 'completa');
  const idsFuerza = new Set(fuerza.map((r) => r.id));
  const hechas = new Set(
    series.filter((s) => s.semanaISO === semana && s.completada && idsFuerza.has(s.rutinaId)).map((s) => `${s.rutinaId}:${s.numeroSerie}`),
  );
  const diasHechos = (dias) => new Set(completas.filter((s) => dias.has(s.diaSemanaPlan)).map((s) => s.diaSemanaPlan)).size;
  return {
    semana,
    dias: { hechos: diasHechos(diasFuerza), plan: diasFuerza.size },
    caminatas: { hechas: diasHechos(diasCaminata), plan: diasCaminata.size },
    series: { hechas: hechas.size, plan: fuerza.reduce((suma, r) => suma + r.series, 0) },
    subio: queSubio({ semana, rutina, puntos }),
  };
}

/** Hasta `cuantas` semanas ISO que terminan en `actual`, sin ir antes de `inicio`; de la más vieja a la actual. */
export function ultimasSemanas(inicio, actual, cuantas) {
  if (!inicio || inicio > actual) return [];
  const n = Math.min(semanasEntre(inicio, actual), cuantas - 1);
  const lunes = lunesDeSemana(actual);
  return Array.from({ length: n + 1 }, (_, i) => semanaISO(sumarDias(lunes, -7 * (n - i))));
}

// Estado de la semana en curso (dias.js) → estado en la constancia.
const EN_CURSO = { vencido: 'pendiente', hoy: 'hoy', pendiente: 'por_venir', no_cabe: 'no_hecho' };

/**
 * Constancia: cada semana con sus cinco días de fuerza.
 * Estados: hecho, recorrido, saltado, no_hecho, en_curso (sin terminar), y en
 * la semana actual también pendiente, hoy y por_venir. «antes» son los días
 * de la primera semana previos a tu primera sesión: no cuentan.
 * El porcentaje se calcula solo con semanas cerradas (la actual va aparte).
 * @param {{semanas:string[], sesiones:object[], decisiones:Record<string, object>, hoy:{semana:string, dia:number}}} p
 */
export function constancia({ semanas, sesiones, decisiones, hoy }) {
  const fuerza = sesiones.filter((s) => s.diaSemanaPlan <= 5);
  const primera = fuerza.map((s) => s.fecha).sort()[0] ?? null;
  const filas = semanas.map((semana) => {
    const deSemana = fuerza.filter((s) => s.semanaISO === semana);
    const tomadas = decisiones[semana] ?? DECISIONES_VACIAS;
    const actual = semana === hoy.semana;
    const plan = actual ? planSemana({ hoy: hoy.dia, sesiones: deSemana, decisiones: tomadas }) : null;
    const dias = DIAS_FUERZA.map((dia) => {
      const propias = deSemana.filter((s) => s.diaSemanaPlan === dia);
      const completa = propias.find((s) => s.estado === 'completa');
      let estado;
      if (completa) estado = completa.recorrido ? 'recorrido' : 'hecho';
      else if (propias.some((s) => s.estado === 'en_curso')) estado = 'en_curso';
      else if (tomadas.saltados.includes(dia)) estado = 'saltado';
      else if (primera && aTexto(fechaDeDia(semana, dia)) < primera) estado = 'antes';
      else if (actual) estado = EN_CURSO[plan.dias[dia - 1].estado] ?? 'no_hecho';
      else estado = 'no_hecho';
      return { dia, estado };
    });
    return {
      semana,
      lunes: aTexto(lunesDeSemana(semana)),
      actual,
      dias,
      hechos: dias.filter((d) => d.estado === 'hecho' || d.estado === 'recorrido').length,
      cuentan: dias.filter((d) => d.estado !== 'antes').length,
    };
  });
  const cerradas = filas.filter((f) => !f.actual);
  return {
    filas,
    cerradas: {
      semanas: cerradas.length,
      hechos: cerradas.reduce((suma, f) => suma + f.hechos, 0),
      posibles: cerradas.reduce((suma, f) => suma + f.cuentan, 0),
    },
  };
}

/** Series hechas por grupo muscular (los de tu hoja) en dos semanas, contra lo planeado. */
export function seriesPorGrupo({ rutina, series, actual, anterior }) {
  const grupos = new Map();
  for (const r of rutina.filter((x) => x.diaSemana <= 5).sort(porDiaYOrden)) {
    const g = grupos.get(r.grupo) ?? { grupo: r.grupo, plan: 0, ids: new Set() };
    g.plan += r.series;
    g.ids.add(r.id);
    grupos.set(r.grupo, g);
  }
  const hechasEn = (semana) => series.filter((s) => s.semanaISO === semana && s.completada);
  const deActual = hechasEn(actual);
  const deAnterior = hechasEn(anterior);
  const contar = (lista, ids) => new Set(lista.filter((s) => ids.has(s.rutinaId)).map((s) => `${s.rutinaId}:${s.numeroSerie}`)).size;
  return [...grupos.values()].map((g) => ({ grupo: g.grupo, plan: g.plan, actual: contar(deActual, g.ids), anterior: contar(deAnterior, g.ids) }));
}

/** Un renglón por ejercicio (clave) con historial, en el orden de la rutina. */
export function ejerciciosConHistorial({ rutina, puntos }) {
  const lista = [];
  const vistas = new Set();
  for (const r of [...rutina].sort(porDiaYOrden)) {
    if (vistas.has(r.clave)) continue;
    vistas.add(r.clave);
    const deClave = puntos.get(r.clave) ?? [];
    if (!deClave.length) continue;
    lista.push({
      clave: r.clave,
      nombre: r.ejercicio,
      dia: r.dia,
      sesiones: deClave.length,
      ultima: deClave.at(-1).fin,
      conRegla: (r.progresionRegla?.tipo ?? 'manual') !== 'manual',
    });
  }
  return lista;
}

/** El ejercicio que se muestra al abrir: el último que entrenaste con regla de progresión (si no hay, el último). */
export function ejercicioPorDefecto(lista) {
  const reciente = (candidatos) => candidatos.reduce((a, b) => (a === null || b.ultima > a.ultima ? b : a), null);
  return (reciente(lista.filter((e) => e.conRegla)) ?? reciente(lista))?.clave ?? null;
}

/** A qué punto va cada aviso aceptado: a la última sesión que empezó antes de aceptarlo. */
export function marcasDeAvisos(puntos, avisos) {
  const marcas = new Map();
  for (const aviso of avisos) {
    const indice = puntos.findLastIndex((p) => p.inicio <= aviso.hora);
    if (indice < 0) continue;
    marcas.set(indice, [...(marcas.get(indice) ?? []), aviso]);
  }
  return marcas;
}
