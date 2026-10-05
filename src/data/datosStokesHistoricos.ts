import * as XLSX from 'xlsx';

export interface StokesItem {
  guia: string;
  fechaGuia: string;
  producto: string;
  cantDespacho: number;
  almacenDespachoRaw: string;
  origenStokes: string;
  almacenDestino: string;
  transportista: string;
  patenteCamion: string;
  estadoGuia?: string;
  emisorGuia?: string;
  tipoDespacho?: string;
  nave?: string;
  cliente?: string;
  conductor?: string;
}

export function normalizarAlmacenDespacho(raw: string): string {
  if (!raw) return '—';
  const value = String(raw).trim();
  return /^Salar Atacama,\s*Mop\s*\([1-6]\)$/i.test(value) ? 'Salar' : value;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value)
    .trim()
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parsea un archivo Excel de Microsoft ReportServer (.xlsx / .xls).
 * Se conserva como contingencia manual y no contiene datos operacionales embebidos.
 */
export function parsearExcelReportServer(data: ArrayBuffer | Uint8Array): StokesItem[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  let headerRowIndex = -1;
  const indices: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    guia: ['guía', 'guia', 'n° guía', 'n° guia'],
    fecha: ['fecha guía', 'fecha guia', 'fecha'],
    producto: ['producto'],
    cant: ['cantidad despacho', 'cant despacho', 'cant. despacho'],
    almacenDespacho: ['almacen despacho', 'almacén despacho'],
    almacenDestino: ['almacen destino', 'almacén destino'],
    transportista: ['transportista'],
    patente: ['patente'],
    estado: ['estado'],
    tipoDespacho: ['tipo despacho']
  };

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex++) {
    const normalized = (rows[rowIndex] || []).map(cell => String(cell || '').toLowerCase().trim());
    if (!normalized.some(cell => aliases.guia.some(alias => cell.includes(alias)))) continue;

    headerRowIndex = rowIndex;
    normalized.forEach((cell, columnIndex) => {
      Object.entries(aliases).forEach(([key, options]) => {
        if (indices[key] === undefined && options.some(alias => cell.includes(alias))) {
          indices[key] = columnIndex;
        }
      });
    });
    break;
  }

  const required = ['guia', 'fecha', 'producto', 'cant', 'almacenDespacho', 'almacenDestino', 'transportista', 'patente'];
  const missing = required.filter(key => indices[key] === undefined);
  if (headerRowIndex < 0 || missing.length) {
    throw new Error(`Formato de ReportServer no reconocido. Faltan columnas: ${missing.join(', ') || 'encabezados'}`);
  }

  return rows
    .slice(headerRowIndex + 1)
    .map(row => {
      const guia = String(row[indices.guia] || '').trim();
      const almacenDespachoRaw = String(row[indices.almacenDespacho] || '').trim();
      return {
        guia,
        fechaGuia: String(row[indices.fecha] || '').trim(),
        producto: String(row[indices.producto] || '').trim() || 'SIN ESPECIFICAR',
        cantDespacho: parseNumber(row[indices.cant]),
        almacenDespachoRaw,
        origenStokes: normalizarAlmacenDespacho(almacenDespachoRaw),
        almacenDestino: String(row[indices.almacenDestino] || '').trim(),
        transportista: String(row[indices.transportista] || '').trim(),
        patenteCamion: String(row[indices.patente] || '').trim(),
        estadoGuia: indices.estado !== undefined ? String(row[indices.estado] || '').trim() : undefined,
        tipoDespacho: indices.tipoDespacho !== undefined ? String(row[indices.tipoDespacho] || '').trim() : undefined
      } as StokesItem;
    })
    .filter(item => item.guia && !/gu[ií]a|hist[oó]rico/i.test(item.guia));
}

// Se mantiene el export por compatibilidad con código legado del servidor.
// Intencionalmente vacío: los datos operacionales no deben vivir en el repositorio.
export const DATOS_REALES_STOKES: StokesItem[] = [];
