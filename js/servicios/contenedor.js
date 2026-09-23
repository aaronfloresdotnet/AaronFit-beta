// Raíz de composición: aquí, y solo aquí, se conectan los servicios con los
// repositorios reales. La pantalla recibe `servicios` y nunca ve la base.

import * as repos from '../datos/repos.js';
import { cargarVideos } from '../datos/videos.js';
import { registrarError } from '../plataforma/errores.js';
import { crearServicioAjustes } from './ajustes.js';
import { prepararRutina } from './arranque.js';
import { crearServicioAvance } from './avance.js';
import { crearServicioEntrenamiento } from './entrenamiento.js';
import { crearServicioMedidas } from './medidas.js';
import { crearServicioPlan } from './plan.js';
import { crearServicioRespaldo } from './respaldo.js';

const reloj = () => new Date();

// Un extra que falla (p. ej. revisar si hubo récord) se anota en el registro de errores y no detiene nada.
const entrenamiento = crearServicioEntrenamiento({ repos, reloj, alFallar: registrarError });

export const servicios = {
  prepararRutina,
  entrenamiento,
  ajustes: crearServicioAjustes({ repos }),
  avance: crearServicioAvance({ repos, reloj }),
  // Tanda 4: cambiar de rutina. Tras programar una, la rutina en memoria se vuelve a leer.
  plan: crearServicioPlan({
    repos,
    reloj,
    ligasConVideo: async () => Object.keys(await cargarVideos()),
    despuesDeCambiar: () => entrenamiento.olvidarRutina(),
  }),
  medidas: crearServicioMedidas({ repos, reloj }),
  respaldo: crearServicioRespaldo({
    repos,
    reloj,
    despuesDeImportar: async () => {
      await prepararRutina();
      entrenamiento.olvidarRutina();
    },
  }),
  videos: {
    async de(liga) {
      if (!liga) return null;
      return (await cargarVideos())[liga] ?? null;
    },
  },
  contar: repos.contar,
};
