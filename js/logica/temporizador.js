// Lógica pura: cronómetro de serie para ejercicios de tiempo (plancha, pared,
// equilibrio, costal). Arma las fases y traduce dónde se detuvo en valores.
// Por lado: una corrida por lado, con una pausa corta para cambiar.

export const PAUSA_CAMBIO_LADO = 5;

/**
 * @param {{segundos:number, porLado:boolean}} p  segundos objetivo por lado
 * @returns {Array<{etiqueta:string, segundos:number, lado:'izq'|'der'|null, pausa:boolean}>}
 */
export function fasesDeSerie({ segundos, porLado }) {
  if (!porLado) return [{ etiqueta: 'Aguanta', segundos, lado: null, pausa: false }];
  return [
    { etiqueta: 'Lado izquierdo', segundos, lado: 'izq', pausa: false },
    { etiqueta: 'Cambia de lado', segundos: PAUSA_CAMBIO_LADO, lado: null, pausa: true },
    { etiqueta: 'Lado derecho', segundos, lado: 'der', pausa: false },
  ];
}

/** Segundos desde el arranque en que empieza cada fase, y el total. */
export function tiempos(fases) {
  let acumulado = 0;
  const inicios = fases.map((f) => {
    const inicio = acumulado;
    acumulado += f.segundos;
    return inicio;
  });
  return { inicios, total: acumulado };
}

/** En qué fase va y cuánto le queda, a `transcurrido` segundos del arranque. */
export function momento(fases, transcurrido) {
  const { inicios, total } = tiempos(fases);
  if (transcurrido >= total) return { indice: fases.length, restante: 0, terminado: true };
  let indice = fases.length - 1;
  while (indice > 0 && transcurrido < inicios[indice]) indice--;
  return { indice, restante: inicios[indice] + fases[indice].segundos - transcurrido, terminado: false };
}

/**
 * Valores a precargar en la tarjeta según dónde terminó.
 * @returns {{valor:number|null, lados:{izq:number, der:number}|null, completo:boolean}}
 */
export function resultadoDeSerie(fases, transcurrido) {
  const { inicios, total } = tiempos(fases);
  const hechoEn = (i) => Math.max(0, Math.min(fases[i].segundos, Math.floor(transcurrido - inicios[i])));
  const completo = transcurrido >= total;
  if (fases.length === 1) return { valor: hechoEn(0), lados: null, completo };
  const izq = hechoEn(0);
  // Si paró en el primer lado, se anota un solo valor (el que aguantó).
  if (transcurrido < inicios[1]) return { valor: izq, lados: null, completo: false };
  const der = hechoEn(2); // 0 si paró durante el cambio de lado
  return izq === der ? { valor: izq, lados: null, completo } : { valor: null, lados: { izq, der }, completo };
}
