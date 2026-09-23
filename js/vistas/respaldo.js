// Pantalla: Respaldo (encargo 6.7 y sección 7). Exportar todo a un archivo.
// Importar REEMPLAZA todo: primero se revisa el archivo, luego se advierte con
// los conteos y se pide una confirmación que no se pica de pasada.

import { h, pintar } from '../componentes/dom.js';
import { fechaCorta } from '../logica/formato.js';
import { aTexto, diasEntre, fechaLocal } from '../logica/semana.js';

const cuantos = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

const NOMBRES = {
  rutina: 'Renglones de rutina',
  sesiones: 'Sesiones',
  series: 'Series',
  medidas: 'Medidas',
  estado: 'Ajustes y avisos',
};

export async function montar(raiz, _parametros, app) {
  const [ultimo, persistente, actuales] = await Promise.all([
    app.servicios.respaldo.ultimo(),
    app.almacenamiento.estaPersistido(),
    app.servicios.contar(),
  ]);
  let texto = null;
  let revision = null;
  let resultado = null;
  let textoErrores = null; // si el portapapeles falla, se muestra para copiarlo a mano

  render();

  function haceCuanto(iso) {
    const fecha = fechaLocal(new Date(iso));
    const dias = diasEntre(fecha, fechaLocal());
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
    return { texto: `${cuando} (${fechaCorta(aTexto(fecha))})`, dias };
  }

  function render() {
    const hace = ultimo ? haceCuanto(ultimo) : null;
    pintar(
      raiz,
      h('h1', { class: 'titulo-seccion' }, 'Respaldo'),
      h(
        'section',
        { class: 'tarjeta' },
        h('p', {}, 'Tus datos viven solo en este teléfono. Si borras los datos del navegador o desinstalas la app, se pierden. Exporta seguido y guarda el archivo donde quieras.'),
        h(
          'p',
          { class: !hace || hace.dias > 7 ? 'nota aviso' : 'nota' },
          hace ? `Último respaldo: ${hace.texto}.` : 'Todavía no has hecho ningún respaldo.',
        ),
        h(
          'p',
          { class: 'nota' },
          `Ahora hay ${cuantos(actuales.sesiones, 'sesión', 'sesiones')}, ${cuantos(actuales.series, 'serie', 'series')} y ${cuantos(actuales.medidas, 'medición', 'mediciones')}.`,
        ),
        h(
          'p',
          { class: 'nota' },
          persistente
            ? 'El navegador tiene estos datos como persistentes: no los borra por falta de espacio.'
            : 'El navegador todavía no tiene estos datos como persistentes (suele cambiar al instalar la app).',
        ),
        h('button', { type: 'button', class: 'boton primario enorme', onclick: exportar }, 'Exportar respaldo'),
      ),
      h(
        'section',
        { class: 'tarjeta' },
        h('h2', {}, 'Importar'),
        h('p', {}, 'Importar REEMPLAZA todo lo que hay en la app. No mezcla.'),
        resultado ? bloqueResultado() : revision ? bloqueRevision() : selector(),
      ),
      bloqueErrores(),
    );
  }

  function bloqueErrores() {
    const lista = app.errores.leerErrores();
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'Errores de la app'),
      lista.length
        ? [
            h('p', {}, `${cuantos(lista.length, 'error registrado', 'errores registrados')}. El último: ${formatearHora(lista.at(-1).hora)}.`),
            h('p', { class: 'nota' }, 'Copia la lista y pégasela a Claude tal cual: trae la versión, el teléfono y dónde pasó cada error.'),
            h(
              'div',
              { class: 'botones-fila' },
              h('button', { type: 'button', class: 'boton primario', onclick: copiarErrores }, 'Copiar para Claude'),
              h('button', { type: 'button', class: 'boton', onclick: borrarErrores }, 'Borrar lista'),
            ),
            textoErrores ? h('textarea', { class: 'entrada-nota', rows: '8', readonly: true }, textoErrores) : null,
          ]
        : h('p', { class: 'nota' }, 'Sin errores registrados.'),
    );
  }

  function formatearHora(iso) {
    const instante = new Date(iso);
    return `${fechaCorta(aTexto(fechaLocal(instante)))} ${String(instante.getHours()).padStart(2, '0')}:${String(instante.getMinutes()).padStart(2, '0')}`;
  }

  async function copiarErrores() {
    const contenido = app.errores.textoParaClaude();
    try {
      await navigator.clipboard.writeText(contenido);
      app.aviso('Copiado: pégalo en tu chat con Claude', 3500);
    } catch {
      textoErrores = contenido;
      render();
      app.aviso('No pude copiar solo: selecciona el texto y cópialo', 4000);
    }
  }

  function borrarErrores() {
    app.errores.borrarErrores();
    textoErrores = null;
    render();
  }

  async function exportar() {
    try {
      const { nombre, texto: contenido } = await app.servicios.respaldo.exportar();
      app.archivos.descargar(nombre, contenido);
      app.aviso(`Exportado: ${nombre}`, 4000);
      app.refrescar();
    } catch (error) {
      app.error(error);
    }
  }

  function selector() {
    const entrada = h('input', { type: 'file', accept: '.json,application/json', class: 'oculto', onchange: elegir });
    return h('label', { class: 'boton ancho' }, entrada, 'Elegir archivo de respaldo…');
  }

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    texto = await app.archivos.leerTexto(archivo);
    revision = await app.servicios.respaldo.revisar(texto);
    render();
  }

  function cancelar() {
    texto = null;
    revision = null;
    render();
  }

  function bloqueRevision() {
    if (!revision.ok) {
      return h(
        'div',
        { class: 'revision' },
        h('p', { class: 'error' }, revision.error),
        h('button', { type: 'button', class: 'boton', onclick: cancelar }, 'Elegir otro archivo'),
      );
    }
    const exportado = revision.exportado ? ` del ${fechaCorta(aTexto(fechaLocal(new Date(revision.exportado))))}` : '';
    const confirmar = h('input', { type: 'checkbox' });
    const reemplazar = h('button', { type: 'button', class: 'boton peligro enorme', disabled: true, onclick: importar }, 'Reemplazar todo');
    confirmar.addEventListener('change', () => {
      reemplazar.disabled = !confirmar.checked;
    });
    return h(
      'div',
      { class: 'revision' },
      h('p', { class: 'advertencia' }, h('strong', {}, 'Esto BORRA todo lo que hay ahora en la app'), ` y lo reemplaza con el respaldo${exportado}.`),
      tablaConteos(revision.actuales, revision.conteos),
      h('label', { class: 'interruptor' }, confirmar, h('span', {}, h('strong', {}, 'Entiendo que se borra todo lo actual'))),
      reemplazar,
      h('button', { type: 'button', class: 'enlace', onclick: cancelar }, 'Cancelar'),
    );
  }

  function tablaConteos(ahora, archivo) {
    return h(
      'table',
      { class: 'conteos' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Ahora'), h('th', {}, 'En el archivo'))),
      h('tbody', {}, Object.keys(NOMBRES).map((c) => h('tr', {}, h('th', {}, NOMBRES[c]), h('td', {}, ahora[c]), h('td', {}, archivo[c])))),
    );
  }

  async function importar(evento) {
    evento.currentTarget.disabled = true;
    try {
      resultado = await app.servicios.respaldo.importar(texto);
    } catch (error) {
      resultado = { ok: false, error: `Falló la importación: ${error.message ?? error}` };
    }
    render();
  }

  function bloqueResultado() {
    if (!resultado.ok) {
      return h('div', {}, h('p', { class: 'error' }, resultado.error), h('button', { type: 'button', class: 'boton', onclick: () => { resultado = null; cancelar(); } }, 'Volver'));
    }
    return h(
      'div',
      {},
      h('p', {}, h('strong', {}, 'Listo. Entraron:')),
      h('ul', { class: 'lista-conteos' }, Object.keys(NOMBRES).map((c) => h('li', {}, `${NOMBRES[c]}: ${resultado.entraron[c]}`))),
      h('button', { type: 'button', class: 'boton primario enorme', onclick: () => location.replace('./') }, 'Volver a la app'),
    );
  }
}
