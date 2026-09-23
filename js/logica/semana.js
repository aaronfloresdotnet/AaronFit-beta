// Lógica pura: fechas de calendario y semanas ISO 8601 (de lunes a domingo).
//
// Una "fecha" aquí es { anio, mes (1-12), dia } en hora LOCAL del teléfono.
// La única función que mira un instante es fechaLocal(), y usa los getters
// locales. Nunca toISOString() para fechas: esa es UTC y de noche cambia el día.

const DIA_MS = 86_400_000;

const aUTC = ({ anio, mes, dia }) => Date.UTC(anio, mes - 1, dia);

function deUTC(ms) {
  const d = new Date(ms);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

const dos = (n) => String(n).padStart(2, '0');

/** La fecha del calendario local en que cae un instante. */
export function fechaLocal(instante = new Date()) {
  return { anio: instante.getFullYear(), mes: instante.getMonth() + 1, dia: instante.getDate() };
}

/** { 2026, 9, 22 } → '2026-09-22'. */
export const aTexto = ({ anio, mes, dia }) => `${anio}-${dos(mes)}-${dos(dia)}`;

/** '2026-09-22' → { 2026, 9, 22 }. */
export function deTexto(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) throw new Error(`Fecha no válida: "${texto}"`);
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** 1 = lunes … 7 = domingo. */
export const diaSemana = (fecha) => ((new Date(aUTC(fecha)).getUTCDay() + 6) % 7) + 1;

export const sumarDias = (fecha, dias) => deUTC(aUTC(fecha) + dias * DIA_MS);

export const compararFechas = (a, b) => Math.sign(aUTC(a) - aUTC(b));

/** Días de calendario de `desde` a `hasta` (negativo si `hasta` es antes). */
export const diasEntre = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS);

/** Semana ISO, p. ej. '2026-W39'. La semana pertenece al año en que cae su jueves. */
export function semanaISO(fecha) {
  const jueves = aUTC(fecha) + (4 - diaSemana(fecha)) * DIA_MS;
  const anio = new Date(jueves).getUTCFullYear();
  const numero = Math.floor((jueves - Date.UTC(anio, 0, 1)) / (7 * DIA_MS)) + 1;
  return `${anio}-W${dos(numero)}`;
}

/** '2026-W39' → lunes 2026-09-21. */
export function lunesDeSemana(semana) {
  const m = /^(\d{4})-W(\d{2})$/.exec(semana);
  if (!m) throw new Error(`Semana no válida: "${semana}"`);
  // El 4 de enero siempre cae en la semana 1.
  const cuatroDeEnero = { anio: Number(m[1]), mes: 1, dia: 4 };
  const lunesSemana1 = sumarDias(cuatroDeEnero, 1 - diaSemana(cuatroDeEnero));
  return sumarDias(lunesSemana1, (Number(m[2]) - 1) * 7);
}

/** Fecha del día `dia` (1-7) de una semana ISO. */
export const fechaDeDia = (semana, dia) => sumarDias(lunesDeSemana(semana), dia - 1);

/** Cuántas semanas hay de `desde` a `hasta` (0 si son la misma). */
export const semanasEntre = (desde, hasta) =>
  Math.round((aUTC(lunesDeSemana(hasta)) - aUTC(lunesDeSemana(desde))) / (7 * DIA_MS));

/** La semana ISO inmediata anterior. */
export const semanaAnterior = (semana) => semanaISO(sumarDias(lunesDeSemana(semana), -7));
