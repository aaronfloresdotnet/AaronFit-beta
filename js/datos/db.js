// Capa de datos: apertura de IndexedDB, esquema, migraciones y transacciones.
// Nadie fuera de js/datos/ toca IndexedDB.

import { CONFIG } from '../config.js';

export const NOMBRE_BD = CONFIG.nombreBD; // 'entrena' en producción; la beta usa otra
export const VERSION_BD = 1;
export const ALMACENES = ['rutina', 'sesiones', 'series', 'medidas', 'estado'];

// Una función por versión. Para cambiar el esquema: subir VERSION_BD y agregar
// la migración siguiente; nunca editar una ya publicada.
const MIGRACIONES = {
  1(bd) {
    // La rutina usa id estable (diaSemana * 100 + orden), no autoincremental:
    // así una corrección de la semilla no deja huérfanas las series.
    const rutina = bd.createObjectStore('rutina', { keyPath: 'id' });
    rutina.createIndex('diaSemana', 'diaSemana');
    rutina.createIndex('clave', 'clave');

    const sesiones = bd.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true });
    sesiones.createIndex('semanaISO', 'semanaISO');
    sesiones.createIndex('fecha', 'fecha');
    sesiones.createIndex('estado', 'estado');

    const series = bd.createObjectStore('series', { keyPath: 'id', autoIncrement: true });
    series.createIndex('sesionId', 'sesionId');
    series.createIndex('rutinaId', 'rutinaId');
    series.createIndex('semanaISO', 'semanaISO');

    const medidas = bd.createObjectStore('medidas', { keyPath: 'id', autoIncrement: true });
    medidas.createIndex('fecha', 'fecha');
    medidas.createIndex('semanaISO', 'semanaISO');

    bd.createObjectStore('estado', { keyPath: 'llave' });
  },
};

let promesaBD = null;

/** Abre (y crea o migra) la base. Se reutiliza la misma conexión. */
export function abrirBD() {
  if (!promesaBD) {
    promesaBD = new Promise((resolver, rechazar) => {
      const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
      pedido.onupgradeneeded = (evento) => {
        for (let v = evento.oldVersion + 1; v <= VERSION_BD; v++) {
          MIGRACIONES[v](pedido.result, pedido.transaction);
        }
      };
      pedido.onsuccess = () => {
        const bd = pedido.result;
        // Si otra pestaña abre una versión más nueva, soltamos la conexión.
        bd.onversionchange = () => bd.close();
        resolver(bd);
      };
      pedido.onerror = () => rechazar(pedido.error);
      pedido.onblocked = () =>
        rechazar(new Error('La base está abierta en otra pestaña con una versión anterior. Ciérrala y vuelve a abrir.'));
    }).catch((error) => {
      promesaBD = null;
      throw error;
    });
  }
  return promesaBD;
}

/** Convierte un IDBRequest en promesa. */
export function comoPromesa(pedido) {
  return new Promise((resolver, rechazar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

/**
 * Corre `trabajo(tx)` dentro de UNA transacción y resuelve cuando se confirma.
 *
 * Regla de IndexedDB: la transacción se cierra sola en cuanto no hay pedidos
 * pendientes. `trabajo` solo puede esperar pedidos de esta misma transacción;
 * esperar cualquier otra cosa (fetch, temporizadores) la deja inactiva.
 * Si `trabajo` lanza un error, la transacción se aborta y no queda nada a medias.
 */
export async function enTransaccion(almacenes, modo, trabajo) {
  const bd = await abrirBD();
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(almacenes, modo);
    let resultado;
    let fallo = null;
    tx.oncomplete = () => resolver(resultado);
    tx.onerror = () => rechazar(fallo ?? tx.error);
    tx.onabort = () => rechazar(fallo ?? tx.error ?? new Error('Transacción abortada'));
    const abortar = (error) => {
      fallo = error;
      try {
        tx.abort();
      } catch {
        rechazar(error);
      }
    };
    try {
      Promise.resolve(trabajo(tx)).then((valor) => {
        resultado = valor;
      }, abortar);
    } catch (error) {
      abortar(error);
    }
  });
}
