// Pantalla: cronómetro DURANTE la serie, para ejercicios de tiempo (plancha,
// pared, equilibrio, costal, caminata). Cuenta hacia atrás cada fase (por lado:
// izquierdo, cambio, derecho), pita al cambiar y suena al terminar.
// No guarda nada: devuelve cuánto se aguantó y la tarjeta se precarga con eso;
// la serie se cierra con "Listo", como todas (decisión 14).

import { reloj } from '../logica/formato.js';
import { fasesDeSerie, momento, tiempos } from '../logica/temporizador.js';
import { h } from './dom.js';

export function crearTemporizadorSerie({ alarma }) {
  const etiqueta = h('div', { class: 'crono-titulo' });
  const cifra = h('div', { class: 'crono-cifra' });
  const pasos = h('div', { class: 'crono-siguiente' });
  const pista = h('div', { class: 'crono-pista' }, 'Toca en cualquier parte para anotar');
  const parar = h('button', { type: 'button', class: 'boton secundario crono-boton' }, 'Terminar aquí');
  const capa = h('div', { class: 'crono serie', role: 'timer', hidden: true }, etiqueta, cifra, pasos, pista, parar);
  document.body.append(capa);

  /**
   * @param {{segundos:number, porLado:boolean}} p
   * @returns {Promise<{fases:Array, transcurrido:number}>}
   */
  function correr({ segundos, porLado }) {
    return new Promise((resolver) => {
      const fases = fasesDeSerie({ segundos, porLado });
      const { inicios, total } = tiempos(fases);
      const inicio = Date.now();
      let terminado = false;
      let intervalo = null;

      const fin = (transcurrido) => {
        clearInterval(intervalo);
        alarma.detener();
        capa.hidden = true;
        capa.classList.remove('sonando');
        capa.removeEventListener('click', alTocar);
        parar.removeEventListener('click', alParar);
        resolver({ fases, transcurrido });
      };
      const alParar = (evento) => {
        evento.stopPropagation();
        fin((Date.now() - inicio) / 1000);
      };
      const alTocar = () => {
        if (terminado) fin(total);
      };

      const tic = () => {
        const transcurrido = (Date.now() - inicio) / 1000;
        const m = momento(fases, transcurrido);
        if (m.terminado) {
          if (!terminado) {
            terminado = true;
            etiqueta.textContent = '¡Tiempo!';
            cifra.textContent = reloj(0);
            pasos.textContent = '';
            capa.classList.add('sonando');
            pista.hidden = false;
            parar.hidden = true;
            alarma.vibrar();
            clearInterval(intervalo);
          }
          return;
        }
        etiqueta.textContent = fases[m.indice].etiqueta;
        cifra.textContent = reloj(m.restante);
      };

      pasos.textContent = `Meta: ${reloj(segundos)}${porLado ? ' por lado' : ''}`;
      pista.hidden = true;
      parar.hidden = false;
      capa.hidden = false;
      alarma.programar(total, { cambios: inicios.slice(1) });
      capa.addEventListener('click', alTocar);
      parar.addEventListener('click', alParar);
      tic();
      intervalo = setInterval(tic, 200);
    });
  }

  return { correr };
}
