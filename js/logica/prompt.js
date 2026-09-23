// Lógica pura: el prompt para cambiar de rutina con una IA (tanda 4). La app
// no usa IA: arma el texto, tú lo copias a Claude o Gemini y pegas la respuesta.
// El prompt fija el formato exacto de la respuesta (el mismo de tu hoja más la
// columna «Regla») para que la app la pueda revisar renglón por renglón.

import { COLUMNAS_RUTINA } from './plan.js';

/**
 * @param {object} p
 * @param {string} p.queQuiero  lo que escribiste
 * @param {string} p.equipo  tu equipo en palabras
 * @param {string} p.rutinaTSV  tu rutina actual, en el formato de respuesta
 * @param {{actuales:string[], anteriores:string[]}} p.nombres  los ejercicios que ya tienes:
 *   los de tu rutina actual y los de rutinas anteriores (idea de Aarón, 2026-09-23)
 * @param {string[]} p.avance  una línea por ejercicio
 * @param {string|null} p.constancia
 * @param {string[]|null} p.medidas  null si decidiste no incluirlas
 * @param {string[]} p.notas
 * @param {string[]} p.ligas  las únicas ligas permitidas
 * @param {string} p.fecha  '2026-09-23'
 */
export function armarPrompt({ queQuiero, equipo, rutinaTSV, nombres, avance, constancia, medidas, notas, ligas, fecha }) {
  const seccion = (titulo, cuerpo) => `## ${titulo}\n${cuerpo}`;
  const lista = (lineas, vacio) => (lineas.length ? lineas.map((l) => `- ${l}`).join('\n') : vacio);
  const partes = [
    `Quiero cambiar mi rutina de fuerza. Hoy es ${fecha}. Entreno solo en casa con el equipo de abajo. Una app registra mis series y lee tu respuesta automáticamente, así que el formato es obligatorio.`,
    seccion('Lo que quiero', queQuiero.trim() || '(No escribí nada: propón una mejora razonable a mi rutina actual).'),
    seccion('Mi equipo', equipo.trim()),
    seccion('Mi rutina actual', `\`\`\`tsv\n${rutinaTSV}\n\`\`\``),
    seccion(
      'Ejercicios que ya tengo (nombres fijos)',
      [
        'La app junta el historial de cada ejercicio por su nombre. Si usas uno de estos, escríbelo EXACTAMENTE como aquí, letra por letra y con acentos: no lo traduzcas ni le agregues o quites palabras. Un ejercicio distinto lleva un nombre nuevo que no se confunda con estos.',
        'En mi rutina actual:',
        lista(nombres.actuales, '(ninguno)'),
        nombres.anteriores.length ? `De rutinas anteriores:\n${lista(nombres.anteriores, '')}` : null,
      ].filter(Boolean).join('\n'),
    ),
    seccion('Cómo me ha ido', [constancia ?? 'Todavía no hay semanas completas.', lista(avance, 'Sin series registradas todavía.')].join('\n')),
    medidas === null ? null : seccion('Mis medidas', lista(medidas, 'Sin medidas registradas.')),
    seccion('Mis notas por ejercicio', lista(notas, 'Sin notas.')),
    seccion(
      'Formato de tu respuesta (obligatorio)',
      [
        'Responde SOLO con la rutina nueva completa, en una tabla TSV (separada por tabuladores) dentro de un bloque ```tsv. Sin texto antes ni después.',
        `El encabezado es exactamente:\n${COLUMNAS_RUTINA.join('\t')}`,
        'Reglas por columna:',
        '- Día: «LUNES - Nombre del día» (LUNES, MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO o DOMINGO). Un día de caminata se llama «SÁBADO - Caminata» (con la palabra Caminata).',
        '- Orden: 1, 2, 3… dentro de cada día, sin repetir.',
        '- Grupo: el grupo muscular principal.',
        '- Ejercicio: en español. Si es uno de «Ejercicios que ya tengo», con el nombre EXACTO de esa lista: así conservo su historial.',
        '- Equipo: con lo que tengo. Accesorio polea: el accesorio, o «-».',
        '- Peso sugerido: uno de «50 kg», «35 lb cada una» (dos mancuernas, peso de cada una), «20 lb» (una mancuerna), «20 kg + barra» (landmine, sin contar la barra), «Barra sola 20 kg», «Banda negra 25-65 lb», «Peso corporal». En barra el peso INCLUYE la barra de 20 kg. Usa solo pesos que se puedan armar con mis discos.',
        '- Series: número entero.',
        '- Reps: «8-10», «12», «30 s», «30-45 s», «40 m» o «2 min»; agrega « por lado», « por pie», « por pierna» o « por brazo» si aplica.',
        '- RIR: un número, o «-».',
        '- Descanso: «0», «45 s», «60 s», «90 s», «2 min», «2-3 min» (cualquier «N s», «N min» o «N-M min»); «-» en caminatas.',
        '- Progresión: una frase corta que yo leo (cuándo y cuánto subir).',
        '- Link MuscleWiki: uno de la lista de abajo, o «SIN LIGA». No inventes ligas.',
        '- Regla: la versión que la app evalúa, con una de estas formas:',
        '  «manual» (sin aviso automático);',
        '  «todas 10 +5 kg» (cuando todas las series lleguen a 10, subir 5 kg; en lb si el peso es en lb);',
        '  «todas 15 +? kg» (igual, pero el peso nuevo lo decido yo);',
        '  «tiempo +10 hasta 60» (subir 10 segundos por semana hasta 60);',
        '  «implemento 12: Banda roja» (al llegar a 12, cambiar de implemento);',
        '  «implemento 15: Mancuerna de 20 lb = 20 lb» (y con ese peso; « c/u» al final si son dos mancuernas);',
        '  «dos semanas 10: Subí 5 kg = +5 kg | Bajé el banco = Banco más bajo» (dos semanas seguidas; eliges una opción).',
        'Ligas permitidas:',
        lista(ligas, '(ninguna: usa «SIN LIGA»)'),
      ].join('\n'),
    ),
  ];
  return partes.filter(Boolean).join('\n\n');
}
