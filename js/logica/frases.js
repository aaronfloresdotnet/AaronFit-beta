// Lógica pura: frases para el descanso. Dos listas propias (español e inglés)
// y frases armadas con tu propio avance. Funcionan sin internet.

export const FRASES_ES = Object.freeze([
  'Una serie más fuerte que la de la semana pasada.',
  'Respira. La siguiente serie es tuya.',
  'Lo difícil es aparecer. Ya apareciste.',
  'No negocies con el cansancio: termina la serie.',
  'Constancia gana a intensidad.',
  'Tu yo de dentro de un año te lo agradece.',
  'Técnica limpia primero; el peso viene después.',
  'Cada repetición cuenta, aunque nadie la vea.',
  'El progreso lento sigue siendo progreso.',
  'Descansa lo justo. Vuelve con todo.',
  'Hoy no se trata de ganas: se trata de hacerlo.',
  'Fuerte no se nace: se entrena.',
  'Un kilo más, una repetición más, una semana más.',
  'La disciplina es recordar lo que quieres.',
  'Menos excusas, más series.',
  'Tu cuerpo se adapta a lo que le pides.',
  'Lo que hoy pesa, mañana es calentamiento.',
  'Enfócate en esta serie, no en todas.',
  'El descanso también es parte del entrenamiento.',
  'Hazlo bien, luego hazlo pesado.',
  'Ya hiciste lo más difícil: empezar.',
  'Paso a paso se llega lejos.',
  'Sin prisa, pero sin pausa.',
  'La siguiente serie decide el día.',
  'Mejor que ayer es suficiente.',
]);

export const FRASES_EN = Object.freeze([
  'Stronger than last week. That is the whole game.',
  'Breathe. The next set is yours.',
  'Showing up is the hardest rep. You already did it.',
  'Consistency beats intensity.',
  'Clean form first. The weight will follow.',
  'Slow progress is still progress.',
  'Rest hard, then lift hard.',
  'One more rep is a choice. Make it.',
  'Discipline is remembering what you want.',
  'Today’s max is tomorrow’s warm-up.',
  'Focus on this set, not the whole workout.',
  'Strong is built, not born.',
  'Small plates, big wins.',
  'Earn the next set.',
  'Your future self is watching this rep.',
  'Do it right, then do it heavy.',
  'Better than yesterday is enough.',
  'The grind is the reward.',
  'Recover now. Attack the next set.',
  'No shortcuts. Just sets.',
  'Keep the promise you made this morning.',
  'Hard sets, easy life.',
  'The bar does not care about excuses.',
  'Trust the process. Log the reps.',
  'You are one set closer.',
]);

const numero = (n) => String(Math.round(n * 100) / 100);

/**
 * Frases con tu propio avance.
 * @param {Array<{ejercicio:string, unidad:string, primerPeso:number|null, ultimoPeso:number|null, semanas:number}>} avances
 * @param {{entrenamientos:number, diasSemana:number, diasHechos:number}} constancia
 */
export function frasesDeAvance(avances, { entrenamientos = 0, diasSemana = 0, diasHechos = 0 } = {}) {
  const frases = [];
  for (const a of avances) {
    if (a.primerPeso === null || a.ultimoPeso === null || a.ultimoPeso <= a.primerPeso) continue;
    const hace = a.semanas >= 1 ? `hace ${a.semanas} ${a.semanas === 1 ? 'semana' : 'semanas'}` : 'al empezar';
    frases.push(`${a.ejercicio}: ${hace} ${numero(a.primerPeso)} ${a.unidad}. Hoy ${numero(a.ultimoPeso)} ${a.unidad}.`);
  }
  if (entrenamientos >= 2) frases.push(`Llevas ${entrenamientos} entrenamientos registrados.`);
  if (diasSemana > 0 && diasHechos > 0) frases.push(`Esta semana: ${diasHechos} de ${diasSemana} días hechos.`);
  return frases;
}

/**
 * Mezcla para un descanso: primero tu avance, luego frases de las listas.
 * `azar` se inyecta (entre 0 y 1) para que la función sea pura y probable.
 */
export function mezclarFrases(propias, azar = Math.random) {
  const listas = [...FRASES_ES, ...FRASES_EN];
  const copia = [...listas];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  const avance = [...propias];
  const resultado = [];
  // Una de avance cada tres, si hay.
  while (copia.length || avance.length) {
    if (avance.length && resultado.length % 3 === 0) resultado.push(avance.shift());
    else if (copia.length) resultado.push(copia.shift());
    else resultado.push(avance.shift());
  }
  return resultado;
}
