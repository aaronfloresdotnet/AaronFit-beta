// Capa de aplicación: tu equipo (calculadora de discos) y tus preferencias
// (voz en el descanso). Tanda 3. Todo va en `estado`; no cambia la base.

import { normalizarEquipo } from '../logica/equipo.js';

export const PREFERENCIAS_INICIALES = Object.freeze({ voz: false });

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
