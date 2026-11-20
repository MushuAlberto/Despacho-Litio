import { parseStokesWorkbook, normalizarAlmacenCompat } from './stokesBridge';
import type { StokesParseResult, ValidatedStokesItem } from '../services/stokesParser';

export interface StokesItem extends ValidatedStokesItem {}

export function normalizarAlmacenDespacho(raw: string): string {
  return normalizarAlmacenCompat(raw);
}

/**
 * Parsea un archivo Excel de Microsoft ReportServer (.xlsx / .xls) usando el motor Zod.
 * Conserva compatibilidad con llamadas legadas devolviendo únicamente los registros válidos.
 */
export function parsearExcelReportServer(data: ArrayBuffer | Uint8Array): StokesItem[] {
  const result = parseStokesWorkbook(data);
  return result.validRecords;
}

export function parsearExcelReportServerDetallado(data: ArrayBuffer | Uint8Array): StokesParseResult {
  return parseStokesWorkbook(data);
}

// Se mantiene el export por compatibilidad con código legado del servidor.
// Intencionalmente vacío: los datos operacionales no deben vivir en el repositorio.
export const DATOS_REALES_STOKES: StokesItem[] = [];
