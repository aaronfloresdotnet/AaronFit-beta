// Service worker de AaronFit (encargo, sección 10).
// - Archivos propios de la app: primero caché, para que abra sin internet.
// - Todo lo externo (videos): no se toca; va directo a la red.
// - NUNCA toca IndexedDB: los datos del usuario no pasan por aquí.
// Al cambiar VERSION se instala la caché nueva y se borra la vieja; solo se
// borran cachés con el mismo PREFIJO (la beta usa otro y no se tocan entre sí).

// <archivos> — generado por herramientas/versionar-sw.js; no editar a mano.
const PREFIJO = 'beta-aaronfit-';
const VERSION = 'beta-aaronfit-c444f4e5fe6a';
const ARCHIVOS = [
  './',
  './css/estilos.css',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  './index.html',
  './js/app.js',
  './js/componentes/aviso.js',
  './js/componentes/cronometro.js',
  './js/componentes/dialogo.js',
  './js/componentes/dom.js',
  './js/componentes/grafica.js',
  './js/componentes/spinner.js',
  './js/componentes/temporizador-serie.js',
  './js/componentes/video.js',
  './js/config.js',
  './js/datos/db.js',
  './js/datos/repos.js',
  './js/datos/semilla.js',
  './js/datos/videos.js',
  './js/datos/videos.json',
  './js/logica/avance.js',
  './js/logica/cuerpo.js',
  './js/logica/dias.js',
  './js/logica/equipo.js',
  './js/logica/escala.js',
  './js/logica/formato.js',
  './js/logica/frases.js',
  './js/logica/medidas.js',
  './js/logica/nombres.js',
  './js/logica/parseo.js',
  './js/logica/plan.js',
  './js/logica/progresion.js',
  './js/logica/prompt.js',
  './js/logica/referencia.js',
  './js/logica/respaldo.js',
  './js/logica/semana.js',
  './js/logica/temporizador.js',
  './js/plataforma/actualizacion.js',
  './js/plataforma/almacenamiento.js',
  './js/plataforma/archivos.js',
  './js/plataforma/errores.js',
  './js/plataforma/pantalla.js',
  './js/plataforma/sonido.js',
  './js/plataforma/voz.js',
  './js/servicios/ajustes.js',
  './js/servicios/arranque.js',
  './js/servicios/avance.js',
  './js/servicios/contenedor.js',
  './js/servicios/entrenamiento.js',
  './js/servicios/medidas.js',
  './js/servicios/plan.js',
  './js/servicios/respaldo.js',
  './js/vistas/avance.js',
  './js/vistas/dia.js',
  './js/vistas/ejercicio.js',
  './js/vistas/equipo.js',
  './js/vistas/inicio.js',
  './js/vistas/medidas.js',
  './js/vistas/respaldo.js',
  './js/vistas/rutina.js',
  './manifest.webmanifest',
];
// </archivos>

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith(PREFIJO) && n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return; // externo: red

  if (request.mode === 'navigate') {
    // Cualquier apertura de la app sirve la misma página (la ruta va en el #).
    evento.respondWith(caches.match('./index.html').then((guardada) => guardada ?? fetch(request)));
    return;
  }
  evento.respondWith(
    caches.match(request, { ignoreSearch: true }).then((guardada) => guardada ?? fetch(request)),
  );
});
