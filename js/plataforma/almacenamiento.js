// Plataforma: almacenamiento persistente.
// Pide al navegador que no borre los datos por falta de espacio. Chrome lo
// concede solo a apps instaladas o muy usadas; si no, todo sigue igual.

export async function pedirPersistencia() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estaPersistido() {
  try {
    return Boolean(await navigator.storage?.persisted?.());
  } catch {
    return false;
  }
}
