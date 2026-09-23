// Lógica pura: interpreta los textos de la hoja de rutina.
// La usa herramientas/generar-semilla.js. Si un texto no encaja en ningún
// formato conocido, lanza un error en vez de adivinar.

const NUMERO = String.raw`(\d+(?:\.\d+)?)`;

export function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** 'Farmer's carry' → 'farmers-carry'. */
export function slug(texto) {
  return quitarAcentos(texto)
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** En la hoja, '-' (o vacío) significa "no aplica". */
export function nulo(texto) {
  const limpio = texto.trim();
  return limpio === '-' || limpio === '' ? null : limpio;
}

export function parsearEntero(texto) {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) throw new Error(`Número entero no reconocido: "${texto}"`);
  return Number(limpio);
}

/** RIR: '-' → null; '2' → 2. */
export function parsearRir(texto) {
  return nulo(texto) === null ? null : parsearEntero(texto);
}

const MEDIDAS = { reps: 'reps', s: 'segundos', m: 'metros', min: 'minutos' };

/**
 * '8-10' → reps 8..10; '30 s por pie' → segundos 30, por lado;
 * '40 m' → metros; '2 min' → minutos (en minutos, como viene en la hoja).
 */
export function parsearReps(texto) {
  const m = texto.trim().match(/^(\d+)(?:-(\d+))?(?: (s|m|min))?(?: por (pie|pierna|brazo))?$/);
  if (!m) throw new Error(`Repeticiones no reconocidas: "${texto}"`);
  const repsMin = Number(m[1]);
  return {
    repsMin,
    repsMax: m[2] ? Number(m[2]) : repsMin,
    tipoMedida: MEDIDAS[m[3] ?? 'reps'],
    porLado: Boolean(m[4]),
  };
}

/**
 * '50 kg' → 50 kg; '35 lb cada una' → 35 lb por mancuerna;
 * '20 kg + barra' → 20 kg con nota; 'Barra sola 20 kg' → 20 kg;
 * 'Banda negra 25-65 lb' → sin peso (la banda asiste, no carga), con nota;
 * 'Peso corporal' y '-' → sin peso.
 */
export function parsearPeso(texto) {
  const t = texto.trim();
  const sinPeso = { pesoSugerido: null, unidadPeso: 'corporal', pesoPorLado: false, pesoNota: null };
  if (t === 'Peso corporal' || t === '-') return sinPeso;
  let m = t.match(new RegExp(`^${NUMERO} (kg|lb)( cada una)?$`));
  if (m) return { ...sinPeso, pesoSugerido: Number(m[1]), unidadPeso: m[2], pesoPorLado: Boolean(m[3]) };
  m = t.match(new RegExp(`^${NUMERO} (kg|lb) \\+ barra$`));
  if (m) return { ...sinPeso, pesoSugerido: Number(m[1]), unidadPeso: m[2], pesoNota: '+ barra' };
  m = t.match(new RegExp(`^Barra sola ${NUMERO} (kg|lb)$`));
  if (m) return { ...sinPeso, pesoSugerido: Number(m[1]), unidadPeso: m[2] };
  if (/^Banda \S+/.test(t)) return { ...sinPeso, pesoNota: t };
  throw new Error(`Peso no reconocido: "${texto}"`);
}

// Encargo 5.6: '2-3 min' son 150 s, '2 min' 120, '90 s' 90, '60 s' 60, '0' sin cronómetro.
// '-' (caminatas) también es sin cronómetro.
const DESCANSOS = { '0': 0, '-': 0, '60 s': 60, '90 s': 90, '2 min': 120, '2-3 min': 150 };

export function parsearDescanso(texto) {
  const t = texto.trim();
  if (!Object.hasOwn(DESCANSOS, t)) throw new Error(`Descanso no reconocido: "${texto}"`);
  return DESCANSOS[t];
}
