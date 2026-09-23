// Capa de aplicación: medidas corporales (encargo 6.6). Una medición por fecha;
// guardar otra vez la misma fecha la corrige. Tanda 2: perfil (estatura y
// fórmula), % de grasa estimado, cintura/estatura, comparación y fotos.

import { cinturaEstatura, comparar, FORMULAS, fotosPendientes, grasaMarina, medicionDeComparacion, serieDeCampo } from '../logica/cuerpo.js';
import { registroDeMedida } from '../logica/medidas.js';
import { aTexto, deTexto, fechaLocal, semanaISO } from '../logica/semana.js';

/**
 * Lo que se calcula de la lista (de la más nueva a la más vieja) con el perfil.
 * Cada número dice de qué fecha es: la última medición puede no traer todo.
 */
function analizar(lista, perfil, hoy) {
  const grasaDe = (m) =>
    perfil && m ? grasaMarina({ formula: perfil.formula, estatura: perfil.estatura, cintura: m.cintura, cuello: m.cuello, cadera: m.cadera }) : null;
  const conGrasa = lista.find((m) => grasaDe(m) !== null) ?? null;
  const conCintura = perfil ? lista.find((m) => m.cintura !== null) ?? null : null;
  const ultima = lista[0] ?? null;
  const referencia = medicionDeComparacion(lista, ultima);
  return {
    grasa: conGrasa ? { valor: grasaDe(conGrasa), fecha: conGrasa.fecha } : null,
    cinturaEstatura: conCintura ? { valor: cinturaEstatura(conCintura.cintura, perfil.estatura), fecha: conCintura.fecha } : null,
    comparacion: referencia
      ? { antes: referencia.fecha, ahora: ultima.fecha, cambios: comparar(referencia, ultima), grasa: { antes: grasaDe(referencia), ahora: grasaDe(ultima) } }
      : null,
    fotos: fotosPendientes(lista, hoy),
    peso: serieDeCampo(lista, 'pesoCorporal'),
    cintura: serieDeCampo(lista, 'cintura'),
  };
}

export function crearServicioMedidas({ repos, reloj = () => new Date() }) {
  const hoy = () => aTexto(fechaLocal(reloj()));

  /** La medición de `fecha` (si existe), la anterior a esa fecha, la lista completa, el perfil y lo calculado. */
  async function datos(fecha = hoy()) {
    const [todas, perfil] = await Promise.all([repos.medidas.todas(), repos.estado.leer('perfil')]);
    const lista = todas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return {
      hoy: hoy(),
      fecha,
      deLaFecha: lista.find((m) => m.fecha === fecha) ?? null,
      anterior: lista.find((m) => m.fecha < fecha) ?? null,
      lista,
      perfil: perfil ?? null,
      analisis: analizar(lista, perfil ?? null, hoy()),
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

  /** Estatura en cm y fórmula del % de grasa ('hombre' o 'mujer'): las elige el usuario. */
  async function guardarPerfil({ estatura, formula }) {
    if (typeof estatura !== 'number' || !(estatura >= 100 && estatura <= 250)) throw new Error('La estatura va en centímetros, entre 100 y 250.');
    if (!FORMULAS.includes(formula)) throw new Error('Elige la fórmula: hombre o mujer.');
    const perfil = { estatura, formula };
    await repos.estado.escribir('perfil', perfil);
    return perfil;
  }

  return { datos, guardar, guardarPerfil };
}
