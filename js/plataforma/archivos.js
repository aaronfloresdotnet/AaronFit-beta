// Plataforma: bajar y leer archivos (respaldo).

/** Descarga `texto` como archivo; en Android queda en la carpeta Descargas. */
export function descargar(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const leerTexto = (archivo) => archivo.text();
