// Lógica pura: qué peso y qué valor (reps, segundos o metros) aparecen
// precargados en cada serie. El usuario solo corrige lo que cambió.
//
// Peso de la serie k:
//   1. Si hoy ya completaste una serie de este ejercicio: el peso de la última
//      (si subiste el peso en la serie 1, la 2 ya sale con el peso nuevo).
//   2. Si aceptaste un aviso de progresión después de tu última sesión: el peso nuevo.
//   3. Si hay historial: el peso de la serie k de la vez anterior
//      (o el de su última serie, si aquella vez hiciste menos).
//   4. Sin historial: el peso sugerido de la semilla.
// Valor de la serie k:
//   1. Si aceptaste un aviso después de tu última sesión: el tiempo nuevo, o
//      repsMin (con peso o implemento nuevo se empieza abajo del rango).
//   2. Si hay historial: el valor de la serie k de la vez anterior (o de su última serie).
//   3. Sin historial: repsMin de la semilla.

/** El valor que cuenta de una serie según cómo se mide el ejercicio. */
export function valorDeSerie(serie, tipoMedida) {
  if (tipoMedida === 'reps') return serie.repsHechas ?? null;
  if (tipoMedida === 'metros') return serie.metros ?? null;
  return serie.segundos ?? null; // segundos y minutos se guardan en segundos
}

/** repsMin en la unidad de guardado (los minutos se guardan como segundos). */
export const valorInicial = (ejercicio) =>
  ejercicio.tipoMedida === 'minutos' ? ejercicio.repsMin * 60 : ejercicio.repsMin;

const menor = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b));

/**
 * Series completadas agrupadas por número de serie. Si una serie se capturó
 * por lado (izquierda y derecha), cuenta el peor lado.
 * @returns {Map<number, {numeroSerie:number, peso:number|null, unidadPeso:string, valor:number|null, hora:string}>}
 */
export function porNumero(series, tipoMedida) {
  const mapa = new Map();
  for (const s of series) {
    if (!s.completada) continue;
    const valor = valorDeSerie(s, tipoMedida);
    const previa = mapa.get(s.numeroSerie);
    if (!previa) {
      mapa.set(s.numeroSerie, { numeroSerie: s.numeroSerie, peso: s.peso, unidadPeso: s.unidadPeso, valor, hora: s.hora });
    } else {
      previa.valor = menor(previa.valor, valor);
      if (s.hora > previa.hora) previa.hora = s.hora;
    }
  }
  return mapa;
}

const masReciente = (lista) => lista.reduce((a, b) => (b.hora > a.hora ? b : a));

/** Las series completadas de la sesión más reciente del historial. */
export function seriesDeUltimaSesion(historial) {
  const completadas = historial.filter((s) => s.completada);
  if (!completadas.length) return [];
  const { sesionId } = masReciente(completadas);
  return completadas.filter((s) => s.sesionId === sesionId);
}

/**
 * @param {object} p
 * @param {object} p.ejercicio  renglón de rutina
 * @param {Array<object>} [p.historial]  series de sesiones ANTERIORES de este ejercicio
 * @param {Array<object>} [p.hoy]  series ya guardadas hoy de este ejercicio
 * @param {object|null} [p.referencia]  último aviso aceptado: { hora, peso?, unidadPeso?, pesoPorLado?, valor? }
 * @returns {Array<{numeroSerie:number, peso:number|null, unidadPeso:string, pesoPorLado:boolean, valor:number|null}>}
 */
export function precargar({ ejercicio, historial = [], hoy = [], referencia = null }) {
  const completadasHoy = hoy.filter((s) => s.completada);
  const ultimaDeHoy = completadasHoy.length ? masReciente(completadasHoy) : null;

  const anterior = porNumero(seriesDeUltimaSesion(historial), ejercicio.tipoMedida);
  const ultimaAnterior = anterior.size ? anterior.get(Math.max(...anterior.keys())) : null;

  const horasHistorial = historial.filter((s) => s.completada).map((s) => s.hora);
  const ultimaHora = horasHistorial.length ? horasHistorial.reduce((a, b) => (b > a ? b : a)) : null;
  // El aviso se acepta al cerrar la última serie: puede llevar la misma hora que ella.
  const aviso = referencia && (!ultimaHora || referencia.hora >= ultimaHora) ? referencia : null;

  const pesoPorLado = aviso && 'pesoPorLado' in aviso ? aviso.pesoPorLado : ejercicio.pesoPorLado;

  const lista = [];
  for (let k = 1; k <= ejercicio.series; k++) {
    const previa = anterior.get(k) ?? ultimaAnterior;

    let peso = ejercicio.pesoSugerido;
    let unidadPeso = ejercicio.unidadPeso;
    if (ultimaDeHoy) ({ peso, unidadPeso } = ultimaDeHoy);
    else if (aviso && 'peso' in aviso) ({ peso, unidadPeso } = aviso);
    else if (previa) ({ peso, unidadPeso } = previa);

    let valor = valorInicial(ejercicio);
    if (aviso) valor = aviso.valor ?? valorInicial(ejercicio);
    else if (previa) valor = previa.valor;

    lista.push({ numeroSerie: k, peso, unidadPeso, pesoPorLado, valor });
  }
  return lista;
}
