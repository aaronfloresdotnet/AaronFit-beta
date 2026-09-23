// Capa de aplicación: tu equipo (calculadora de discos) y tus preferencias
// del descanso (voz y guía de respiración). Todo va en `estado`; no cambia la base.

import { normalizarEquipo } from '../logica/equipo.js';

// La voz empieza apagada (tanda 3); la guía de respiración, encendida: la pediste (2026-09-23).
export const PREFERENCIAS_INICIALES = Object.freeze({ voz: false, respiracion: true });

export function crearServicioAjustes({ repos }) {
  /** Tu equipo guardado, completado con el inicial. */
  const equipo = async () => normalizarEquipo(await repos.estado.leer('equipo'));

  async function guardarEquipo(cambios) {
    const nuevo = normalizarEquipo({ ...(await equipo()), ...cambios });
    await repos.estado.escribir('equipo', nuevo);
    return nuevo;
  }

  const preferencias = async () => ({ ...PREFERENCIAS_INICIALES, ...((await repos.estado.leer('preferencias')) ?? {}) });

  async function guardarPreferencias(cambios) {
    const nuevas = { ...(await preferencias()), ...cambios };
    await repos.estado.escribir('preferencias', nuevas);
    return nuevas;
  }

  return { equipo, guardarEquipo, preferencias, guardarPreferencias };
}
