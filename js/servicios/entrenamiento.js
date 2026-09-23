// Capa de aplicación: casos de uso del entrenamiento.
// Orquesta los repositorios (datos) y las reglas (lógica pura). No toca el DOM.
// Recibe sus dependencias al crearse, para poder probarlo sin IndexedDB.

import { estancamiento, puntosDeEjercicio, recordNuevo } from '../logica/avance.js';
import { DECISIONES_VACIAS, planSemana, recorrer, saltar } from '../logica/dias.js';
import { calentamiento, implementoDe, normalizarEquipo } from '../logica/equipo.js';
import { frasesDeAvance, mezclarFrases } from '../logica/frases.js';
import { evaluarProgresion, referenciaDeAceptar } from '../logica/progresion.js';
import { porNumero, precargar, seriesDeUltimaSesion } from '../logica/referencia.js';
import { aTexto, diaSemana, fechaLocal, semanaAnterior, semanaISO, semanasEntre } from '../logica/semana.js';

const CAMPO_VALOR = { reps: 'repsHechas', segundos: 'segundos', minutos: 'segundos', metros: 'metros' };
const porOrden = (a, b) => a.orden - b.orden;

/** Series planeadas ya registradas (hechas o saltadas) de un ejercicio en una sesión. */
export function avance(ejercicio, seriesSesion) {
  const propias = seriesSesion.filter((s) => s.rutinaId === ejercicio.id);
  let hechas = 0;
  let saltadas = 0;
  for (let k = 1; k <= ejercicio.series; k++) {
    const deK = propias.filter((s) => s.numeroSerie === k);
    if (!deK.length) continue;
    if (deK.some((s) => s.completada)) hechas++;
    else saltadas++;
  }
  return { hechas, saltadas, total: ejercicio.series, terminado: hechas + saltadas >= ejercicio.series };
}

/**
 * @param {object} p
 * @param {object} p.repos
 * @param {() => Date} [p.reloj]
 * @param {(error:unknown, donde:string) => void} [p.alFallar]  dónde anotar un fallo que no debe detener nada (el récord)
 */
export function crearServicioEntrenamiento({ repos, reloj = () => new Date(), alFallar = (error) => console.error(error) }) {
  let rutinaEnMemoria = null;

  async function rutina() {
    rutinaEnMemoria ??= await repos.rutina.todas();
    return rutinaEnMemoria;
  }

  function ahora() {
    const instante = reloj();
    const fecha = fechaLocal(instante);
    return { hora: instante.toISOString(), fecha: aTexto(fecha), semana: semanaISO(fecha), dia: diaSemana(fecha) };
  }

  const ejerciciosDelDia = async (dia) => (await rutina()).filter((r) => r.diaSemana === dia).sort(porOrden);
  const nombreDelDia = async (dia) => (await rutina()).find((r) => r.diaSemana === dia)?.dia ?? '';
  const decisionesDe = async (semana) => (await repos.estado.leer(`semana:${semana}`)) ?? DECISIONES_VACIAS;
  const idsDeClave = async (clave) => (await rutina()).filter((r) => r.clave === clave).map((r) => r.id);

  async function semanaDelPrograma(semana) {
    const inicio = await repos.estado.leer('inicioPrograma');
    return inicio ? semanasEntre(inicio, semana) + 1 : 1;
  }

  async function resumenDeSesion(sesion) {
    const [ejercicios, series] = await Promise.all([ejerciciosDelDia(sesion.diaSemanaPlan), repos.series.deSesion(sesion.id)]);
    let hechas = 0;
    let total = 0;
    for (const ejercicio of ejercicios) {
      const a = avance(ejercicio, series);
      hechas += a.hechas;
      total += a.total;
    }
    const { id, diaRutina, diaSemanaPlan, fecha, estado, recorrido, inicio, fin } = sesion;
    return { id, diaRutina, diaSemanaPlan, fecha, estado, recorrido, inicio, fin, hechas, total };
  }

  async function conNombre(dia) {
    if (!dia) return null;
    const ejercicios = await ejerciciosDelDia(dia);
    return { dia, nombre: await nombreDelDia(dia), ejercicios: ejercicios.length, primero: ejercicios[0]?.ejercicio ?? '' };
  }

  /** Todo lo que muestra la pantalla de inicio. */
  async function resumenInicio() {
    const t = ahora();
    const [sesiones, decisiones, abiertas, medidasSemana] = await Promise.all([
      repos.sesiones.deSemana(t.semana),
      decisionesDe(t.semana),
      repos.sesiones.enCurso(),
      repos.medidas.deSemana(t.semana),
    ]);
    const plan = planSemana({ hoy: t.dia, sesiones, decisiones });
    const completa = (dia) => sesiones.some((s) => s.diaSemanaPlan === dia && s.estado === 'completa');

    const dias = [];
    for (const d of plan.dias) dias.push({ ...d, nombre: await nombreDelDia(d.dia) });
    for (const dia of [6, 7]) {
      const estado = completa(dia) ? 'hecho' : dia === t.dia ? 'hoy' : dia < t.dia ? 'no_hecho' : 'pendiente';
      dias.push({ dia, programado: dia, estado, nombre: await nombreDelDia(dia) });
    }

    const hechasHoy = [];
    for (const s of sesiones.filter((x) => x.fecha === t.fecha && x.estado === 'completa')) {
      hechasHoy.push(await resumenDeSesion(s));
    }
    abiertas.sort((a, b) => b.inicio.localeCompare(a.inicio));

    // Si hay un día perdido, qué días ya no cabrían si se recorre (para decidir informado).
    let vencido = null;
    if (plan.vencido) {
      const siRecorre = planSemana({ hoy: t.dia, sesiones, decisiones: recorrer(decisiones, plan.vencido, t.dia) });
      const noCabrian = [];
      for (const d of siRecorre.dias.filter((x) => x.estado === 'no_cabe')) noCabrian.push(await nombreDelDia(d.dia));
      vencido = { ...(await conNombre(plan.vencido)), noCabrian };
    }

    return {
      fecha: t.fecha,
      diaHoy: t.dia,
      semana: t.semana,
      semanaPrograma: await semanaDelPrograma(t.semana),
      dias,
      vencido,
      hoyToca: plan.hoyToca ? { ...(await conNombre(plan.hoyToca)), recorrido: plan.hoyToca !== t.dia } : null,
      caminata: plan.caminata && !completa(plan.caminata) ? await conNombre(plan.caminata) : null,
      enCurso: abiertas.length ? await resumenDeSesion(abiertas[0]) : null,
      hechasHoy,
      recordarMedidas: t.dia === 6 && medidasSemana.length === 0,
    };
  }

  /** Saltar o recorrer el día vencido. La decisión la toma el usuario. */
  async function decidirDiaVencido(dia, accion) {
    const t = ahora();
    const actuales = await decisionesDe(t.semana);
    const nuevas = accion === 'saltar' ? saltar(actuales, dia) : recorrer(actuales, dia, t.dia);
    await repos.estado.escribir(`semana:${t.semana}`, nuevas);
  }

  /** Abre la sesión del día (o devuelve la que ya está en curso). */
  async function iniciarSesion(dia) {
    const t = ahora();
    const sesiones = await repos.sesiones.deSemana(t.semana);
    const abierta = sesiones.find((s) => s.diaSemanaPlan === dia && s.estado === 'en_curso');
    if (abierta) return abierta.id;
    const id = await repos.sesiones.guardar({
      fecha: t.fecha,
      semanaISO: t.semana,
      diaRutina: await nombreDelDia(dia),
      diaSemanaPlan: dia,
      recorrido: dia !== t.dia,
      estado: 'en_curso',
      inicio: t.hora,
      fin: null,
    });
    // La semana 1 del programa es la de la primera sesión de fuerza.
    if (dia <= 5 && !(await repos.estado.leer('inicioPrograma'))) await repos.estado.escribir('inicioPrograma', t.semana);
    return id;
  }

  async function datosDia(sesionId) {
    const sesion = await repos.sesiones.obtener(sesionId);
    if (!sesion) return null;
    const [ejercicios, series] = await Promise.all([ejerciciosDelDia(sesion.diaSemanaPlan), repos.series.deSesion(sesionId)]);
    const referencias = await Promise.all(ejercicios.map((e) => repos.estado.leer(`referencia:${e.clave}`)));
    const lista = ejercicios.map((ejercicio, i) => ({
      ejercicio,
      ...avance(ejercicio, series),
      subio: Boolean(referencias[i] && referencias[i].hora >= sesion.inicio),
    }));
    return {
      sesion: await resumenDeSesion(sesion),
      ejercicios: lista,
      siguiente: lista.find((x) => !x.terminado)?.ejercicio.id ?? null,
    };
  }

  async function datosEjercicio(sesionId, rutinaId) {
    const [sesion, todas] = await Promise.all([repos.sesiones.obtener(sesionId), rutina()]);
    const ejercicio = todas.find((r) => r.id === rutinaId);
    if (!sesion || !ejercicio || ejercicio.diaSemana !== sesion.diaSemanaPlan) return null;
    const delDia = todas.filter((r) => r.diaSemana === sesion.diaSemanaPlan).sort(porOrden);
    const [seriesClave, referencia, implemento, seriesSesion, nota, equipoGuardado, avisos, sesiones] = await Promise.all([
      repos.series.deRutinas(await idsDeClave(ejercicio.clave)),
      repos.estado.leer(`referencia:${ejercicio.clave}`),
      repos.estado.leer(`implemento:${ejercicio.clave}`),
      repos.series.deSesion(sesionId),
      repos.estado.leer(`nota:${ejercicio.clave}`),
      repos.estado.leer('equipo'),
      repos.estado.leer('avisosAceptados'),
      repos.sesiones.todas(),
    ]);
    const hoy = seriesClave
      .filter((s) => s.sesionId === sesionId && s.rutinaId === rutinaId)
      .sort((a, b) => a.numeroSerie - b.numeroSerie || String(a.lado).localeCompare(String(b.lado)));
    const historial = seriesClave.filter((s) => s.sesionId !== sesionId);
    const ultima = seriesDeUltimaSesion(historial);
    const posicion = delDia.findIndex((r) => r.id === rutinaId);
    const pendiente = (r) => r.id !== rutinaId && !avance(r, seriesSesion).terminado;
    const siguientePendiente = delDia.slice(posicion + 1).find(pendiente) ?? delDia.find(pendiente) ?? null;
    const precarga = precargar({ ejercicio, historial, hoy, referencia: referencia ?? null });

    // Tanda 3: equipo, calentamiento (solo el primer ejercicio con barra del día y
    // antes de su primera serie) y estancamiento (no en ejercicios de regla manual).
    const equipo = normalizarEquipo(equipoGuardado);
    const primeraBarra = delDia.find((r) => implementoDe(r) === 'barra')?.id === rutinaId;
    const conRegla = (ejercicio.progresionRegla?.tipo ?? 'manual') !== 'manual';
    const estado = conRegla
      ? estancamiento(
          puntosDeEjercicio({ series: seriesClave, sesiones, tipoMedida: ejercicio.tipoMedida }),
          (avisos ?? []).filter((a) => a.clave === ejercicio.clave),
        )
      : null;

    return {
      sesion,
      ejercicio,
      hoy,
      precarga,
      equipo,
      implementoCarga: implementoDe(ejercicio),
      calentamiento: primeraBarra && !hoy.length ? calentamiento({ peso: precarga[0]?.peso, equipo }) : [],
      nota: nota ?? null,
      estancado: estado?.estancado ? estado : null,
      anterior: ultima.length
        ? { hora: ultima[0].hora, series: [...porNumero(ultima, ejercicio.tipoMedida).values()].sort((a, b) => a.numeroSerie - b.numeroSerie) }
        : null,
      implemento: implemento ?? null,
      semanaPrograma: await semanaDelPrograma(sesion.semanaISO),
      posicion: posicion + 1,
      total: delDia.length,
      anteriorId: delDia[posicion - 1]?.id ?? null,
      siguienteId: delDia[posicion + 1]?.id ?? null,
      siguientePendiente: siguientePendiente ? { id: siguientePendiente.id, nombre: siguientePendiente.ejercicio } : null,
      terminado: avance(ejercicio, seriesSesion).terminado,
    };
  }

  async function evaluar(sesion, ejercicio, seriesEjercicio) {
    const [referencia, implemento, seriesClave] = await Promise.all([
      repos.estado.leer(`referencia:${ejercicio.clave}`),
      repos.estado.leer(`implemento:${ejercicio.clave}`),
      repos.series.deRutinas(await idsDeClave(ejercicio.clave)),
    ]);
    const previa = semanaAnterior(sesion.semanaISO);
    const { cumplida, propuesta } = evaluarProgresion({
      ejercicio,
      seriesSesion: seriesEjercicio,
      seriesSemanaAnterior: seriesDeUltimaSesion(seriesClave.filter((s) => s.semanaISO === previa)),
      referencia: referencia ?? null,
      implemento: implemento?.texto ?? null,
      semanaISO: sesion.semanaISO,
    });
    return cumplida ? propuesta : null;
  }

  /**
   * Guarda una serie (o corrige una ya guardada: la sobreescribe, decisión 18).
   * Series y sesión van en una sola transacción. El aviso de progresión se
   * evalúa solo cuando esta captura cierra la última serie del ejercicio.
   * @param {{sesionId:number, rutinaId:number, numeroSerie:number, peso:number|null, unidadPeso:string,
   *          valor?:number|null, lados?:{izq:number|null, der:number|null}, rir?:number|null}} captura
   */
  async function guardarSerie(captura) {
    const t = ahora();
    const [sesion, todas] = await Promise.all([repos.sesiones.obtener(captura.sesionId), rutina()]);
    const ejercicio = todas.find((r) => r.id === captura.rutinaId);
    const delDia = todas.filter((r) => r.diaSemana === sesion.diaSemanaPlan);
    const seriesSesion = await repos.series.deSesion(sesion.id);
    const existentes = seriesSesion.filter((s) => s.rutinaId === ejercicio.id && s.numeroSerie === captura.numeroSerie);
    const campo = CAMPO_VALOR[ejercicio.tipoMedida];

    const base = {
      sesionId: sesion.id,
      rutinaId: ejercicio.id,
      semanaISO: sesion.semanaISO,
      numeroSerie: captura.numeroSerie,
      peso: captura.peso ?? null,
      unidadPeso: captura.unidadPeso,
      repsHechas: null,
      segundos: null,
      metros: null,
      rirReportado: captura.rir ?? null,
      lado: null,
      completada: true,
      hora: existentes[0]?.hora ?? t.hora, // corregir no cambia cuándo se hizo
    };
    const nuevas = captura.lados
      ? [{ ...base, lado: 'izq', [campo]: captura.lados.izq }, { ...base, lado: 'der', [campo]: captura.lados.der }]
      : [{ ...base, [campo]: captura.valor ?? null }];
    for (const serie of nuevas) {
      const previa = existentes.find((e) => e.lado === serie.lado);
      if (previa) serie.id = previa.id;
    }
    const borrar = existentes.filter((e) => !nuevas.some((n) => n.id === e.id)).map((e) => e.id);

    const despues = [...seriesSesion.filter((s) => !existentes.includes(s)), ...nuevas];
    const estabaTerminado = avance(ejercicio, seriesSesion).terminado;
    const terminado = avance(ejercicio, despues).terminado;
    const sesionTerminada = delDia.every((r) => avance(r, despues).terminado);
    const cierre = sesionTerminada && sesion.estado === 'en_curso' ? { ...sesion, estado: 'completa', fin: t.hora } : null;

    // ¿Récord? Se revisa ANTES de guardar, contra todo lo anterior de la clave.
    // Corregir una serie nunca avisa, y si esta revisión falla, la serie se guarda igual.
    let record = null;
    if (!existentes.length) {
      try {
        record = recordNuevo({ previas: await repos.series.deRutinas(await idsDeClave(ejercicio.clave)), nuevas, tipoMedida: ejercicio.tipoMedida });
      } catch (error) {
        alFallar(error, 'récord');
      }
    }

    await repos.guardarCaptura({ nuevas, borrar, sesion: cierre });

    const progresion = terminado && !estabaTerminado
      ? await evaluar(sesion, ejercicio, despues.filter((s) => s.rutinaId === ejercicio.id))
      : null;
    return { ejercicioTerminado: terminado, sesionTerminada, progresion, record, descansoSeg: ejercicio.descansoSeg };
  }

  /**
   * "Sí, súbele": guarda la nueva referencia (y el implemento, si cambió), y
   * anota el aviso en la lista de avisos aceptados (las marcas de la gráfica).
   */
  async function aceptarProgresion({ sesionId, rutinaId, propuesta }) {
    const t = ahora();
    const [sesion, todas, avisos] = await Promise.all([repos.sesiones.obtener(sesionId), rutina(), repos.estado.leer('avisosAceptados')]);
    const ejercicio = todas.find((r) => r.id === rutinaId);
    const referencia = referenciaDeAceptar(propuesta, { hora: t.hora, semanaISO: sesion.semanaISO });
    const cambios = [
      [`referencia:${ejercicio.clave}`, referencia],
      ['avisosAceptados', [...(avisos ?? []), { clave: ejercicio.clave, sesionId, ...referencia }]],
    ];
    if (propuesta.implemento) {
      cambios.push([`implemento:${ejercicio.clave}`, { texto: propuesta.implemento, desde: t.fecha, hora: t.hora }]);
    }
    await repos.estado.escribirVarias(cambios);
    return referencia;
  }

  /**
   * Deshace la última serie guardada de la sesión (la de hora más reciente;
   * si se capturó por lado, los dos lados). Si esa serie había cerrado la
   * sesión, la reabre; si después se aceptó un aviso de ese ejercicio, lo quita.
   * Devuelve lo que se deshizo, para volver a mostrarlo en su tarjeta.
   */
  async function deshacerUltimaSerie(sesionId) {
    const [sesion, todas, series] = await Promise.all([repos.sesiones.obtener(sesionId), rutina(), repos.series.deSesion(sesionId)]);
    const completadas = series.filter((s) => s.completada);
    if (!sesion || !completadas.length) return null;
    const ultima = completadas.reduce((a, b) => (b.hora > a.hora ? b : a));
    const deshechas = series.filter((s) => s.rutinaId === ultima.rutinaId && s.numeroSerie === ultima.numeroSerie);
    const ejercicio = todas.find((r) => r.id === ultima.rutinaId);
    const [referencia, implemento, avisos] = await Promise.all([
      repos.estado.leer(`referencia:${ejercicio.clave}`),
      repos.estado.leer(`implemento:${ejercicio.clave}`),
      repos.estado.leer('avisosAceptados'),
    ]);
    const borrarEstado = [];
    if (referencia && referencia.hora >= ultima.hora) borrarEstado.push(`referencia:${ejercicio.clave}`);
    if (implemento?.hora && implemento.hora >= ultima.hora) borrarEstado.push(`implemento:${ejercicio.clave}`);
    const quedan = (avisos ?? []).filter((a) => !(a.clave === ejercicio.clave && a.hora >= ultima.hora));
    const escribirEstado = avisos && quedan.length !== avisos.length ? [['avisosAceptados', quedan]] : [];
    const reabrir = sesion.estado === 'completa' ? { ...sesion, estado: 'en_curso', fin: null } : null;
    await repos.deshacerCaptura({ borrarSeries: deshechas.map((s) => s.id), sesion: reabrir, borrarEstado, escribirEstado });

    const campo = CAMPO_VALOR[ejercicio.tipoMedida];
    const lado = (l) => deshechas.find((s) => s.lado === l)?.[campo] ?? null;
    return {
      rutinaId: ultima.rutinaId,
      numeroSerie: ultima.numeroSerie,
      borrador: {
        peso: ultima.peso,
        unidadPeso: ultima.unidadPeso,
        rir: ultima.rirReportado,
        valor: deshechas.length > 1 ? null : ultima[campo],
        lados: deshechas.length > 1 ? { izq: lado('izq'), der: lado('der') } : null,
      },
    };
  }

  /** Nota de un ejercicio (p. ej. «molestia en rodilla»). Vacía la borra. */
  async function guardarNota(clave, texto) {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (!limpio) {
      await repos.estado.borrar(`nota:${clave}`);
      return null;
    }
    const nota = { texto: limpio, fecha: ahora().fecha };
    await repos.estado.escribir(`nota:${clave}`, nota);
    return nota;
  }

  /** Frases para el descanso: tu avance por ejercicio y tu constancia, mezclados con las listas. */
  async function frasesDescanso(azar) {
    const t = ahora();
    const todas = await rutina();
    const [series, sesiones, sesionesSemana] = await Promise.all([
      repos.series.deRutinas(todas.map((r) => r.id)),
      repos.sesiones.todas(),
      repos.sesiones.deSemana(t.semana),
    ]);
    const avances = [];
    for (const [clave, grupo] of Map.groupBy(todas, (r) => r.clave)) {
      const ids = grupo.map((r) => r.id);
      const conPeso = series
        .filter((s) => s.completada && ids.includes(s.rutinaId) && s.unidadPeso !== 'corporal' && s.peso !== null)
        .sort((a, b) => a.hora.localeCompare(b.hora));
      if (conPeso.length < 2) continue;
      const primera = conPeso[0];
      const ultima = conPeso.at(-1);
      if (primera.unidadPeso !== ultima.unidadPeso) continue;
      avances.push({
        clave,
        ejercicio: grupo[0].ejercicio,
        unidad: ultima.unidadPeso,
        primerPeso: primera.peso,
        ultimoPeso: ultima.peso,
        semanas: semanasEntre(primera.semanaISO, ultima.semanaISO),
      });
    }
    const hechosSemana = new Set(sesionesSemana.filter((s) => s.estado === 'completa' && s.diaSemanaPlan <= 5).map((s) => s.diaSemanaPlan));
    const propias = frasesDeAvance(avances, {
      entrenamientos: sesiones.filter((s) => s.estado === 'completa').length,
      diasSemana: 5,
      diasHechos: hechosSemana.size,
    });
    return mezclarFrases(propias, azar);
  }

  /**
   * Termina la sesión. Las series que falten quedan como saltadas
   * (completada: false). Si no se hizo ninguna, la sesión queda abandonada y
   * el día sigue pendiente.
   */
  async function terminarSesion(sesionId) {
    const t = ahora();
    const sesion = await repos.sesiones.obtener(sesionId);
    if (sesion.estado !== 'en_curso') return resumenDeSesion(sesion);
    const [ejercicios, series] = await Promise.all([ejerciciosDelDia(sesion.diaSemanaPlan), repos.series.deSesion(sesionId)]);
    if (!series.some((s) => s.completada)) {
      await repos.sesiones.guardar({ ...sesion, estado: 'abandonada', fin: t.hora });
    } else {
      const saltadas = [];
      for (const ejercicio of ejercicios) {
        for (let k = 1; k <= ejercicio.series; k++) {
          if (series.some((s) => s.rutinaId === ejercicio.id && s.numeroSerie === k)) continue;
          saltadas.push({
            sesionId, rutinaId: ejercicio.id, semanaISO: sesion.semanaISO, numeroSerie: k,
            peso: null, unidadPeso: ejercicio.unidadPeso, repsHechas: null, segundos: null, metros: null,
            rirReportado: null, lado: null, completada: false, hora: t.hora,
          });
        }
      }
      await repos.guardarCaptura({ nuevas: saltadas, sesion: { ...sesion, estado: 'completa', fin: t.hora } });
    }
    return resumenDeSesion(await repos.sesiones.obtener(sesionId));
  }

  return {
    resumenInicio,
    decidirDiaVencido,
    iniciarSesion,
    datosDia,
    datosEjercicio,
    guardarSerie,
    aceptarProgresion,
    deshacerUltimaSerie,
    guardarNota,
    frasesDescanso,
    terminarSesion,
    /** Tras importar un respaldo la rutina puede cambiar. */
    olvidarRutina: () => {
      rutinaEnMemoria = null;
    },
  };
}
