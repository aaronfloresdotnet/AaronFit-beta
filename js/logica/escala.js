// Lógica pura: marcas "redondas" para el eje Y de una gráfica (tanda 2).

/**
 * Marcas para un eje que cubre [min, max]: el paso es 1, 2, 2.5 o 5 por una
 * potencia de 10, y el eje empieza y termina en una marca. Si min y max son
 * iguales, se abre un poco alrededor del valor.
 * @returns {{desde:number, hasta:number, paso:number, marcas:number[]}}
 */
export function marcasRedondas(min, max, cuantas = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { desde: 0, hasta: 1, paso: 1, marcas: [0, 1] };
  if (min === max) {
    const holgura = Math.abs(min) * 0.1 || 1;
    min -= holgura;
    max += holgura;
  }
  const bruto = (max - min) / Math.max(1, cuantas - 1);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto);
  const redondo = (v) => Math.round(v * 1e6) / 1e6;
  const desde = redondo(Math.floor(min / paso) * paso);
  const hasta = redondo(Math.ceil(max / paso) * paso);
  const marcas = [];
  for (let i = 0; desde + i * paso <= hasta + paso / 2; i++) marcas.push(redondo(desde + i * paso));
  return { desde, hasta, paso, marcas };
}
