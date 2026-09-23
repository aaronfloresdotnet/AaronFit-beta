// Pantalla: Medidas (encargo 6.6). Pantalla aparte, con su propia fecha.
// Peso, cintura, cadera y cuello siempre a la vista; lo demás en una sección
// plegada. Las fotos se quedan en la galería: aquí solo se anota que se tomaron.
// Tanda 2: tu perfil (estatura y fórmula), % de grasa estimado, cintura entre
// estatura, comparación contra hace ~4 semanas y las gráficas de peso y cintura.

import { h, pintar } from '../componentes/dom.js';
import { crearGrafica } from '../componentes/grafica.js';
import { crearSpinner } from '../componentes/spinner.js';
import { LIMITE_CINTURA_ESTATURA } from '../logica/cuerpo.js';
import { cambio, decimal, fechaCorta, numero } from '../logica/formato.js';
import { CAMPOS_MEDIDA } from '../logica/medidas.js';

// Punto de partida del "+" cuando un campo nunca se ha medido (luego se escribe o ajusta).
const INICIO_SI_VACIO = {
  pesoCorporal: 80, cintura: 90, cadera: 100, cuello: 40, pecho: 100, musloIzq: 55, musloDer: 55,
  pantorrillaIzq: 38, pantorrillaDer: 38, brazoIzq: 33, brazoDer: 33, antebrazoIzq: 28, antebrazoDer: 28,
};

const conAnio = (fecha) => `${fechaCorta(fecha)} ${fecha.slice(0, 4)}`;
const semanas = (dias) => Math.floor(dias / 7);

export async function montar(raiz, _parametros, app) {
  let graficas = [];
  let editandoPerfil = false;
  let ultimos = null;
  await cargar();
  return () => destruirGraficas();

  function destruirGraficas() {
    for (const g of graficas) g.destruir();
    graficas = [];
  }

  async function cargar(fecha) {
    ultimos = await app.servicios.medidas.datos(fecha);
    render(ultimos);
  }

  function render(d) {
    destruirGraficas();
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
          avisoFotos(d.analisis.fotos),
        ),
      ),
      nota,
      h('button', { type: 'button', class: 'boton primario enorme', onclick: guardar }, 'Guardar medidas'),
      d.perfil && !editandoPerfil ? tarjetaCuerpo(d) : tarjetaPerfil(d.perfil),
      tarjetaGraficas(d.analisis),
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

  function avisoFotos(f) {
    if (!f.toca) return null;
    return h(
      'small',
      { class: 'aviso-fotos' },
      f.ultima ? `Tus últimas fotos son del ${fechaCorta(f.ultima)} (hace ${semanas(f.dias)} semanas): ya tocan otras.` : 'Todavía no has anotado fotos.',
    );
  }

  /** Estatura y fórmula. La fórmula (hombre o mujer) la eliges tú: no se supone. */
  function tarjetaPerfil(perfil) {
    const estatura = crearSpinner({ etiqueta: 'Estatura', valor: perfil?.estatura ?? null, paso: 1, min: 100, max: 250, sufijo: 'cm', nulo: true, inicialSiNulo: 170 });
    const opcion = (valor, texto) =>
      h('label', { class: 'eleccion' }, h('input', { type: 'radio', name: 'formula', value: valor, checked: perfil?.formula === valor }), h('span', {}, texto));
    const opciones = h('div', { class: 'elecciones', role: 'radiogroup', 'aria-label': 'Fórmula del % de grasa' }, opcion('hombre', 'Hombre'), opcion('mujer', 'Mujer'));
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'Tu perfil'),
      h('p', { class: 'nota' }, 'Para estimar tu % de grasa y tu relación cintura/estatura. La fórmula de la Marina de EE. UU. es distinta para hombre y para mujer (la de mujer usa también la cadera).'),
      estatura.elemento,
      opciones,
      h(
        'div',
        { class: 'botones-fila' },
        perfil ? h('button', { type: 'button', class: 'boton', onclick: () => { editandoPerfil = false; render(ultimos); } }, 'Cancelar') : null,
        h('button', { type: 'button', class: 'boton primario', onclick: guardarPerfil }, 'Guardar perfil'),
      ),
    );

    async function guardarPerfil() {
      const formula = opciones.querySelector('input:checked')?.value;
      if (estatura.valor === null) return app.aviso('Pon tu estatura');
      if (!formula) return app.aviso('Elige la fórmula: hombre o mujer');
      try {
        await app.servicios.medidas.guardarPerfil({ estatura: estatura.valor, formula });
        editandoPerfil = false;
        app.aviso('Perfil guardado');
        await cargar(ultimos.fecha);
      } catch (error) {
        app.error(error);
      }
    }
  }

  /** % de grasa, cintura/estatura y la comparación contra hace ~4 semanas. */
  function tarjetaCuerpo(d) {
    const { perfil } = d;
    const a = d.analisis;
    const falta = perfil.formula === 'mujer' ? 'cintura, cuello y cadera' : 'cintura y cuello';
    const cifra = (etiqueta, valor, detalle) =>
      h('li', { class: 'cifra' }, h('span', { class: 'cifra-etiqueta' }, etiqueta), h('strong', { class: 'cifra-valor' }, valor), h('span', { class: 'cifra-detalle' }, detalle));
    return h(
      'section',
      { class: 'tarjeta' },
      h('h2', {}, 'Tu cuerpo'),
      h(
        'ul',
        { class: 'cifras' },
        cifra('% de grasa estimado', a.grasa ? `${decimal(a.grasa.valor)} %` : '—', a.grasa ? `Medición del ${fechaCorta(a.grasa.fecha)}` : `Falta medir ${falta}`),
        cifra(
          'Cintura / estatura',
          a.cinturaEstatura ? decimal(a.cinturaEstatura.valor, 2) : '—',
          a.cinturaEstatura ? `Recomendado: menos de ${LIMITE_CINTURA_ESTATURA}` : 'Falta medir la cintura',
        ),
      ),
      h('p', { class: 'nota' }, 'El % de grasa es una estimación con cinta métrica (fórmula de la Marina de EE. UU.); una báscula o un DEXA dan otros números. Lo útil es cómo cambia.'),
      a.comparacion ? tablaComparacion(a.comparacion) : h('p', { class: 'nota' }, 'Cuando tengas una medición de hace 3 semanas o más, aquí verás qué cambió.'),
      h('p', { class: 'nota' }, `Tu perfil: estatura ${numero(perfil.estatura)} cm, fórmula de ${perfil.formula}.`),
      h('button', { type: 'button', class: 'enlace', onclick: () => { editandoPerfil = true; render(ultimos); } }, 'Cambiar estatura o fórmula'),
    );
  }

  function tablaComparacion(c) {
    const filas = c.cambios.map((x) => [x.etiqueta, `${numero(x.antes)}`, `${numero(x.ahora)}`, `${cambio(x.cambio)} ${x.unidad}`]);
    if (c.grasa.antes !== null && c.grasa.ahora !== null) {
      const diferencia = Math.round((c.grasa.ahora - c.grasa.antes) * 10) / 10;
      filas.push(['% de grasa estimado', decimal(c.grasa.antes), decimal(c.grasa.ahora), `${cambio(diferencia)} %`]);
    }
    return h(
      'div',
      { class: 'comparacion' },
      h('p', { class: 'sub' }, `Del ${fechaCorta(c.antes)} al ${fechaCorta(c.ahora)}:`),
      h(
        'table',
        { class: 'conteos' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Medida'), h('th', { scope: 'col' }, fechaCorta(c.antes)), h('th', { scope: 'col' }, fechaCorta(c.ahora)), h('th', { scope: 'col' }, 'Cambio'))),
        h('tbody', {}, filas.map(([etiqueta, ...valores]) => h('tr', {}, h('th', { scope: 'row' }, etiqueta), valores.map((v) => h('td', {}, v))))),
      ),
    );
  }

  /** Peso y cintura: dos gráficas (kg y cm nunca comparten eje). */
  function tarjetaGraficas(a) {
    const bloques = [];
    for (const [titulo, puntos, unidad] of [['Peso corporal', a.peso, 'kg'], ['Cintura', a.cintura, 'cm']]) {
      if (puntos.length < 2) continue;
      const grafica = crearGrafica({
        titulo: `${titulo} (${unidad}) por medición`,
        fechas: puntos.map((p) => p.fecha),
        series: [{ nombre: titulo, valores: puntos.map((p) => p.valor) }],
        formato: (v) => `${numero(v)} ${unidad}`,
      });
      graficas.push(grafica);
      bloques.push(h('h3', { class: 'titulo-grafica' }, `${titulo} (${unidad})`), grafica.elemento);
    }
    if (!bloques.length) return null;
    return h('section', { class: 'tarjeta' }, h('h2', {}, 'Cómo vas'), bloques);
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
