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
  const m = texto.trim().match(/^(\d+)(?:-(\d+))?(?: (s|m|min))?(?: por (pie|pierna|brazo|lado))?$/);
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
// '-' (caminatas) también es sin cronómetro. Tanda 4: cualquier 'N s', 'N min' o
// 'N-M min' (un rango vale su punto medio, como '2-3 min' = 150 s).
export function parsearDescanso(texto) {
  const t = texto.trim();
  if (t === '0' || t === '-') return 0;
  let m = t.match(/^(\d+) s$/);
  if (m) return Number(m[1]);
  m = t.match(/^(\d+) min$/);
  if (m) return Number(m[1]) * 60;
  m = t.match(/^(\d+)-(\d+) min$/);
  if (m && Number(m[1]) < Number(m[2])) return ((Number(m[1]) + Number(m[2])) / 2) * 60;
  throw new Error(`Descanso no reconocido: "${texto}"`);
}

// ---- Reglas de progresión en texto (tanda 4) ----
// Una mini-sintaxis que la hoja y la IA pueden escribir, y la app entiende:
//   manual
//   todas 10 +5 kg                 todas las series llegan a 10 → sube 5 kg
//   todas 15 +? kg                 igual, pero el peso nuevo lo decides tú
//   tiempo +10 hasta 70            sube 10 s cada semana, hasta 70
//   implemento 6: Banda roja       todas llegan a 6 → cambia de implemento
//   implemento 15: Mancuerna de 20 lb = 20 lb        …y con ese peso (c/u si son dos)
//   dos semanas 10: Subí 5 kg = +5 kg | Bajé el banco = Banco más bajo
//                                  dos semanas seguidas → eliges una opción

/** Texto de regla → la regla que evalúa la app. Lanza error si no la reconoce. */
export function parsearRegla(texto) {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (/^manual$/i.test(t)) return { tipo: 'manual' };
  let m = t.match(/^todas (\d+) \+(\?|\d+(?:\.\d+)?) (kg|lb)$/i);
  if (m) return { tipo: 'todas_las_series', objetivo: Number(m[1]), incremento: m[2] === '?' ? null : Number(m[2]), unidad: m[3].toLowerCase() };
  m = t.match(/^tiempo \+(\d+) hasta (\d+)$/i);
  if (m) return { tipo: 'incremento_semanal_tiempo', incremento: Number(m[1]), tope: Number(m[2]) };
  m = t.match(new RegExp(`^implemento (\\d+): (.+?)(?: = ${NUMERO} (kg|lb)( c/u)?)?$`, 'i'));
  if (m) {
    const regla = { tipo: 'cambio_de_implemento', objetivo: Number(m[1]), cambio: m[2].trim() };
    if (m[3]) Object.assign(regla, { peso: Number(m[3]), unidad: m[4].toLowerCase(), pesoPorLado: Boolean(m[5]) });
    return regla;
  }
  m = t.match(/^dos semanas (\d+): (.+)$/i);
  if (m) {
    const opciones = m[2].split('|').map((parte) => {
      const opcion = parte.trim();
      const conPeso = opcion.match(new RegExp(`^(.+?) = \\+${NUMERO} (kg|lb)$`, 'i'));
      if (conPeso) return { etiqueta: conPeso[1].trim(), incremento: Number(conPeso[2]), unidad: conPeso[3].toLowerCase() };
      const conCambio = opcion.match(/^(.+?) = (.+)$/);
      if (conCambio) return { etiqueta: conCambio[1].trim(), cambio: conCambio[2].trim() };
      throw new Error(`Opción de regla no reconocida: "${opcion}" (en "${texto}")`);
    });
    if (opciones.length < 2) throw new Error(`«dos semanas» necesita al menos dos opciones: "${texto}"`);
    return { tipo: 'todas_las_series_dos_semanas', objetivo: Number(m[1]), opciones };
  }
  throw new Error(`Regla no reconocida: "${texto}"`);
}

/** La regla en su texto (lo inverso de parsearRegla). */
export function reglaATexto(regla) {
  switch (regla?.tipo) {
    case 'manual':
      return 'manual';
    case 'todas_las_series':
      return `todas ${regla.objetivo} +${regla.incremento ?? '?'} ${regla.unidad}`;
    case 'incremento_semanal_tiempo':
      return `tiempo +${regla.incremento} hasta ${regla.tope}`;
    case 'cambio_de_implemento':
      return `implemento ${regla.objetivo}: ${regla.cambio}${'peso' in regla ? ` = ${regla.peso} ${regla.unidad}${regla.pesoPorLado ? ' c/u' : ''}` : ''}`;
    case 'todas_las_series_dos_semanas':
      return `dos semanas ${regla.objetivo}: ${regla.opciones
        .map((o) => (o.cambio ? `${o.etiqueta} = ${o.cambio}` : `${o.etiqueta} = +${o.incremento} ${o.unidad}`))
        .join(' | ')}`;
    default:
      throw new Error(`Tipo de regla desconocido: ${regla?.tipo}`);
  }
}
