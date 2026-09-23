// Lógica pura: arma y valida el archivo de respaldo (encargo, sección 7).
// Importar REEMPLAZA todo; por eso aquí se valida a fondo antes de tocar nada.

export const FORMATO = 'aaronfit-respaldo';
export const VERSION_FORMATO = 1;
export const COLECCIONES = Object.freeze(['rutina', 'sesiones', 'series', 'medidas', 'estado']);

export const nombreArchivo = (fechaTexto) => `aaronfit-respaldo-${fechaTexto}.json`;

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const TIPOS = {
  numero: esNumero,
  numeroONulo: (v) => v === null || esNumero(v),
  texto: (v) => typeof v === 'string',
  booleano: (v) => typeof v === 'boolean',
  fecha: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
  semana: (v) => typeof v === 'string' && /^\d{4}-W\d{2}$/.test(v),
  estadoSesion: (v) => ['en_curso', 'completa', 'abandonada'].includes(v),
};

// Campos mínimos que la app necesita para funcionar con cada registro.
const ESQUEMA = {
  rutina: { id: 'numero', dia: 'texto', diaSemana: 'numero', orden: 'numero', clave: 'texto', ejercicio: 'texto', series: 'numero', tipoMedida: 'texto' },
  sesiones: { id: 'numero', fecha: 'fecha', semanaISO: 'semana', diaSemanaPlan: 'numero', estado: 'estadoSesion', inicio: 'texto' },
  series: { id: 'numero', sesionId: 'numero', rutinaId: 'numero', semanaISO: 'semana', numeroSerie: 'numero', completada: 'booleano', hora: 'texto' },
  medidas: { id: 'numero', fecha: 'fecha', semanaISO: 'semana', pesoCorporal: 'numeroONulo', cintura: 'numeroONulo' },
  estado: { llave: 'texto' },
};
const LLAVE = { rutina: 'id', sesiones: 'id', series: 'id', medidas: 'id', estado: 'llave' };

/** Arma el objeto de respaldo con encabezado de formato, fecha y conteos. */
export function armarRespaldo(datos, { exportado }) {
  return {
    formato: FORMATO,
    version: VERSION_FORMATO,
    exportado,
    conteos: Object.fromEntries(COLECCIONES.map((c) => [c, datos[c].length])),
    datos: Object.fromEntries(COLECCIONES.map((c) => [c, datos[c]])),
  };
}

const falla = (error) => ({ ok: false, error });

/**
 * Valida un respaldo (texto JSON u objeto). Nunca lanza.
 * @returns {{ok:true, datos:object, conteos:object, exportado:string|null} | {ok:false, error:string}}
 */
export function validarRespaldo(entrada) {
  let respaldo = entrada;
  if (typeof entrada === 'string') {
    try {
      respaldo = JSON.parse(entrada);
    } catch {
      return falla('El archivo no es un JSON válido. No se tocó nada.');
    }
  }
  if (!respaldo || typeof respaldo !== 'object' || Array.isArray(respaldo) || respaldo.formato !== FORMATO) {
    return falla('El archivo no es un respaldo de AaronFit (no trae el encabezado de formato). No se tocó nada.');
  }
  if (!Number.isInteger(respaldo.version) || respaldo.version < 1) {
    return falla('El respaldo no dice qué versión de formato es. No se tocó nada.');
  }
  if (respaldo.version > VERSION_FORMATO) {
    return falla(
      `El respaldo es de la versión ${respaldo.version} del formato y esta app solo sabe leer hasta la ${VERSION_FORMATO}. ` +
        'Actualiza la app antes de importarlo. No se tocó nada.',
    );
  }
  const datos = respaldo.datos;
  if (!datos || typeof datos !== 'object') return falla('Al respaldo le faltan los datos. No se tocó nada.');

  for (const coleccion of COLECCIONES) {
    const registros = datos[coleccion];
    if (!Array.isArray(registros)) return falla(`Al respaldo le falta la colección "${coleccion}". No se tocó nada.`);
    const llaves = new Set();
    for (let i = 0; i < registros.length; i++) {
      const registro = registros[i];
      if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
        return falla(`"${coleccion}" #${i + 1} no es un registro. No se tocó nada.`);
      }
      for (const [campo, tipo] of Object.entries(ESQUEMA[coleccion])) {
        if (!TIPOS[tipo](registro[campo])) {
          return falla(`"${coleccion}" #${i + 1}: el campo "${campo}" no es válido. No se tocó nada.`);
        }
      }
      const llave = registro[LLAVE[coleccion]];
      if (llaves.has(llave)) return falla(`"${coleccion}" trae la llave ${llave} repetida. No se tocó nada.`);
      llaves.add(llave);
    }
  }

  const sesiones = new Set(datos.sesiones.map((s) => s.id));
  const rutina = new Set(datos.rutina.map((r) => r.id));
  const huerfana = datos.series.find((s) => !sesiones.has(s.sesionId) || !rutina.has(s.rutinaId));
  if (huerfana) {
    return falla(`La serie ${huerfana.id} apunta a una sesión o ejercicio que no viene en el respaldo. No se tocó nada.`);
  }

  return {
    ok: true,
    datos: Object.fromEntries(COLECCIONES.map((c) => [c, datos[c]])),
    conteos: Object.fromEntries(COLECCIONES.map((c) => [c, datos[c].length])),
    exportado: typeof respaldo.exportado === 'string' ? respaldo.exportado : null,
  };
}
