// Plataforma: la voz del teléfono (síntesis de voz del navegador), tanda 3.
// Solo habla con una voz en español; si el teléfono no tiene, no dice nada y
// la pantalla lo avisa. En Android la lista de voces llega tarde
// (evento voiceschanged): por eso se vuelve a buscar cuando cambia.
// Que funcione sin internet depende de que la voz esté descargada en el teléfono.

export function crearVoz() {
  const sintesis = globalThis.speechSynthesis ?? null;
  let voz = null;

  function elegir() {
    const voces = sintesis?.getVoices?.() ?? [];
    const de = (patron) => voces.find((v) => patron.test(v.lang));
    voz = de(/^es[-_]MX/i) ?? de(/^es[-_]US/i) ?? de(/^es[-_]419/i) ?? de(/^es/i) ?? null;
  }

  if (sintesis) {
    elegir();
    sintesis.addEventListener?.('voiceschanged', elegir);
  }

  return {
    /** ¿Hay voz en español en este teléfono? */
    get disponible() {
      return Boolean(sintesis && voz);
    },
    get nombre() {
      return voz ? `${voz.name} (${voz.lang})` : null;
    },
    /** Dice `texto`; corta lo que estuviera diciendo. Devuelve false si no hay voz. */
    hablar(texto) {
      if (!sintesis || !voz || !texto) return false;
      sintesis.cancel();
      const frase = new SpeechSynthesisUtterance(texto);
      frase.voice = voz;
      frase.lang = voz.lang;
      sintesis.speak(frase);
      return true;
    },
    callar() {
      sintesis?.cancel();
    },
  };
}
