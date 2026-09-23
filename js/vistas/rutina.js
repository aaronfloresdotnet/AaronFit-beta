// Pantalla: cambiar de rutina (tanda 4). Tres pasos: escribes qué quieres, la
// app arma el prompt y lo copias a Claude o Gemini, y pegas su respuesta. La
// app la revisa renglón por renglón, te muestra qué cambia y la programa desde
// el lunes siguiente. Hasta entonces sigues con tu rutina actual.

import { preguntar } from '../componentes/dialogo.js';
import { h, pintar } from '../componentes/dom.js';
import { fechaCorta, partesDia } from '../logica/formato.js';
import { aTexto, lunesDeSemana } from '../logica/semana.js';

const lunesDe = (semana) => fechaCorta(aTexto(lunesDeSemana(semana)));

export async function montar(raiz, _parametros, app) {
  let situacion = await app.servicios.plan.situacion();
  let queQuiero = '';
  let conMedidas = true;
  let prompt = null;
  let respuesta = '';
  let revision = null;
  let listo = null;

  render();

  function render() {
    pintar(
      raiz,
      h(
        'nav',
        { class: 'barra-superior' },
        h('a', { class: 'boton-icono', href: '#/respaldo', 'aria-label': 'Volver' }, '‹'),
        h('div', { class: 'barra-titulo' }, h('strong', {}, 'Cambiar de rutina')),
        h('span', { class: 'boton-icono vacio' }),
      ),
      tarjetaActual(),
      listo ? tarjetaListo() : [paso1(), prompt ? paso2() : null, prompt ? paso3() : null, revision ? tarjetaRevision() : null],
    );
  }

  function listaDias(dias) {
    return h(
      'ul',
      { class: 'lista-dias' },
      dias.map((d) => {
        const partes = partesDia(d.dia);
        return h('li', {}, h('strong', {}, partes.dia), ` · ${partes.nombre} · ${d.ejercicios} ${d.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}`);
      }),
    );
  }

  function tarjetaActual() {
    const { vigente, programado } = situacion;
    return [
      h(
        'section',
        { class: 'tarjeta' },
        h('div', { class: 'etiqueta' }, 'Tu rutina ahora'),
        h('h2', {}, vigente.nombre ?? `Rutina ${vigente.numero}`),
        vigente.desde ? h('p', { class: 'sub' }, `Desde el lunes ${lunesDe(vigente.desde)}.`) : null,
        listaDias(vigente.dias),
      ),
      programado
        ? h(
            'section',
            { class: 'tarjeta tarjeta-pregunta' },
            h('div', { class: 'etiqueta aviso' }, 'Programada'),
            h('h2', {}, `${programado.nombre}: empieza el lunes ${lunesDe(programado.desde)}`),
            listaDias(programado.dias),
            h('button', { type: 'button', class: 'boton', onclick: quitar }, 'Quitar la programada'),
          )
        : null,
    ];
  }

  function paso1() {
    const texto = h('textarea', {
      class: 'entrada-nota',
      rows: '4',
      placeholder: 'Por ejemplo: quiero entrenar 3 días de 45 minutos, cuidar el hombro y seguir con press de banca.',
      oninput: (evento) => {
        queQuiero = evento.target.value;
      },
    }, queQuiero);
    const medidas = h('input', {
      type: 'checkbox',
      checked: conMedidas,
      onchange: (evento) => {
        conMedidas = evento.target.checked;
      },
    });
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, '1. ¿Qué quieres?'),
      texto,
      h('label', { class: 'interruptor' }, medidas, h('span', {}, h('strong', {}, 'Incluir mis medidas'), h('small', {}, 'Peso, cintura y % de grasa estimado. Van solo en el texto que tú copias.'))),
      h('button', { type: 'button', class: 'boton primario ancho', onclick: armar }, prompt ? 'Volver a armar el prompt' : 'Armar el prompt'),
    );
  }

  async function armar() {
    try {
      prompt = (await app.servicios.plan.prompt({ queQuiero, conMedidas })).texto;
      revision = null;
      render();
    } catch (error) {
      app.error(error);
    }
  }

  function paso2() {
    const area = h('textarea', { class: 'entrada-nota prompt', rows: '10', readonly: true }, prompt);
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, '2. Cópialo en Claude o Gemini'),
      h('p', { class: 'nota' }, 'Lleva tu rutina, tu equipo, cómo te ha ido y el formato exacto que la app necesita.'),
      area,
      h('button', { type: 'button', class: 'boton primario ancho', onclick: () => copiar(area) }, 'Copiar el prompt'),
    );
  }

  async function copiar(area) {
    try {
      await navigator.clipboard.writeText(prompt);
      app.aviso('Copiado: pégalo en Claude o Gemini', 3500);
    } catch {
      area.focus();
      area.select();
      app.aviso('No pude copiar solo: el texto quedó seleccionado, cópialo tú', 4500);
    }
  }

  function paso3() {
    const area = h('textarea', {
      class: 'entrada-nota',
      rows: '6',
      placeholder: 'Pega aquí TODA la respuesta.',
      oninput: (evento) => {
        respuesta = evento.target.value;
      },
    }, respuesta);
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, '3. Pega la respuesta'),
      area,
      h('button', { type: 'button', class: 'boton primario ancho', onclick: revisar }, 'Revisar'),
    );
  }

  async function revisar() {
    try {
      revision = await app.servicios.plan.revisar(respuesta);
      render();
      raiz.querySelector('.revision-rutina')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) {
      app.error(error);
    }
  }

  function tarjetaRevision() {
    if (!revision.ok) {
      return h(
        'section',
        { class: 'tarjeta error revision-rutina' },
        h('h2', {}, 'La respuesta no se puede usar todavía'),
        h('ul', { class: 'lista-errores' }, revision.errores.map((e) => h('li', {}, e))),
        h('p', { class: 'nota' }, 'Pídele a la IA que corrija esos renglones y respete el formato; luego pega la respuesta nueva. No se guardó nada.'),
      );
    }
    const { resumen, diferencias: d } = revision;
    const bloque = (titulo, lineas) => (lineas.length ? [h('h3', { class: 'titulo-grafica' }, titulo), h('ul', { class: 'lista-cambios' }, lineas.map((l) => h('li', {}, l)))] : null);
    return h(
      'section',
      { class: 'tarjeta revision-rutina' },
      h('div', { class: 'etiqueta' }, 'Revisada'),
      h('h2', {}, `Rutina ${revision.numero}: empieza el lunes ${lunesDe(revision.desde)}`),
      h(
        'p',
        { class: 'sub' },
        `${resumen.diasFuerza} ${resumen.diasFuerza === 1 ? 'día' : 'días'} de fuerza${resumen.diasCaminata ? ` y ${resumen.diasCaminata} de caminata` : ''} · ${resumen.ejercicios} ejercicios · ${resumen.seriesSemana} series por semana.`,
      ),
      listaDias(resumen.dias),
      revision.reemplaza ? h('p', { class: 'nota aviso' }, `Reemplaza a la ${revision.reemplaza.nombre}, que todavía no empieza.`) : null,
      bloque(`Nuevos (${d.nuevos.length}): empiezan sin historial`, d.nuevos),
      bloque(`Cambian (${d.cambian.length}): conservan su historial`, d.cambian.map((c) => `${c.ejercicio}: ${c.cambios.join('; ')}`)),
      bloque(`Salen (${d.salen.length})`, d.salen),
      d.iguales.length ? h('p', { class: 'nota' }, `Iguales (${d.iguales.length}): ${d.iguales.join(', ')}.`) : null,
      bloque('Avisos', revision.avisos),
      h('p', { class: 'nota' }, 'Tu rutina actual sigue hasta el domingo; tu historial no se borra.'),
      h('button', { type: 'button', class: 'boton primario enorme', onclick: programar }, `Programar desde el lunes ${lunesDe(revision.desde)}`),
    );
  }

  async function programar(evento) {
    evento.currentTarget.disabled = true;
    try {
      const resultado = await app.servicios.plan.programar(respuesta);
      if (!resultado.ok) {
        revision = resultado;
      } else {
        listo = resultado;
        situacion = await app.servicios.plan.situacion();
      }
      render();
      window.scrollTo(0, 0);
    } catch (error) {
      app.error(error);
      render();
    }
  }

  function tarjetaListo() {
    return h(
      'section',
      { class: 'tarjeta tarjeta-hoy hecho' },
      h('div', { class: 'etiqueta' }, 'Listo'),
      h('h2', {}, `Tu Rutina ${listo.numero} empieza el lunes ${lunesDe(listo.desde)}.`),
      h('p', { class: 'sub' }, 'Hasta entonces sigues con la actual. Si te arrepientes antes del lunes, aquí mismo la puedes quitar.'),
      h('a', { class: 'boton primario', href: '#/' }, 'Volver al inicio'),
    );
  }

  async function quitar() {
    const ok = await preguntar({
      titulo: '¿Quitar la rutina programada?',
      cuerpo: 'Se borra la rutina que todavía no empieza. Tu rutina actual y tu historial no cambian.',
      botones: [
        { etiqueta: 'Cancelar', valor: false },
        { etiqueta: 'Quitar', valor: true, clase: 'peligro' },
      ],
    });
    if (!ok) return;
    try {
      const resultado = await app.servicios.plan.quitarProgramada();
      if (!resultado.ok) app.aviso(resultado.error, 4000);
      else app.aviso('Rutina programada quitada');
      situacion = await app.servicios.plan.situacion();
      listo = null;
      render();
    } catch (error) {
      app.error(error);
    }
  }
}
