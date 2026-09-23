// Pantalla: Medidas (encargo 6.6). Pantalla aparte, con su propia fecha.
// Peso, cintura, cadera y cuello siempre a la vista; lo demás en una sección
// plegada. Las fotos se quedan en la galería: aquí solo se anota que se tomaron.

import { h, pintar } from '../componentes/dom.js';
import { crearSpinner } from '../componentes/spinner.js';
import { fechaCorta, numero } from '../logica/formato.js';
import { CAMPOS_MEDIDA } from '../logica/medidas.js';

// Punto de partida del "+" cuando un campo nunca se ha medido (luego se escribe o ajusta).
const INICIO_SI_VACIO = {
  pesoCorporal: 80, cintura: 90, cadera: 100, cuello: 40, pecho: 100, musloIzq: 55, musloDer: 55,
  pantorrillaIzq: 38, pantorrillaDer: 38, brazoIzq: 33, brazoDer: 33, antebrazoIzq: 28, antebrazoDer: 28,
};

const conAnio = (fecha) => `${fechaCorta(fecha)} ${fecha.slice(0, 4)}`;

export async function montar(raiz, _parametros, app) {
  await cargar();

  async function cargar(fecha) {
    render(await app.servicios.medidas.datos(fecha));
  }

  function render(d) {
    const base = d.deLaFecha; // si ya hay medición de esa fecha, se corrige
    const previa = d.anterior; // la anterior, para precargar
    const controles = new Map();
    const control = (c) => {
      const valorPrevio = previa?.[c.campo] ?? null;
      const valor = base ? base[c.campo] : c.principal ? valorPrevio : null;
      const spinner = crearSpinner({
        etiqueta: c.etiqueta,
        valor,
        paso: c.paso,
        sufijo: c.unidad,
        nulo: true,
        inicialSiNulo: valorPrevio ?? INICIO_SI_VACIO[c.campo],
      });
      controles.set(c.campo, spinner);
      return spinner.elemento;
    };

    const principales = CAMPOS_MEDIDA.filter((c) => c.principal);
    const extras = CAMPOS_MEDIDA.filter((c) => !c.principal);
    const hayExtras = Boolean(base) && extras.some((c) => base[c.campo] !== null);
    const fecha = h('input', {
      type: 'date',
      class: 'entrada-fecha',
      value: d.fecha,
      max: d.hoy,
      onchange: (evento) => evento.target.value && cargar(evento.target.value),
    });
    const fotos = h('input', { type: 'checkbox', checked: Boolean(base?.fotosTomadas) });
    const nota = h('textarea', { class: 'entrada-nota', rows: '2', placeholder: 'Nota (opcional)' }, base?.nota ?? '');

    pintar(
      raiz,
      h('h1', { class: 'titulo-seccion' }, 'Medidas'),
      h('label', { class: 'campo-fecha' }, h('span', {}, 'Fecha'), fecha),
      base
        ? h('p', { class: 'nota' }, 'Ya hay una medición de esta fecha: al guardar se corrige.')
        : previa
          ? h('p', { class: 'nota' }, `Precargado con tu medición del ${conAnio(previa.fecha)}. Corrige lo que cambió.`)
          : null,
      h('div', { class: 'grupo-controles' }, principales.map(control)),
      h(
        'details',
        { class: 'mas-medidas', open: hayExtras },
        h('summary', {}, 'Más medidas: pecho, muslos, pantorrillas, brazos y antebrazos'),
        h('div', { class: 'grupo-controles' }, extras.map(control)),
      ),
      h(
        'label',
        { class: 'interruptor' },
        fotos,
        h(
          'span',
          {},
          h('strong', {}, 'Fotos tomadas'),
          h('small', {}, 'Frente, perfil y espalda, con la cámara del teléfono. Se quedan en tu galería; aquí solo se anota.'),
        ),
      ),
      nota,
      h('button', { type: 'button', class: 'boton primario enorme', onclick: guardar }, 'Guardar medidas'),
      historial(d.lista),
    );

    async function guardar() {
      try {
        const valores = Object.fromEntries([...controles].map(([campo, spinner]) => [campo, spinner.valor]));
        await app.servicios.medidas.guardar({ fecha: d.fecha, valores, fotosTomadas: fotos.checked, nota: nota.value });
        app.aviso('Medidas guardadas');
        await cargar(d.fecha);
      } catch (error) {
        app.error(error);
      }
    }
  }

  function historial(lista) {
    if (!lista.length) return h('p', { class: 'nota' }, 'Aún no hay medidas guardadas.');
    return h(
      'section',
      { class: 'bloque' },
      h('h2', { class: 'subtitulo' }, 'Historial'),
      h(
        'ol',
        { class: 'historial' },
        lista.map((m) => {
          const resumen = [
            m.pesoCorporal === null ? null : `${numero(m.pesoCorporal)} kg`,
            m.cintura === null ? null : `cintura ${numero(m.cintura)} cm`,
          ].filter(Boolean).join(' · ');
          return h(
            'li',
            {},
            h(
              'button',
              { type: 'button', class: 'fila-historial', onclick: () => cargar(m.fecha) },
              h('span', { class: 'historial-fecha' }, conAnio(m.fecha)),
              h('span', { class: 'historial-valores' }, resumen || '—'),
              m.fotosTomadas ? h('span', { class: 'insignia' }, 'fotos') : null,
            ),
          );
        }),
      ),
    );
  }
}
