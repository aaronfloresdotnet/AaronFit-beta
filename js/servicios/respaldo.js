// Capa de aplicación: exportar e importar (encargo, sección 7).
// Importar valida SIEMPRE antes de tocar la base, y reemplaza todo en una sola
// transacción: si algo falla, la base queda como estaba.
// Tanda 2: el historial en TSV para Sheets y cuándo recordar el respaldo.

import { armarRespaldo, historialTSV, nombreArchivo, nombreHistorial, recordatorioRespaldo, validarRespaldo } from '../logica/respaldo.js';
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

  /**
   * El historial en TSV para Sheets (un renglón por serie guardada).
   * NO es un respaldo: no se puede importar, y por eso no cambia la fecha del último respaldo.
   */
  async function exportarHistorial() {
    const datos = await repos.leerTodo();
    return { nombre: nombreHistorial(aTexto(fechaLocal(reloj()))), texto: historialTSV(datos), renglones: datos.series.length };
  }

  /** Cuándo fue el último respaldo (fecha local), cuánto hay guardado y si ya toca recordarlo. */
  async function situacion() {
    const [iso, cuentas] = await Promise.all([ultimo(), repos.contar()]);
    const fecha = iso ? aTexto(fechaLocal(new Date(iso))) : null;
    const hayDatos = cuentas.sesiones > 0 || cuentas.medidas > 0;
    return { fecha, cuentas, ...recordatorioRespaldo({ ultimo: fecha, hoy: aTexto(fechaLocal(reloj())), hayDatos }) };
  }

  return { exportar, revisar, importar, ultimo, exportarHistorial, situacion };
}
