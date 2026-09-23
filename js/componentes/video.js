// Pantalla: video del ejercicio (encargo, sección 8).
//   Resuelto y embebible → se muestra dentro de la app.
//   Resuelto pero no embebible, o sin resolver → botón que abre la página en el navegador.
//   Sin liga → nada.
// Caída automática: si el video no carga en unos segundos, aparece solo el
// botón de abrir en el navegador. Sin internet se avisa en vez de un cuadro en blanco.

import { h } from './dom.js';

const ESPERA_MS = 6000;

export function crearVideo({ liga, entrada }) {
  if (!liga) return null;
  const abrir = h(
    'a',
    { class: 'boton secundario video-abrir', href: liga, target: '_blank', rel: 'noopener noreferrer' },
    'Ver el video en el navegador ↗',
  );
  const contenedor = h('div', { class: 'video' });

  const tipo = entrada?.tipo;
  const embebible = Boolean(entrada?.video) && entrada.videoEmbebible === true && ['mp4', 'webm', 'youtube', 'vimeo', 'imagen'].includes(tipo);
  if (!embebible) {
    contenedor.append(abrir);
    return contenedor;
  }
  if (!navigator.onLine) {
    contenedor.append(h('p', { class: 'nota' }, 'Sin internet: el video no carga. Lo demás funciona igual.'), abrir);
    return contenedor;
  }

  let medio;
  let eventoListo = 'load';
  if (tipo === 'mp4' || tipo === 'webm') {
    medio = h('video', { src: entrada.video, playsinline: true, loop: true, autoplay: true, preload: 'auto', class: 'video-medio' });
    medio.muted = true; // requisito para que arranque solo
    eventoListo = 'loadeddata';
  } else if (tipo === 'imagen') {
    medio = h('img', { src: entrada.video, alt: 'Demostración del ejercicio', class: 'video-medio' });
  } else {
    // YouTube en modo de privacidad mejorada: no deja cookies hasta que se reproduce.
    const src = tipo === 'youtube' ? entrada.video.replace('://www.youtube.com/embed/', '://www.youtube-nocookie.com/embed/') : entrada.video;
    medio = h('iframe', {
      src,
      class: 'video-medio',
      title: 'Video del ejercicio',
      allow: 'autoplay; encrypted-media; picture-in-picture',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
  }

  let listo = false;
  const caer = () => {
    if (!abrir.isConnected) contenedor.append(abrir);
  };
  medio.addEventListener(eventoListo, () => {
    listo = true;
  }, { once: true });
  medio.addEventListener('error', () => {
    medio.remove();
    caer();
  });
  setTimeout(() => {
    if (!listo) caer();
  }, ESPERA_MS);

  contenedor.append(medio);
  return contenedor;
}
