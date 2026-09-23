// Pantalla: crear elementos sin armar HTML con texto (nada de innerHTML).

// Atributos que deben fijarse como propiedad del elemento, no como atributo HTML.
const PROPIEDADES = new Set(['value', 'checked', 'muted', 'hidden', 'disabled', 'open']);

/** h('button', { class: 'boton', onclick: fn }, 'Listo') */
export function h(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nombre === 'class') elemento.className = valor;
    else if (nombre.startsWith('on') && typeof valor === 'function') elemento.addEventListener(nombre.slice(2), valor);
    else if (PROPIEDADES.has(nombre)) elemento[nombre] = valor;
    else elemento.setAttribute(nombre, valor === true ? '' : valor);
  }
  anexar(elemento, hijos);
  return elemento;
}

/** Agrega hijos ignorando null, undefined y booleanos; aplana arreglos. */
export function anexar(elemento, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || typeof hijo === 'boolean') continue;
    elemento.append(hijo instanceof Node ? hijo : String(hijo));
  }
}

/** Reemplaza todo el contenido de `elemento`. */
export function pintar(elemento, ...hijos) {
  elemento.replaceChildren();
  anexar(elemento, hijos);
}
