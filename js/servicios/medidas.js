// Capa de aplicación: medidas corporales (encargo 6.6). Una medición por fecha;
// guardar otra vez la misma fecha la corrige.

import { registroDeMedida } from '../logica/medidas.js';
import { aTexto, deTexto, fechaLocal, semanaISO } from '../logica/semana.js';

export function crearServicioMedidas({ repos, reloj = () => new Date() }) {
  const hoy = () => aTexto(fechaLocal(reloj()));

  /** La medición de `fecha` (si existe), la anterior a esa fecha y la lista completa. */
  async function datos(fecha = hoy()) {
    const lista = (await repos.medidas.todas()).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return {
      hoy: hoy(),
      fecha,
      deLaFecha: lista.find((m) => m.fecha === fecha) ?? null,
      anterior: lista.find((m) => m.fecha < fecha) ?? null,
      lista,
    };
  }

  async function guardar({ fecha, valores, fotosTomadas, nota }) {
    const existente = (await repos.medidas.porFecha(fecha))[0];
    const registro = registroDeMedida({
      id: existente?.id,
      fecha,
      semanaISO: semanaISO(deTexto(fecha)),
      valores,
      fotosTomadas,
      nota,
    });
    await repos.medidas.guardar(registro);
    return registro;
  }

  return { datos, guardar };
}
