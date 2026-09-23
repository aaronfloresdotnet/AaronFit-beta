// Plataforma: timbre y vibración de los cronómetros.
// Los sonidos se agendan en el reloj de audio, no en temporizadores de la
// página: así suenan a tiempo aunque el navegador frene la página en segundo plano.

export function crearAlarma() {
  let contexto = null;
  let salida = null; // ganancia de lo agendado; desconectarla lo calla al instante

  /** Llamar dentro de un toque del usuario: el navegador lo exige para el audio. */
  function preparar() {
    const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Contexto) return;
    contexto ??= new Contexto();
    if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  }

  function pitido(t, frecuencia, duracion = 0.16) {
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.type = 'square';
    oscilador.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0.0001, t);
    volumen.gain.exponentialRampToValueAtTime(1, t + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    oscilador.connect(volumen).connect(salida);
    oscilador.start(t);
    oscilador.stop(t + duracion + 0.02);
  }

  /**
   * Agenda para dentro de `segundos`: tres pitidos cortos en los últimos 3 s
   * y, al llegar a cero, el timbre (pitido doble cada 2 s durante 30 s).
   * `cambios` son momentos intermedios (p. ej. cambio de lado) con un pitido doble.
   */
  function programar(segundos, { cambios = [] } = {}) {
    detener();
    if (!contexto) return;
    salida = contexto.createGain();
    salida.gain.value = 0.3;
    salida.connect(contexto.destination);
    const ahora = contexto.currentTime;
    const fin = ahora + Math.max(0, segundos);
    for (const s of [3, 2, 1]) if (segundos > s) pitido(fin - s, 660, 0.09);
    for (const c of cambios) {
      pitido(ahora + c, 1320);
      pitido(ahora + c + 0.2, 1320);
    }
    for (let i = 0; i < 15; i++) {
      pitido(fin + i * 2, 880);
      pitido(fin + i * 2 + 0.2, 1320);
    }
  }

  function detener() {
    if (salida) {
      salida.disconnect();
      salida = null;
    }
    navigator.vibrate?.(0);
  }

  return {
    preparar,
    programar,
    detener,
    vibrar: () => navigator.vibrate?.([400, 150, 400, 150, 400]),
    avisoCorto: () => navigator.vibrate?.(150),
    toque: () => navigator.vibrate?.(25),
  };
}
