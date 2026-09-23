// Lógica pura: los campos de medidas corporales (encargo 3) y su paso (encargo 5.7).

export const CAMPOS_MEDIDA = Object.freeze([
  { campo: 'pesoCorporal', etiqueta: 'Peso corporal', unidad: 'kg', paso: 0.1, principal: true },
  { campo: 'cintura', etiqueta: 'Cintura', unidad: 'cm', paso: 0.5, principal: true },
  { campo: 'cadera', etiqueta: 'Cadera', unidad: 'cm', paso: 0.5, principal: true },
  { campo: 'cuello', etiqueta: 'Cuello', unidad: 'cm', paso: 0.5, principal: true },
  { campo: 'pecho', etiqueta: 'Pecho', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'musloIzq', etiqueta: 'Muslo izquierdo', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'musloDer', etiqueta: 'Muslo derecho', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'pantorrillaIzq', etiqueta: 'Pantorrilla izquierda', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'pantorrillaDer', etiqueta: 'Pantorrilla derecha', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'brazoIzq', etiqueta: 'Brazo izquierdo', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'brazoDer', etiqueta: 'Brazo derecho', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'antebrazoIzq', etiqueta: 'Antebrazo izquierdo', unidad: 'cm', paso: 0.5, principal: false },
  { campo: 'antebrazoDer', etiqueta: 'Antebrazo derecho', unidad: 'cm', paso: 0.5, principal: false },
]);

/** Registro completo de una medición: todo campo presente, null si no se midió. */
export function registroDeMedida({ id, fecha, semanaISO, valores, fotosTomadas, nota }) {
  const registro = id === undefined ? {} : { id };
  Object.assign(registro, { fecha, semanaISO });
  for (const { campo } of CAMPOS_MEDIDA) {
    const valor = valores[campo];
    registro[campo] = typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }
  registro.fotosTomadas = Boolean(fotosTomadas);
  registro.nota = typeof nota === 'string' && nota.trim() ? nota.trim() : null;
  return registro;
}
