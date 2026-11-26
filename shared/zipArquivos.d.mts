export function zipArquivos(
  arquivos: Array<{ nome?: string; dados?: Uint8Array; blob?: Blob }>,
): Promise<Blob>
