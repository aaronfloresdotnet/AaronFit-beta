// Capa de aplicación: lo que corre una vez al abrir la app.

import * as repos from '../datos/repos.js';
import { RUTINA, VERSION_SEMILLA } from '../datos/semilla.js';

/**
 * Carga la rutina la primera vez y la actualiza si la semilla cambió
 * (una corrección publicada). El historial no se toca: los id son estables.
 */
export async function prepararRutina() {
  const version = await repos.estado.leer('versionSemilla');
  if (version === VERSION_SEMILLA) return { sembrada: false, renglones: 0 };
  await repos.rutina.sembrar(RUTINA, VERSION_SEMILLA);
  return { sembrada: true, renglones: RUTINA.length };
}
