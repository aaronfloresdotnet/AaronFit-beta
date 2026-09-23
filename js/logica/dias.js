// Lógica pura: qué día de la rutina toca hoy, y saltar o recorrer un día perdido.
//
// Tu rutina tiene 5 días de fuerza (1 = lunes … 5 = viernes) y 2 de caminata
// (6 y 7), que no se recorren ni bloquean nada; desde la tanda 4 una rutina
// nueva puede traer otros días (p. ej. lunes, miércoles y viernes). Recorrer
// corre el día perdido y todos los siguientes; lo que ya no cabe antes del
// domingo queda como no hecho. La semana NUNCA invade la siguiente: cada lunes
// arranca limpio porque las decisiones se guardan por semana ISO.

export const DIAS_FUERZA = [1, 2, 3, 4, 5];
export const DECISIONES_VACIAS = Object.freeze({ desplazamiento: 0, saltados: Object.freeze([]) });

/**
 * @param {object} p
 * @param {number} p.hoy  día de la semana de hoy, 1 (lunes) … 7 (domingo)
 * @param {Array<{diaSemanaPlan:number, estado:string}>} p.sesiones  sesiones de esta semana ISO
 * @param {{desplazamiento:number, saltados:number[]}} [p.decisiones]
 * @param {number[]} [p.diasFuerza]  días de fuerza de la rutina que rige (tanda 4: puede ser de 3 o 4 días)
 * @param {number[]} [p.diasCaminata]  días de caminata de esa rutina
 * @returns {{
 *   dias: Array<{dia:number, programado:number|null, estado:string}>,
 *   vencido: number|null,
 *   hoyToca: number|null,
 *   caminata: number|null,
 * }}
 * Estados: hecho, en_curso, saltado, no_cabe, vencido, hoy, pendiente.
 */
export function planSemana({ hoy, sesiones, decisiones = DECISIONES_VACIAS, diasFuerza = DIAS_FUERZA, diasCaminata = [6, 7] }) {
  const { desplazamiento, saltados } = decisiones;
  const sesionDe = (dia, estado) => sesiones.some((s) => s.diaSemanaPlan === dia && s.estado === estado);

  const dias = diasFuerza.map((dia) => {
    const programado = dia + desplazamiento;
    let estado;
    if (sesionDe(dia, 'completa')) estado = 'hecho';
    else if (sesionDe(dia, 'en_curso')) estado = 'en_curso';
    else if (saltados.includes(dia)) estado = 'saltado';
    else if (programado > 7) estado = 'no_cabe';
    else if (programado < hoy) estado = 'vencido';
    else if (programado === hoy) estado = 'hoy';
    else estado = 'pendiente';
    return { dia, programado: programado > 7 ? null : programado, estado };
  });

  // Primero se resuelve el día perdido más antiguo; la app pregunta, no decide.
  const vencido = dias.find((d) => d.estado === 'vencido')?.dia ?? null;
  // Lo de hoy sigue siendo de hoy aunque ya esté en curso (al reabrir se retoma).
  const deHoy = dias.find((d) => d.programado === hoy && ['hoy', 'en_curso'].includes(d.estado))?.dia ?? null;
  return {
    dias,
    vencido,
    hoyToca: vencido === null ? deHoy : null,
    caminata: diasCaminata.includes(hoy) ? hoy : null,
  };
}

/** Saltar: el día queda como no hecho y hoy se entrena lo que toca por calendario. */
export function saltar(decisiones, dia) {
  if (decisiones.saltados.includes(dia)) return decisiones;
  return { ...decisiones, saltados: [...decisiones.saltados, dia].sort((a, b) => a - b) };
}

/** Recorrer: hoy se entrena `dia` y los días siguientes se corren detrás de él. */
export function recorrer(decisiones, dia, hoy) {
  const desplazamiento = hoy - dia;
  if (desplazamiento <= decisiones.desplazamiento) return decisiones;
  return { ...decisiones, desplazamiento };
}
