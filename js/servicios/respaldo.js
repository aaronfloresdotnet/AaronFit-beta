// Capa de aplicación: exportar e importar (encargo, sección 7).
// Importar valida SIEMPRE antes de tocar la base, y reemplaza todo en una sola
// transacción: si algo falla, la base queda como estaba.

import { armarRespaldo, nombreArchivo, validarRespaldo } from '../logica/respaldo.js';
import { aTexto, fechaLocal } from '../logica/semana.js';

export function crearServicioRespaldo({ repos, reloj = () => new Date(), despuesDeImportar = async () => {} }) {
  async function exportar() {
    const instante = reloj();
    // Se anota antes de leer, para que el archivo lleve su propia fecha:
    // al importarlo, la app sabe de cuándo es el respaldo que tiene.
    await repos.estado.escribir('ultimoRespaldo', instante.toISOString());
    const respaldo = armarRespaldo(await repos.leerTodo(), { exportado: instante.toISOString() });
    return {
      nombre: nombreArchivo(aTexto(fechaLocal(instante))),
      texto: JSON.stringify(respaldo),
      conteos: respaldo.conteos,
    };
  }

  /** Revisa un archivo sin tocar nada: qué trae y cuánto hay ahora. */
  async function revisar(texto) {
    const resultado = validarRespaldo(texto);
    if (!resultado.ok) return resultado;
    return { ...resultado, actuales: await repos.contar() };
  }

  /** Reemplaza TODO con el respaldo. Vuelve a validar: no confía en una revisión anterior. */
  async function importar(texto) {
    const resultado = validarRespaldo(texto);
    if (!resultado.ok) return resultado;
    await repos.reemplazarTodo(resultado.datos);
    await despuesDeImportar();
    return { ok: true, entraron: resultado.conteos, ahora: await repos.contar() };
  }

  const ultimo = () => repos.estado.leer('ultimoRespaldo');

  return { exportar, revisar, importar, ultimo };
}
