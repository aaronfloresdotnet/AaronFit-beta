// Pantalla: un ejercicio y su captura serie por serie (encargo 6.4).
// Una tarjeta por serie, precargada. UN botón "Listo" guarda la serie, arranca
// el descanso y abre la siguiente tarjeta. Tocar una serie guardada la corrige.

import { preguntar } from '../componentes/dialogo.js';
import { h, pintar } from '../componentes/dom.js';
import { crearSpinner } from '../componentes/spinner.js';
import { crearVideo } from '../componentes/video.js';
import * as formato from '../logica/formato.js';
import { aTexto, fechaLocal } from '../logica/semana.js';
import { resultadoDeSerie } from '../logica/temporizador.js';

const PASO_PESO = { kg: 2.5, lb: 5 };
const PASO_VALOR = { reps: 1, segundos: 5, metros: 5, minutos: 1 };
const ETIQUETA_VALOR = { reps: 'Repeticiones', segundos: 'Segundos', metros: 'Metros', minutos: 'Minutos' };
const SUFIJO_VALOR = { reps: '', segundos: 's', metros: 'm', minutos: 'min' };

export async function montar(raiz, [idSesion, idRutina], app) {
  const sesionId = Number(idSesion);
  const rutinaId = Number(idRutina);
  const servicio = app.servicios.entrenamiento;
  let datos = await servicio.datosEjercicio(sesionId, rutinaId);
  if (!datos) return app.noEncontrado();
  const e = datos.ejercicio;
  const elementoVideo = crearVideo({ liga: e.liga, entrada: await app.servicios.videos.de(e.liga) });
  if (datos.sesion.estado === 'en_curso') app.pantalla.activar();

  // Los minutos se guardan en segundos; el control los muestra en minutos (a una décima).
  const aPantalla = (v) => (e.tipoMedida === 'minutos' && v !== null && v !== undefined ? Math.round((v / 60) * 10) / 10 : v ?? null);
  const aGuardar = (v) => (e.tipoMedida === 'minutos' && v !== null ? Math.round(v * 60) : v);

  // Si se acaba de deshacer una serie de este ejercicio, se reabre con sus valores.
  const borrador = app.borrador?.sesionId === sesionId && app.borrador.rutinaId === rutinaId ? app.borrador : null;
  app.borrador = null;

  // Frases del descanso (tu avance y las listas); se cargan sin detener la pantalla.
  let frases = [];
  servicio.frasesDescanso().then((lista) => {
    frases = lista;
  }, () => {});

  let abierta = borrador ? borrador.numeroSerie : primeraPendiente();
  let verVideo = datos.hoy.length === 0; // el video se ve al empezar; luego se pliega

  render();

  function primeraPendiente() {
    for (let k = 1; k <= e.series; k++) if (!datos.hoy.some((s) => s.numeroSerie === k)) return k;
    return null;
  }

  function render() {
    pintar(
      raiz,
      barra(),
      h(
        'header',
        { class: 'ejercicio-cabeza' },
        h('h1', { class: 'ejercicio-nombre' }, e.ejercicio),
        h('p', { class: 'ejercicio-meta' }, [e.grupo, e.equipo, e.accesorioPolea].filter(Boolean).join(' · ')),
        h(
          'div',
          { class: 'chips' },
          chip(`${e.series} × ${e.repsTexto}`),
          e.rir === null ? null : chip(`RIR ${e.rir}`),
          chip(e.descansoSeg ? `Descanso ${e.descansoTexto}` : 'Sin descanso'),
          e.pesoNota ? chip(e.pesoNota) : null,
          datos.implemento ? chip(`Ahora: ${datos.implemento.texto}`, 'acento') : null,
        ),
      ),
      bloqueVideo(),
      h(
        'p',
        { class: 'progresion-texto' },
        h('span', { class: 'progresion-icono', 'aria-hidden': 'true' }, '↗'),
        e.progresionTexto,
        /semana/i.test(e.progresionTexto) ? h('strong', {}, ` Vas en la semana ${datos.semanaPrograma} del programa.`) : null,
      ),
      datos.anterior ? lineaAnterior() : null,
      h('ol', { class: 'series' }, Array.from({ length: e.series }, (_, i) => tarjetaSerie(i + 1))),
      abierta === null ? pie() : null,
    );
    requestAnimationFrame(() => raiz.querySelector('.serie.abierta')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function barra() {
    const ir = (id) => () => app.ir(`#/ejercicio/${sesionId}/${id}`, { reemplazar: true });
    return h(
      'nav',
      { class: 'barra-superior' },
      h('a', { class: 'boton-icono', href: `#/dia/${sesionId}`, 'aria-label': 'Volver a la lista del día' }, '‹'),
      h('div', { class: 'barra-titulo' }, h('strong', {}, `Ejercicio ${datos.posicion} de ${datos.total}`)),
      datos.siguienteId
        ? h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Siguiente ejercicio', onclick: ir(datos.siguienteId) }, '›')
        : h('span', { class: 'boton-icono vacio' }),
    );
  }

  function chip(texto, clase = '') {
    return h('span', { class: `chip ${clase}`.trim() }, texto);
  }

  function bloqueVideo() {
    if (!elementoVideo) return null;
    if (verVideo) return elementoVideo;
    return h(
      'button',
      { type: 'button', class: 'boton secundario boton-video', onclick: () => { verVideo = true; render(); } },
      '▶ Ver video',
    );
  }

  function compacta(s) {
    const valor = formato.valor(s.valor, e.tipoMedida);
    if (s.unidadPeso === 'corporal' || s.peso === null || s.peso === undefined) return valor;
    return e.tipoMedida === 'reps' ? `${formato.numero(s.peso)}×${valor}` : `${formato.numero(s.peso)} ${s.unidadPeso} · ${valor}`;
  }

  function lineaAnterior() {
    const fecha = formato.fechaCorta(aTexto(fechaLocal(new Date(datos.anterior.hora))));
    return h('p', { class: 'anterior' }, h('span', {}, `La vez pasada (${fecha}): `), datos.anterior.series.map(compacta).join(' · '));
  }

  function resumenGuardada(guardadas) {
    if (!guardadas.some((s) => s.completada)) return 'saltada';
    const campo = e.tipoMedida === 'reps' ? 'repsHechas' : e.tipoMedida === 'metros' ? 'metros' : 'segundos';
    const base = guardadas[0];
    if (guardadas.length > 1) {
      const lados = guardadas.map((s) => `${s.lado} ${formato.valor(s[campo], e.tipoMedida)}`).join(' · ');
      const peso = formato.peso(base.peso, base.unidadPeso);
      return peso ? `${peso} · ${lados}` : lados;
    }
    return formato.serie({ peso: base.peso, unidadPeso: base.unidadPeso, pesoPorLado: false, valor: base[campo] }, e.tipoMedida);
  }

  function tarjetaSerie(k) {
    const guardadas = datos.hoy.filter((s) => s.numeroSerie === k);
    const estado = guardadas.length ? (guardadas.some((s) => s.completada) ? 'hecha' : 'saltada') : 'pendiente';
    if (abierta !== k) {
      const precarga = datos.precarga[k - 1];
      const texto = guardadas.length ? resumenGuardada(guardadas) : formato.serie(precarga, e.tipoMedida);
      return h(
        'li',
        { class: `serie ${estado}` },
        h(
          'button',
          { type: 'button', class: 'serie-resumen', onclick: () => { abierta = k; render(); } },
          h('span', { class: 'serie-marca' }, estado === 'hecha' ? '✓' : estado === 'saltada' ? '✕' : String(k)),
          h('span', { class: 'serie-titulo' }, `Serie ${k}`),
          h('span', { class: 'serie-valor' }, texto),
        ),
      );
    }
    return h('li', { class: `serie ${estado} abierta` }, formulario(k, guardadas));
  }

  function valoresIniciales(k, guardadas) {
    const precarga = datos.precarga[k - 1];
    if (!guardadas.length && borrador?.numeroSerie === k) {
      const b = borrador.borrador;
      return { ...precarga, peso: b.peso, unidadPeso: b.unidadPeso, valor: b.valor, lados: b.lados, rir: b.rir };
    }
    if (!guardadas.length) return { ...precarga, lados: null, rir: null };
    const campo = e.tipoMedida === 'reps' ? 'repsHechas' : e.tipoMedida === 'metros' ? 'metros' : 'segundos';
    const base = guardadas[0];
    const lados = guardadas.length > 1
      ? { izq: guardadas.find((s) => s.lado === 'izq')?.[campo] ?? null, der: guardadas.find((s) => s.lado === 'der')?.[campo] ?? null }
      : null;
    return {
      peso: base.peso,
      unidadPeso: base.unidadPeso,
      pesoPorLado: precarga.pesoPorLado,
      valor: base[campo],
      lados,
      rir: base.rirReportado,
    };
  }

  function formulario(k, guardadas) {
    const inicial = valoresIniciales(k, guardadas);
    const corrigiendo = guardadas.length > 0;
    const conPeso = inicial.unidadPeso !== 'corporal';
    const pasoValor = PASO_VALOR[e.tipoMedida];
    const sufijo = SUFIJO_VALOR[e.tipoMedida];
    const porLadoTexto = e.porLado ? ` ${e.repsTexto.match(/por \w+$/)?.[0] ?? 'por lado'}` : '';

    const peso = conPeso
      ? crearSpinner({
          etiqueta: 'Peso',
          valor: inicial.peso ?? 0,
          paso: PASO_PESO[inicial.unidadPeso] ?? 1,
          sufijo: `${inicial.unidadPeso}${inicial.pesoPorLado ? ' c/u' : ''}${e.pesoNota === '+ barra' ? ' + barra' : ''}`,
        })
      : null;
    const unico = crearSpinner({ etiqueta: `${ETIQUETA_VALOR[e.tipoMedida]}${porLadoTexto}`, valor: aPantalla(inicial.valor), paso: pasoValor, sufijo });
    const izq = crearSpinner({ etiqueta: 'Izquierdo', valor: aPantalla(inicial.lados?.izq ?? inicial.valor), paso: pasoValor, sufijo });
    const der = crearSpinner({ etiqueta: 'Derecho', valor: aPantalla(inicial.lados?.der ?? inicial.valor), paso: pasoValor, sufijo });
    const rir = e.rir === null
      ? null
      : crearSpinner({ etiqueta: 'RIR (opcional)', valor: inicial.rir, paso: 1, min: 0, max: 10, nulo: true, inicialSiNulo: e.rir, compacto: true });

    let porLados = Boolean(inicial.lados);
    const zonaValor = h('div', { class: 'zona-valor' });
    const pintarValor = () => pintar(zonaValor, porLados ? [izq.elemento, der.elemento] : unico.elemento);
    pintarValor();
    const alternar = e.porLado
      ? h('button', {
          type: 'button',
          class: 'enlace',
          onclick: () => {
            porLados = !porLados;
            alternar.textContent = porLados ? 'Mismo valor en los dos lados' : 'Distinto por lado';
            pintarValor();
          },
        }, porLados ? 'Mismo valor en los dos lados' : 'Distinto por lado')
      : null;

    const listo = h('button', { type: 'button', class: 'boton primario enorme', onclick: guardar }, corrigiendo ? 'Guardar corrección' : 'Listo');

    // Ejercicios de tiempo: cronómetro durante la serie; precarga lo aguantado y se cierra con "Listo".
    const esTiempo = e.tipoMedida === 'segundos' || e.tipoMedida === 'minutos';
    const cronometrar = esTiempo
      ? h('button', { type: 'button', class: 'boton secundario ancho', onclick: cronometrarSerie }, '▶ Cronómetro de la serie')
      : null;

    async function cronometrarSerie() {
      app.alarma.preparar(); // el audio solo se habilita dentro de un toque
      const objetivo = porLados ? izq.valor : unico.valor;
      const segundos = e.tipoMedida === 'minutos' ? Math.round((objetivo ?? 0) * 60) : objetivo ?? 0;
      if (!segundos) {
        app.aviso('Pon primero el tiempo de la serie');
        return;
      }
      const { fases, transcurrido } = await app.temporizadorSerie.correr({ segundos, porLado: e.porLado });
      const resultado = resultadoDeSerie(fases, transcurrido);
      porLados = Boolean(resultado.lados);
      if (resultado.lados) {
        izq.valor = aPantalla(resultado.lados.izq);
        der.valor = aPantalla(resultado.lados.der);
      } else {
        unico.valor = aPantalla(resultado.valor);
      }
      if (alternar) alternar.textContent = porLados ? 'Mismo valor en los dos lados' : 'Distinto por lado';
      pintarValor();
      app.aviso(resultado.completo ? 'Tiempo completo: toca Listo' : 'Anoté lo que aguantaste: toca Listo', 3500);
    }

    return h(
      'div',
      { class: 'serie-form' },
      h('div', { class: 'serie-form-titulo' }, `Serie ${k} de ${e.series}`, corrigiendo ? h('span', { class: 'etiqueta' }, 'corrigiendo') : null),
      peso?.elemento,
      cronometrar,
      zonaValor,
      alternar,
      rir?.elemento,
      listo,
      corrigiendo
        ? h('button', { type: 'button', class: 'enlace', onclick: () => { abierta = primeraPendiente(); render(); } }, 'Cancelar')
        : null,
    );

    async function guardar() {
      app.alarma.preparar(); // el audio solo se habilita dentro de un toque
      app.alarma.toque();
      listo.disabled = true;
      const captura = { sesionId, rutinaId, numeroSerie: k, peso: peso ? peso.valor : null, unidadPeso: inicial.unidadPeso, rir: rir?.valor ?? null };
      if (porLados) captura.lados = { izq: aGuardar(izq.valor), der: aGuardar(der.valor) };
      else captura.valor = aGuardar(unico.valor);
      try {
        const resultado = await servicio.guardarSerie(captura);
        await despuesDeGuardar(resultado, corrigiendo);
      } catch (error) {
        listo.disabled = false;
        app.error(error);
      }
    }
  }

  async function despuesDeGuardar(resultado, corrigiendo) {
    if (corrigiendo) {
      datos = await servicio.datosEjercicio(sesionId, rutinaId);
      abierta = primeraPendiente();
      render();
      app.aviso('Corrección guardada');
      return;
    }
    const anotado = resultado.progresion ? await ofrecerProgresion(resultado.progresion) : false;
    // Lo que se avisa abajo: el aviso aceptado y el récord, juntos si tocan los dos.
    const record = resultado.record ? textoRecord(resultado.record) : null;
    const extra = [anotado ? (record ? 'Anotado para la próxima' : 'Anotado: la próxima vez sale precargado') : null, record]
      .filter(Boolean)
      .join(' · ');
    const conExtra = (texto) => (extra ? `${texto} · ${extra}` : texto);
    const deshacer = { etiqueta: 'Deshacer', alTocar: deshacerUltima };
    if (resultado.sesionTerminada) {
      app.pantalla.desactivar();
      app.ir(`#/dia/${sesionId}`, { reemplazar: true });
      app.aviso(conExtra('Entrenamiento terminado'), 6000, deshacer);
      return;
    }
    datos = await servicio.datosEjercicio(sesionId, rutinaId);
    const siguienteSerie = primeraPendiente();
    const sinDescanso = !resultado.descansoSeg;
    const avisar = () => {
      if (sinDescanso) app.aviso(conExtra('Serie guardada'), 6000, deshacer);
      else if (extra) app.aviso(extra, 5000);
    };
    if (siguienteSerie === null) {
      const destino = datos.siguientePendiente;
      app.cronometro.iniciar(resultado.descansoSeg, { texto: destino ? `Sigue: ${destino.nombre}` : '', frases, deshacer: deshacerUltima });
      app.ir(destino ? `#/ejercicio/${sesionId}/${destino.id}` : `#/dia/${sesionId}`, { reemplazar: true });
      avisar();
      return;
    }
    abierta = siguienteSerie;
    verVideo = false;
    render();
    const precarga = datos.precarga[siguienteSerie - 1];
    app.cronometro.iniciar(resultado.descansoSeg, {
      texto: `Sigue: serie ${siguienteSerie} · ${formato.serie(precarga, e.tipoMedida)}`,
      frases,
      deshacer: deshacerUltima,
    });
    avisar();
  }

  /** '★ ¡Nuevo récord! 57.5 kg' (o 1RM estimado, o la mejor serie sin peso). */
  function textoRecord(r) {
    if (r.tipo === 'peso') return `★ ¡Nuevo récord! ${formato.peso(r.valor, r.unidad, e.pesoPorLado)}`;
    if (r.tipo === 'e1rm') return `★ ¡Nuevo récord! 1RM estimado ${formato.decimal(r.valor)} ${r.unidad}${e.pesoPorLado ? ' c/u' : ''}`;
    return `★ ¡Nuevo récord! ${formato.valor(r.valor, e.tipoMedida)}${e.tipoMedida === 'reps' ? ' reps' : ''}`;
  }

  /** Deshace la última serie guardada y reabre su tarjeta con los valores que tenía. */
  async function deshacerUltima() {
    try {
      const deshecha = await servicio.deshacerUltimaSerie(sesionId);
      if (!deshecha) return;
      app.cronometro.detener();
      app.borrador = { sesionId, ...deshecha };
      app.pantalla.activar();
      app.ir(`#/ejercicio/${sesionId}/${deshecha.rutinaId}`, { reemplazar: true });
      app.aviso('Serie deshecha: corrígela y toca Listo', 3500);
    } catch (error) {
      app.error(error);
    }
  }

  async function ofrecerProgresion(propuesta) {
    let control = null;
    let botones;
    const cuerpo = [h('blockquote', { class: 'cita' }, e.progresionTexto)];
    const ahoraNo = { etiqueta: 'Ahora no', valor: null };
    if (propuesta.tipo === 'peso') {
      control = crearSpinner({
        etiqueta: 'Peso para la próxima vez',
        valor: propuesta.peso,
        paso: PASO_PESO[propuesta.unidadPeso] ?? 1,
        sufijo: `${propuesta.unidadPeso}${datos.precarga[0]?.pesoPorLado ? ' c/u' : ''}`,
      });
      if (propuesta.libre) cuerpo.push(h('p', { class: 'nota' }, 'La regla no dice cuánto: ajusta al disco más chico que acepte tu polea.'));
      botones = [ahoraNo, { etiqueta: 'Sí, súbele', valor: () => ({ ...propuesta, peso: control.valor }), clase: 'primario' }];
    } else if (propuesta.tipo === 'tiempo') {
      control = crearSpinner({ etiqueta: 'Tiempo para la próxima vez', valor: propuesta.valor, paso: 5, sufijo: 's' });
      botones = [ahoraNo, { etiqueta: 'Sí, súbele', valor: () => ({ ...propuesta, valor: control.valor }), clase: 'primario' }];
    } else if (propuesta.tipo === 'implemento') {
      const conPeso = propuesta.peso ? ` (${formato.peso(propuesta.peso, propuesta.unidadPeso, propuesta.pesoPorLado)})` : '';
      cuerpo.push(h('p', { class: 'cambio' }, `Cambio: ${propuesta.implemento}${conPeso}`));
      botones = [ahoraNo, { etiqueta: 'Sí, ya cambié', valor: propuesta, clase: 'primario' }];
    } else {
      cuerpo.push(h('p', { class: 'nota' }, 'Elige una. Nunca las dos a la vez.'));
      botones = [ahoraNo, ...propuesta.opciones.map((o) => ({ etiqueta: o.etiqueta, valor: o, clase: 'primario' }))];
    }
    if (control) cuerpo.push(control.elemento);
    const elegida = await preguntar({ titulo: '¡Ya te toca subirle!', cuerpo, botones, clase: 'dialogo-progresion' });
    if (!elegida) return false;
    await servicio.aceptarProgresion({ sesionId, rutinaId, propuesta: elegida });
    return true;
  }

  function pie() {
    const destino = datos.siguientePendiente;
    return h(
      'div',
      { class: 'pie-ejercicio' },
      h('p', { class: 'sub' }, '✓ Ejercicio terminado'),
      destino
        ? h('button', { type: 'button', class: 'boton primario enorme', onclick: () => app.ir(`#/ejercicio/${sesionId}/${destino.id}`, { reemplazar: true }) }, `Sigue: ${destino.nombre}`)
        : h('a', { class: 'boton primario enorme', href: `#/dia/${sesionId}` }, 'Ver el día'),
    );
  }
}
