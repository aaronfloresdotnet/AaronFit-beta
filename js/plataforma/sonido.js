// Plataforma: timbre y vibración del cronómetro.
// El timbre se agenda en el reloj de audio, no en temporizadores de la página:
// así suena a tiempo aunque el navegador frene la página en segundo plano.

export function crearAlarma() {
  let contexto = null;
  let salida = null; // ganancia de la alarma agendada; desconectarla la calla al instante

  /** Llamar dentro de un toque del usuario: el navegador lo exige para el audio. */
  function preparar() {
    const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Contexto) return;
    contexto ??= new Contexto();
    if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  }

  /** Agenda el timbre para dentro de `segundos`: pitido doble cada 2 s durante 30 s. */
  function programar(segundos) {
    detener();
    if (!contexto) return;
    salida = contexto.createGain();
    salida.gain.value = 0.3;
    salida.connect(contexto.destination);
    const inicio = contexto.currentTime + Math.max(0, segundos);
    for (let i = 0; i < 15; i++) {
      for (const [desfase, frecuencia] of [[0, 880], [0.2, 1320]]) {
        const t = inicio + i * 2 + desfase;
        const oscilador = contexto.createOscillator();
        const volumen = contexto.createGain();
        oscilador.type = 'square';
        oscilador.frequency.value = frecuencia;
        volumen.gain.setValueAtTime(0.0001, t);
        volumen.gain.exponentialRampToValueAtTime(1, t + 0.01);
        volumen.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        oscilador.connect(volumen).connect(salida);
        oscilador.start(t);
        oscilador.stop(t + 0.18);
      }
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
    toque: () => navigator.vibrate?.(25),
  };
}
