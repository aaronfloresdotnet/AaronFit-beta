// Pantalla: arranque de la app, ruteo entre vistas y registro del service worker.
// Cada vista exporta montar(contenedor, parámetros, app) y puede devolver una
// función de limpieza. La pantalla recibe los servicios; nunca toca la base.

import { CONFIG } from './config.js';
import { crearAvisos } from './componentes/aviso.js';
import { crearCronometro } from './componentes/cronometro.js';
import { h, pintar } from './componentes/dom.js';
import { crearTemporizadorSerie } from './componentes/temporizador-serie.js';
import { registrarServiceWorker } from './plataforma/actualizacion.js';
import * as almacenamiento from './plataforma/almacenamiento.js';
import * as archivos from './plataforma/archivos.js';
import * as errores from './plataforma/errores.js';
import { crearPantallaDespierta } from './plataforma/pantalla.js';
import { crearAlarma } from './plataforma/sonido.js';
import { crearVoz } from './plataforma/voz.js';
import { servicios } from './servicios/contenedor.js';
import * as vistaAvance from './vistas/avance.js';
import * as vistaDia from './vistas/dia.js';
import * as vistaEjercicio from './vistas/ejercicio.js';
import * as vistaEquipo from './vistas/equipo.js';
import * as vistaRutina from './vistas/rutina.js';
import * as vistaInicio from './vistas/inicio.js';
import * as vistaMedidas from './vistas/medidas.js';
import * as vistaRespaldo from './vistas/respaldo.js';

const RUTAS = [
  { patron: /^#\/?$/, vista: vistaInicio, seccion: 'entrenar' },
  { patron: /^#\/dia\/(\d+)$/, vista: vistaDia, seccion: 'entrenar', entrenando: true },
  { patron: /^#\/ejercicio\/(\d+)\/(\d+)$/, vista: vistaEjercicio, seccion: 'entrenar', entrenando: true },
  { patron: /^#\/avance$/, vista: vistaAvance, seccion: 'avance' },
  { patron: /^#\/medidas$/, vista: vistaMedidas, seccion: 'medidas' },
  { patron: /^#\/respaldo$/, vista: vistaRespaldo, seccion: 'respaldo' },
  { patron: /^#\/equipo$/, vista: vistaEquipo, seccion: 'respaldo' },
  { patron: /^#\/rutina$/, vista: vistaRutina, seccion: 'respaldo' },
];

errores.escucharErrores();

const principal = document.getElementById('principal');
const alarma = crearAlarma();

// La beta se ve distinta (color ámbar e insignia) para no confundirla con la real.
document.body.dataset.variante = CONFIG.variante;
document.title = CONFIG.nombre;

const app = {
  config: CONFIG,
  servicios,
  alarma,
  archivos,
  almacenamiento,
  errores,
  cronometro: crearCronometro({ alarma }),
  temporizadorSerie: crearTemporizadorSerie({ alarma }),
  pantalla: crearPantallaDespierta(),
  aviso: crearAvisos(),
  voz: crearVoz(),
  // Se leen al arrancar; la pantalla de equipo las cambia.
  preferencias: { voz: false, respiracion: true }, // las iniciales de servicios/ajustes.js, mientras cargan
  // Valores de una serie recién deshecha, para volver a mostrarlos en su tarjeta.
  borrador: null,
  ir(ruta, { reemplazar = false } = {}) {
    if (location.hash === ruta) mostrar();
    else if (reemplazar) location.replace(ruta);
    else location.hash = ruta;
  },
  refrescar: () => mostrar(),
  noEncontrado: () => app.ir('#/', { reemplazar: true }),
  error(error) {
    console.error(error);
    errores.registrarError(error, 'app');
    app.aviso(`Algo falló: ${error?.message ?? error}`, 5000);
  },
};

let turno = 0;
let limpiar = null;
let recargaPendiente = false;

async function mostrar() {
  const miTurno = ++turno;
  const hash = location.hash || '#/';
  const ruta = RUTAS.find((r) => r.patron.test(hash));
  if (!ruta) return app.ir('#/', { reemplazar: true });
  // Una versión nueva de la app se aplica al volver al inicio, nunca a media serie.
  if (recargaPendiente && ruta.vista === vistaInicio) return location.reload();

  try {
    limpiar?.();
  } catch (error) {
    console.error(error);
  }
  limpiar = null;
  if (!ruta.entrenando) app.pantalla.desactivar();
  document.body.classList.toggle('entrenando', Boolean(ruta.entrenando));
  for (const enlace of document.querySelectorAll('.barra-inferior a')) {
    enlace.classList.toggle('activa', enlace.dataset.seccion === ruta.seccion);
  }

  // Cada navegación dibuja en su propio contenedor; si otra empezó mientras
  // esta cargaba datos, esta se descarta sin tocar la pantalla.
  const contenedor = h('div', { class: 'vista' });
  try {
    const resultado = await ruta.vista.montar(contenedor, hash.match(ruta.patron).slice(1), app);
    if (miTurno !== turno) return;
    limpiar = typeof resultado === 'function' ? resultado : null;
    pintar(principal, contenedor);
    window.scrollTo(0, 0);
  } catch (error) {
    if (miTurno !== turno) return;
    console.error(error);
    errores.registrarError(error, `vista ${hash}`);
    pintar(
      principal,
      h(
        'section',
        { class: 'tarjeta error' },
        h('h1', {}, 'Algo falló'),
        h('p', {}, error?.message ?? String(error)),
        h('button', { type: 'button', class: 'boton', onclick: () => mostrar() }, 'Reintentar'),
      ),
    );
  }
}

async function arrancar() {
  try {
    await servicios.prepararRutina();
  } catch (error) {
    pintar(
      principal,
      h(
        'section',
        { class: 'tarjeta error' },
        h('h1', {}, 'No se pudo abrir la base de datos'),
        h('p', {}, error?.message ?? String(error)),
        h('p', { class: 'nota' }, 'Cierra otras pestañas de la app y vuelve a abrirla.'),
      ),
    );
    return;
  }
  try {
    app.preferencias = await servicios.ajustes.preferencias();
  } catch (error) {
    errores.registrarError(error, 'preferencias');
  }
  almacenamiento.pedirPersistencia();
  registrarServiceWorker({
    alHaberNuevaVersion: () => {
      const enInicio = !location.hash || location.hash === '#/';
      if (enInicio && !app.cronometro.activo) location.reload();
      else recargaPendiente = true;
    },
  });
  window.addEventListener('hashchange', mostrar);
  window.addEventListener('unhandledrejection', (evento) => {
    console.error(evento.reason);
    app.aviso(`Algo falló: ${evento.reason?.message ?? evento.reason}`, 5000);
  });
  mostrar();
}

arrancar();
