// Capa de datos: repositorios. Lectura y escritura por colección.
// Devuelven y reciben objetos planos; no saben nada de reglas de negocio.

import { ALMACENES, comoPromesa, enTransaccion } from './db.js';

const leer = (almacen, operacion) =>
  enTransaccion([almacen], 'readonly', (tx) => comoPromesa(operacion(tx.objectStore(almacen))));

const escribir = (almacen, operacion) =>
  enTransaccion([almacen], 'readwrite', (tx) => comoPromesa(operacion(tx.objectStore(almacen))));

export const rutina = {
  todas: () => leer('rutina', (s) => s.getAll()),

  /**
   * Inserta o actualiza los renglones por id y anota la versión, en una sola
   * transacción. Nunca borra renglones: las series apuntan a ellos.
   */
  sembrar: (renglones, version) =>
    enTransaccion(['rutina', 'estado'], 'readwrite', (tx) => {
      const almacen = tx.objectStore('rutina');
      for (const renglon of renglones) almacen.put(renglon);
      tx.objectStore('estado').put({ llave: 'versionSemilla', valor: version });
    }),
};

export const sesiones = {
  obtener: (id) => leer('sesiones', (s) => s.get(id)),
  todas: () => leer('sesiones', (s) => s.getAll()),
  deSemana: (semanaISO) => leer('sesiones', (s) => s.index('semanaISO').getAll(semanaISO)),
  enCurso: () => leer('sesiones', (s) => s.index('estado').getAll('en_curso')),
  guardar: (sesion) => escribir('sesiones', (s) => s.put(sesion)),
};

export const series = {
  todas: () => leer('series', (s) => s.getAll()),
  deSesion: (sesionId) => leer('series', (s) => s.index('sesionId').getAll(sesionId)),

  /** Todas las series de varios renglones de rutina (un ejercicio puede repetirse en la semana). */
  deRutinas: (rutinaIds) =>
    enTransaccion(['series'], 'readonly', async (tx) => {
      const indice = tx.objectStore('series').index('rutinaId');
      const grupos = await Promise.all(rutinaIds.map((id) => comoPromesa(indice.getAll(id))));
      return grupos.flat();
    }),
};

/**
 * Guarda las series de una captura y la sesión en UNA transacción.
 * `borrar` son ids de series que la captura reemplaza (p. ej. al pasar de
 * un solo registro a izquierda y derecha).
 */
export function guardarCaptura({ nuevas, borrar = [], sesion }) {
  return enTransaccion(['series', 'sesiones'], 'readwrite', (tx) => {
    const almacen = tx.objectStore('series');
    for (const id of borrar) almacen.delete(id);
    const pedidos = nuevas.map((serie) => comoPromesa(almacen.put(serie)));
    if (sesion) tx.objectStore('sesiones').put(sesion);
    return Promise.all(pedidos);
  });
}

/**
 * Deshace una captura en UNA transacción: borra sus series, reabre la sesión
 * si esa captura la había cerrado y quita (o reescribe, como la lista de
 * avisos aceptados) lo que se guardó en `estado` después de ella.
 */
export function deshacerCaptura({ borrarSeries, sesion, borrarEstado = [], escribirEstado = [] }) {
  return enTransaccion(['series', 'sesiones', 'estado'], 'readwrite', (tx) => {
    const series = tx.objectStore('series');
    for (const id of borrarSeries) series.delete(id);
    if (sesion) tx.objectStore('sesiones').put(sesion);
    const estado = tx.objectStore('estado');
    for (const llave of borrarEstado) estado.delete(llave);
    for (const [llave, valor] of escribirEstado) estado.put({ llave, valor });
  });
}

export const medidas = {
  todas: () => leer('medidas', (s) => s.getAll()),
  porFecha: (fecha) => leer('medidas', (s) => s.index('fecha').getAll(fecha)),
  deSemana: (semanaISO) => leer('medidas', (s) => s.index('semanaISO').getAll(semanaISO)),
  guardar: (medida) => escribir('medidas', (s) => s.put(medida)),
};

export const estado = {
  async leer(llave) {
    const registro = await leer('estado', (s) => s.get(llave));
    return registro ? registro.valor : undefined;
  },
  escribir: (llave, valor) => escribir('estado', (s) => s.put({ llave, valor })),
  borrar: (llave) => escribir('estado', (s) => s.delete(llave)),

  /** Varios pares [llave, valor] en una sola transacción. */
  escribirVarias: (pares) =>
    enTransaccion(['estado'], 'readwrite', (tx) => {
      const almacen = tx.objectStore('estado');
      for (const [llave, valor] of pares) almacen.put({ llave, valor });
    }),
};

/** Lee las cinco colecciones completas en una sola transacción de lectura. */
export function leerTodo() {
  return enTransaccion(ALMACENES, 'readonly', async (tx) => {
    const listas = await Promise.all(ALMACENES.map((nombre) => comoPromesa(tx.objectStore(nombre).getAll())));
    return Object.fromEntries(ALMACENES.map((nombre, i) => [nombre, listas[i]]));
  });
}

/** Cuántos registros hay en cada colección. */
export function contar() {
  return enTransaccion(ALMACENES, 'readonly', async (tx) => {
    const cuentas = await Promise.all(ALMACENES.map((nombre) => comoPromesa(tx.objectStore(nombre).count())));
    return Object.fromEntries(ALMACENES.map((nombre, i) => [nombre, cuentas[i]]));
  });
}

/**
 * Borra TODO y escribe `colecciones` en una sola transacción.
 * Todos los pedidos se emiten de forma síncrona; si uno falla, IndexedDB
 * aborta la transacción completa y la base queda como estaba.
 */
export function reemplazarTodo(colecciones) {
  return enTransaccion(ALMACENES, 'readwrite', (tx) => {
    for (const nombre of ALMACENES) {
      const almacen = tx.objectStore(nombre);
      almacen.clear();
      for (const registro of colecciones[nombre]) almacen.put(registro);
    }
  });
}
