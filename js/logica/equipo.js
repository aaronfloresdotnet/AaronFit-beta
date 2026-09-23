// Lógica pura: tu equipo y la calculadora de discos (tanda 3).
//
// Dos inventarios que NO se mezclan (Aarón, 2026-09-23):
// - kg, discos olímpicos de 2 pulgadas: barra olímpica y polea;
// - lb, discos de 1 pulgada: solo las mancuernas.
// Cuatro formas de cargar:
// - barra: el peso INCLUYE la barra; lo demás se reparte igual por lado;
// - landmine ('+ barra' en la hoja): el peso son solo los discos, en una punta;
// - polea: igual de cada lado del carro, porque si no se desbalancea (Aarón,
//   2026-09-23); con un par de cada disco, la polea sube de 5 en 5 kg;
// - mancuernas: peso del mango + discos iguales en los dos extremos; en
//   ejercicios «c/u» se arman dos mancuernas a la vez con el mismo inventario.
// Cuando un peso no sale exacto con los discos, se dice y se dan los más cercanos.

/** Tu equipo tal como lo describiste (2026-09-23). Se puede cambiar en la app. */
export const EQUIPO_INICIAL = Object.freeze({
  barra: 20,
  polea: 0, // peso propio del carro de la polea: «no cuenta» (Aarón)
  discosKg: Object.freeze([
    { peso: 20, cuantos: 2 },
    { peso: 15, cuantos: 2 },
    { peso: 10, cuantos: 2 },
    { peso: 5, cuantos: 2 },
    { peso: 2.5, cuantos: 2 },
  ]),
  maneral: 0, // peso del mango de cada mancuerna, en lb: es de aluminio, «no cuenta» (Aarón)
  topeMancuerna: 50,
  discosLb: Object.freeze([
    { peso: 15, cuantos: 4 },
    { peso: 10, cuantos: 6 },
    { peso: 5, cuantos: 4 },
  ]),
  texto: [
    'Estación de polea: poste anclado a la pared, roldana arriba y anclaje abajo; cambiar la altura es fácil. Se carga con los discos olímpicos de kg, igual de cada lado (si no, se desbalancea); a sus brazos les caben 4 o 5 discos por lado. El carro no cuenta en el peso.',
    'Accesorios de polea: cuerda de tríceps, un mango en D, barra corta recta, barra larga de jalón, tobillera con argollas en D y dos mosquetones.',
    'Barra olímpica de 20 kg con almohadilla.',
    'Discos olímpicos de 2 pulgadas, en kg, un par de cada uno: 2.5, 5, 10, 15 y 20 (105 kg en total). Van en la barra y en la polea.',
    'Mancuernas ajustables de 1 pulgada con mango de aluminio (no cuenta en el peso), tope real de 50 lb cada una. Sus discos son en lb: 4 de 15, 6 de 10 y 4 de 5, iguales en los dos extremos. No se mezclan con los de kg.',
    'Banco ajustable: respaldo y asiento reclinables; los rodillos de los pies son fijos.',
    'Dos postes en J independientes.',
    'Barra de dominadas fija en la pared, arriba de la polea.',
    'Bandas: morada, roja, negra (25 a 65 lb) y amarilla.',
    'Otros: costal de boxeo, cuerda de saltar, rueda abdominal y piso de tatami.',
  ].join('\n'),
});

// El texto inicial de la tanda 3, tal cual. Si lo guardaste sin tocarlo, se
// cambia por el de ahora (mango y carro que no cuentan, polea pareja); si lo
// editaste, se queda el tuyo.
export const TEXTOS_ANTERIORES = Object.freeze([
  [
    'Estación de polea: poste anclado a la pared, roldana arriba y anclaje abajo; cambiar la altura es fácil. Se carga con los discos olímpicos de kg; a sus brazos les caben 4 o 5 discos de cada lado.',
    'Accesorios de polea: cuerda de tríceps, un mango en D, barra corta recta, barra larga de jalón, tobillera con argollas en D y dos mosquetones.',
    'Barra olímpica de 20 kg con almohadilla.',
    'Discos olímpicos de 2 pulgadas, en kg, un par de cada uno: 2.5, 5, 10, 15 y 20 (105 kg en total). Van en la barra y en la polea.',
    'Mancuernas ajustables de 1 pulgada, tope real de 50 lb cada una. Sus discos son en lb: 4 de 15, 6 de 10 y 4 de 5. No se mezclan con los de kg.',
    'Banco ajustable: respaldo y asiento reclinables; los rodillos de los pies son fijos.',
    'Dos postes en J independientes.',
    'Barra de dominadas fija en la pared, arriba de la polea.',
    'Bandas: morada, roja, negra (25 a 65 lb) y amarilla.',
    'Otros: costal de boxeo, cuerda de saltar, rueda abdominal y piso de tatami.',
  ].join('\n'),
]);

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Tu equipo guardado, completado con lo inicial en lo que falte. Un mango
 * guardado como «falta saberlo» (null, tanda 3) toma el inicial: 0.
 */
export function normalizarEquipo(guardado) {
  const e = { ...EQUIPO_INICIAL, ...(guardado ?? {}) };
  const discos = (lista) => (Array.isArray(lista) ? lista : [])
    .filter((d) => esNumero(d?.peso) && d.peso > 0 && Number.isInteger(d?.cuantos) && d.cuantos >= 0)
    .map((d) => ({ peso: d.peso, cuantos: d.cuantos }))
    .sort((a, b) => b.peso - a.peso);
  return {
    barra: esNumero(e.barra) && e.barra >= 0 ? e.barra : EQUIPO_INICIAL.barra,
    polea: esNumero(e.polea) && e.polea >= 0 ? e.polea : 0,
    discosKg: discos(e.discosKg),
    maneral: esNumero(e.maneral) && e.maneral >= 0 ? e.maneral : EQUIPO_INICIAL.maneral,
    topeMancuerna: esNumero(e.topeMancuerna) && e.topeMancuerna > 0 ? e.topeMancuerna : null,
    discosLb: discos(e.discosLb),
    texto: typeof e.texto === 'string' && !TEXTOS_ANTERIORES.includes(e.texto) ? e.texto : EQUIPO_INICIAL.texto,
  };
}

/**
 * Con qué se carga un renglón de la rutina: 'barra', 'landmine', 'polea',
 * 'mancuernas' (dos, «c/u»), 'mancuerna' (una) o null (sin peso o sin calculadora).
 */
export function implementoDe(ejercicio) {
  if (!ejercicio || ejercicio.unidadPeso === 'corporal') return null;
  const equipo = ejercicio.equipo ?? '';
  if (ejercicio.pesoNota === '+ barra' || /^barra en esquina/i.test(equipo)) return 'landmine';
  if (/polea/i.test(equipo)) return 'polea';
  if (/^barra\b/i.test(equipo) && !/dominadas/i.test(equipo)) return 'barra';
  if (/mancuerna/i.test(equipo)) return ejercicio.pesoPorLado ? 'mancuernas' : 'mancuerna';
  return null;
}

/** La unidad que corresponde a cada implemento (los inventarios no se mezclan). */
export const UNIDAD_DE = Object.freeze({ barra: 'kg', landmine: 'kg', polea: 'kg', mancuernas: 'lb', mancuerna: 'lb' });

// En centésimas, para no arrastrar errores de punto flotante (2.5, 1.25…).
const cent = (n) => Math.round(n * 100);

/** ¿`a` es mejor que `b`? Menos discos; a igual número, los más grandes primero. */
function mejor(a, b) {
  if (a.length !== b.length) return a.length < b.length;
  const i = a.findIndex((disco, k) => disco !== b[k]);
  return i >= 0 && a[i] > b[i];
}

/**
 * Todas las sumas que se pueden armar con `disponibles` (conteo por tamaño),
 * cada una con su mejor combinación.
 * @returns {Map<number, number[]>} suma en centésimas → discos, de mayor a menor
 */
function sumasPosibles(disponibles) {
  let sumas = new Map([[0, []]]);
  for (const { peso, cuantos } of [...disponibles].sort((a, b) => b.peso - a.peso)) {
    const siguientes = new Map(sumas);
    for (const [suma, discos] of sumas) {
      for (let k = 1; k <= cuantos; k++) {
        const nueva = suma + k * cent(peso);
        const combinacion = [...discos, ...Array(k).fill(peso)];
        const previa = siguientes.get(nueva);
        if (!previa || mejor(combinacion, previa)) siguientes.set(nueva, combinacion);
      }
    }
    sumas = siguientes;
  }
  return sumas;
}

/**
 * Busca `objetivo` con los discos que le tocan a UNA de `grupos` partes que
 * comparten el inventario (2 lados de la barra; 4 extremos si son dos mancuernas):
 * cada parte puede usar floor(cuantos / grupos) de cada disco.
 */
function repartir(objetivo, disponibles, grupos) {
  const porGrupo = disponibles.map((d) => ({ peso: d.peso, cuantos: Math.floor(d.cuantos / grupos) })).filter((d) => d.cuantos > 0);
  const sumas = sumasPosibles(porGrupo);
  const buscado = cent(objetivo);
  if (sumas.has(buscado)) return { exacto: true, discos: sumas.get(buscado) };
  const valores = [...sumas.keys()].sort((a, b) => a - b);
  const abajo = valores.filter((v) => v < buscado).at(-1);
  const arriba = valores.find((v) => v > buscado);
  return { exacto: false, abajo: abajo === undefined ? null : abajo / 100, arriba: arriba === undefined ? null : arriba / 100 };
}

/**
 * Qué discos poner para `peso` con `implemento`.
 * @returns {{implemento:string, peso:number, estado:'exacto'|'aproximado'|'imposible',
 *            discos?:number[], cercanos?:number[], minimo?:number, sobreTope?:boolean}}
 *   discos: por lado (barra y polea), por extremo (mancuernas) o en la punta (landmine).
 *   cercanos: los pesos que sí salen, abajo y arriba; «nada» (0) no se ofrece.
 */
export function cargar({ implemento, peso, equipo }) {
  const base = { implemento, peso };
  if (!esNumero(peso)) return { ...base, estado: 'imposible' };
  const e = equipo;
  // minimo: lo que ya pesa sin discos (barra, carro de la polea o mango).
  // partes: en cuántas partes iguales se reparten los discos de UNA carga
  //   (2 lados de la barra y de la polea, 2 extremos de la mancuerna; 1 en landmine).
  // grupos: cuántas partes comparten el inventario (4 extremos con dos mancuernas).
  const armar = (minimo, partes, grupos, disponibles) => {
    if (peso < minimo) return { ...base, estado: 'imposible', minimo };
    const r = repartir((peso - minimo) / partes, disponibles, grupos);
    if (r.exacto) return { ...base, estado: 'exacto', discos: r.discos };
    const cercanos = [r.abajo, r.arriba]
      .filter((v) => v !== null)
      .map((v) => Math.round((minimo + v * partes) * 100) / 100)
      .filter((v) => v > 0);
    return { ...base, estado: 'aproximado', cercanos };
  };
  if (implemento === 'barra') return armar(e.barra, 2, 2, e.discosKg);
  if (implemento === 'landmine') return armar(0, 1, 1, e.discosKg);
  if (implemento === 'polea') return armar(e.polea, 2, 2, e.discosKg);
  if (implemento === 'mancuernas' || implemento === 'mancuerna') {
    const resultado = armar(e.maneral, 2, implemento === 'mancuernas' ? 4 : 2, e.discosLb);
    return { ...resultado, sobreTope: e.topeMancuerna !== null && peso > e.topeMancuerna };
  }
  return { ...base, estado: 'imposible' };
}

/** El salto más chico que se puede cargar con cada implemento (el paso del botón +). */
export function pasoDe(implemento, equipo) {
  const menor = (discos, minimo) => {
    const aptos = discos.filter((d) => d.cuantos >= minimo).map((d) => d.peso);
    return aptos.length ? Math.min(...aptos) : null;
  };
  let paso = null;
  if (implemento === 'barra' || implemento === 'polea') paso = menor(equipo.discosKg, 2) * 2;
  else if (implemento === 'landmine') paso = menor(equipo.discosKg, 1);
  else if (implemento === 'mancuernas') paso = menor(equipo.discosLb, 4) * 2;
  else if (implemento === 'mancuerna') paso = menor(equipo.discosLb, 2) * 2;
  return esNumero(paso) && paso > 0 ? paso : null;
}

/**
 * Calentamiento sugerido para un ejercicio con barra: barra sola × 10, ~50 % × 5
 * y ~75 % × 3, cada uno redondeado hacia abajo a un peso que sí se puede cargar.
 * Solo se muestra; no se anota. Si la serie de trabajo es la barra sola, no hay.
 * @returns {Array<{peso:number, reps:number, discos:number[]}>}
 */
export function calentamiento({ peso, equipo }) {
  if (!esNumero(peso) || peso <= equipo.barra) return [];
  const porLado = sumasPosibles(equipo.discosKg.map((d) => ({ peso: d.peso, cuantos: Math.floor(d.cuantos / 2) })).filter((d) => d.cuantos > 0));
  const totales = [...porLado.keys()].map((s) => cent(equipo.barra) + 2 * s).sort((a, b) => a - b);
  const hastaDe = (objetivo) => totales.filter((t) => t <= cent(objetivo)).at(-1) ?? null;
  const series = [{ peso: equipo.barra, reps: 10 }];
  for (const [fraccion, reps] of [[0.5, 5], [0.75, 3]]) {
    const total = hastaDe(peso * fraccion);
    if (total !== null && total / 100 > series.at(-1).peso && total / 100 < peso) series.push({ peso: total / 100, reps });
  }
  return series.map((s) => ({ ...s, discos: cargar({ implemento: 'barra', peso: s.peso, equipo }).discos ?? [] }));
}
