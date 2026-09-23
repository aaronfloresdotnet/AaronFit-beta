// Pantalla: control numérico (decisión 5, encargo 5.7).
// Botones grandes de más y menos con paso propio; mantener presionado acelera;
// tocar el número permite escribirlo directo (acepta coma decimal).
// Si `nulo` es verdadero, el valor puede quedar vacío ("—"): menos en el mínimo lo vacía.

import { numero } from '../logica/formato.js';
import { h } from './dom.js';

export function crearSpinner({
  etiqueta,
  valor = null,
  paso = 1,
  min = 0,
  max = 99999,
  sufijo = '',
  nulo = false,
  inicialSiNulo = null,
  compacto = false,
  alCambiar = () => {},
}) {
  let actual = valor;
  const cifra = h('span', { class: 'spinner-cifra' });
  const pantalla = h(
    'button',
    { type: 'button', class: 'spinner-valor', 'aria-label': `${etiqueta}. Toca para escribir el número` },
    cifra,
    sufijo ? h('span', { class: 'spinner-sufijo' }, sufijo) : null,
  );
  const menos = boton('−', `Menos ${etiqueta}`, -1);
  const mas = boton('+', `Más ${etiqueta}`, 1);
  const elemento = h(
    'div',
    { class: compacto ? 'spinner compacto' : 'spinner' },
    h('div', { class: 'spinner-etiqueta' }, etiqueta),
    h('div', { class: 'spinner-fila' }, menos, pantalla, mas),
  );

  const redondear = (n) => Math.round(n * 100) / 100;

  function pintarValor() {
    cifra.textContent = actual === null ? '—' : numero(actual);
    menos.disabled = actual === null || (actual <= min && !nulo);
    mas.disabled = actual !== null && actual >= max;
  }

  function fijar(nuevo, avisar = true) {
    const limpio = nuevo === null ? null : redondear(Math.min(max, Math.max(min, nuevo)));
    if (limpio === actual) return;
    actual = limpio;
    pintarValor();
    if (avisar) alCambiar(actual);
  }

  function dar(direccion) {
    if (actual === null) {
      if (direccion > 0) fijar(inicialSiNulo ?? min);
      return;
    }
    if (direccion < 0 && nulo && actual <= min) {
      fijar(null);
      return;
    }
    fijar(actual + direccion * paso);
  }

  function boton(simbolo, nombre, direccion) {
    const b = h('button', { type: 'button', class: 'spinner-boton', 'aria-label': nombre }, simbolo);
    let temporizador = null;
    let porPuntero = false;
    let repeticiones = 0;
    const parar = () => {
      clearTimeout(temporizador);
      temporizador = null;
    };
    const repetir = () => {
      dar(direccion);
      repeticiones++;
      temporizador = setTimeout(repetir, repeticiones > 8 ? 60 : 140);
    };
    b.addEventListener('pointerdown', (evento) => {
      if (evento.button !== 0) return;
      porPuntero = true;
      repeticiones = 0;
      dar(direccion);
      b.setPointerCapture?.(evento.pointerId);
      temporizador = setTimeout(repetir, 450);
    });
    for (const nombreEvento of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(nombreEvento, parar);
    // El clic llega también tras pointerdown; solo cuenta si vino del teclado.
    b.addEventListener('click', () => {
      if (porPuntero) porPuntero = false;
      else dar(direccion);
    });
    b.addEventListener('contextmenu', (evento) => evento.preventDefault());
    return b;
  }

  pantalla.addEventListener('click', () => {
    const entrada = h('input', {
      type: 'text',
      inputmode: Number.isInteger(paso) && Number.isInteger(min) ? 'numeric' : 'decimal',
      enterkeyhint: 'done',
      class: 'spinner-entrada',
      value: actual === null ? '' : String(actual),
      'aria-label': etiqueta,
    });
    pantalla.replaceWith(entrada);
    entrada.focus();
    entrada.select();
    let terminado = false;
    const terminar = (guardar) => {
      if (terminado) return;
      terminado = true;
      if (guardar) {
        const texto = entrada.value.trim().replace(',', '.');
        if (texto === '') {
          if (nulo) fijar(null);
        } else if (Number.isFinite(Number(texto))) {
          fijar(Number(texto));
        }
      }
      entrada.replaceWith(pantalla);
    };
    entrada.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        terminar(true);
      } else if (evento.key === 'Escape') {
        terminar(false);
      }
    });
    entrada.addEventListener('blur', () => terminar(true));
  });

  pintarValor();
  return {
    elemento,
    get valor() {
      return actual;
    },
    set valor(nuevo) {
      fijar(nuevo, false);
    },
  };
}
