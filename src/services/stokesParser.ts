import * as XLSX from 'xlsx';
import { z } from 'zod';
import { normalizeCompanyName } from '../utils/dataProcessor';

/**
 * Plantas autorizadas en Salar de Atacama para el Reporte Stokes.
 */
export const AUTHORIZED_MOP_PLANTS = ['1', '2', '3', '4', '5', '6'] as const;
export type MopPlantNumber = (typeof AUTHORIZED_MOP_PLANTS)[number];

const MOP_REGEX = /^Salar(?:\s+de)?\s+Atacama[\s,;-]*Mop[\s(]*([1-6])[\s)]*$/i;
const PATENTE_REGEX = /^[A-Z0-9-]{4,10}$/;

/**
 * Convierte fechas de texto o serial numérico de Excel a formato ISO YYYY-MM-DD
 * o preserva DD-MM-YYYY legible si no es serial.
 */
export function parseStokesDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 25000 && raw < 80000) {
    // Serial de fecha Excel (epoch 1899-12-30)
    const utcDays = Math.floor(raw - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const str = String(raw).trim();
  if (!str) return '';

  // DD/MM/YYYY o DD-MM-YYYY (con o sin hora)
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  return str.slice(0, 32);
}

/**
 * Parsea números en formato chileno ("1.250,45") o estándar ("1250.45").
 * Retorna NaN si el texto contiene basura no numérica para que Zod pueda detectarlo.
 */
export function parseStrictStokesNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : Number.NaN;
  }
  if (raw === null || raw === undefined) return Number.NaN;
  const trimmed = String(raw).trim();
  if (!trimmed) return Number.NaN;

  let normalized = trimmed.replace(/\s+/g, '');
  if (normalized.includes('.') && normalized.includes(',')) {
    const lastDot = normalized.lastIndexOf('.');
    const lastComma = normalized.lastIndexOf(',');
    normalized = lastDot < lastComma
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  } else if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      normalized = normalized.replace('.', '');
    }
  }

  // Rechaza cadenas que tengan letras mezcladas (ej. "28ABC")
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : Number.NaN;
}

export function extractMopPlant(rawAlmacen: string): {
  origenStokes: string;
  mopPlant: `Mop ${MopPlantNumber}` | null;
  isMop1to6: boolean;
} {
  const cleaned = String(rawAlmacen || '').trim();
  if (!cleaned) {
    return { origenStokes: '—', mopPlant: null, isMop1to6: false };
  }

  const exactMatch = cleaned.match(MOP_REGEX);
  if (exactMatch) {
    const plantNum = exactMatch[1] as MopPlantNumber;
    return {
      origenStokes: 'Salar',
      mopPlant: `Mop ${plantNum}`,
      isMop1to6: true,
    };
  }

  // Tolerancia a variantes menores como "MOP 3 - SALAR" o "Salar Atacama Mop4"
  const fuzzyMatch = cleaned.match(/\bMop\s*[-()]?\s*([1-6])\b/i);
  if (fuzzyMatch && /salar|mop/i.test(cleaned)) {
    const plantNum = fuzzyMatch[1] as MopPlantNumber;
    return {
      origenStokes: 'Salar',
      mopPlant: `Mop ${plantNum}`,
      isMop1to6: true,
    };
  }

  return {
    origenStokes: cleaned,
    mopPlant: null,
    isMop1to6: false,
  };
}

export const StokesRecordSchema = z.object({
  guia: z
    .string()
    .trim()
    .min(1, 'Número de guía vacío')
    .max(64, 'Número de guía excede longitud máxima')
    .refine(
      (val) => !/^(gu[ií]a|hist[oó]rico|total|subtotal|resumen)$/i.test(val),
      'Fila de encabezado o total detectada'
    ),
  fechaGuia: z
    .string()
    .trim()
    .min(4, 'Fecha de guía inválida o faltante')
    .max(32, 'Fecha excede longitud máxima'),
  producto: z
    .string()
    .trim()
    .min(1, 'Producto no especificado')
    .max(128, 'Nombre de producto demasiado largo'),
  cantDespacho: z
    .number({ message: 'Cantidad despachada debe ser numérica' })
    .finite('Cantidad despachada no es finita')
    .nonnegative('Cantidad despachada no puede ser negativa')
    .max(500, 'Cantidad despachada supera límite físico por equipo (500 TON)'),
  almacenDespachoRaw: z
    .string()
    .trim()
    .min(1, 'Almacén de despacho vacío')
    .max(160),
  origenStokes: z.string().trim().min(1).max(160),
  mopPlant: z.enum(['Mop 1', 'Mop 2', 'Mop 3', 'Mop 4', 'Mop 5', 'Mop 6']).nullable(),
  almacenDestino: z
    .string()
    .trim()
    .min(1, 'Almacén de destino vacío')
    .max(160),
  transportista: z
    .string()
    .trim()
    .min(1, 'Transportista vacío')
    .max(160),
  patenteCamion: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => PATENTE_REGEX.test(val), 'Formato de patente inválido'),
  estadoGuia: z.string().trim().max(64).optional(),
  tipoDespacho: z.string().trim().max(64).optional(),
  emisorGuia: z.string().trim().max(128).optional(),
  nave: z.string().trim().max(128).optional(),
  cliente: z.string().trim().max(128).optional(),
  conductor: z.string().trim().max(128).optional(),
});

export type ValidatedStokesItem = z.infer<typeof StokesRecordSchema>;

export interface StokesQuarantineItem {
  rowIndex: number;
  rawRow: Record<string, unknown>;
  reasons: Array<{ field: string; message: string }>;
  timestamp: string;
}

export interface StokesParseLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  code: string;
  rowIndex?: number;
  guia?: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface StokesParseSummary {
  totalRowsScanned: number;
  validCount: number;
  quarantinedCount: number;
  skippedStructuralRows: number;
  totalTonnage: number;
  mopBreakdown: Record<string, { count: number; tonnage: number }>;
  durationMs: number;
}

export interface StokesParseResult {
  validRecords: ValidatedStokesItem[];
  quarantinedRecords: StokesQuarantineItem[];
  logs: StokesParseLogEntry[];
  summary: StokesParseSummary;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  guia: ['guía', 'guia', 'n° guía', 'n° guia', 'nro guia', 'numero guia'],
  fecha: ['fecha guía', 'fecha guia', 'fecha'],
  producto: ['producto', 'material', 'descripcion producto'],
  cant: ['cantidad despacho', 'cant despacho', 'cant. despacho', 'tonelaje', 'cantidad'],
  almacenDespacho: ['almacen despacho', 'almacén despacho', 'origen', 'planta origen'],
  almacenDestino: ['almacen destino', 'almacén destino', 'destino'],
  transportista: ['transportista', 'empresa transporte', 'empresa'],
  patente: ['patente', 'patente camion', 'patente camión', 'placa'],
  estado: ['estado', 'estado guia', 'estado guía'],
  tipoDespacho: ['tipo despacho'],
  conductor: ['conductor', 'chofer'],
};

function createLog(
  level: StokesParseLogEntry['level'],
  code: string,
  message: string,
  extra?: Partial<Omit<StokesParseLogEntry, 'timestamp' | 'level' | 'code' | 'message'>>
): StokesParseLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    code,
    message,
    ...extra,
  };
}

/**
 * Motor de ingesta defensivo para Reporte Stokes (Plantas Mop 1-6).
 * - Detecta encabezados dinámicamente hasta la fila 20.
 * - Tolera celdas nulas o variaciones menores de formato.
 * - Aísla filas inválidas en `quarantinedRecords` en lugar de abortar el archivo completo.
 * - Emite logs estructurados para trazabilidad industrial sin derribar la UI.
 */
export function parseStokesRows(rawRows: unknown[][]): StokesParseResult {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const logs: StokesParseLogEntry[] = [];
  const validRecords: ValidatedStokesItem[] = [];
  const quarantinedRecords: StokesQuarantineItem[] = [];
  const mopBreakdown: Record<string, { count: number; tonnage: number }> = {
    'Mop 1': { count: 0, tonnage: 0 },
    'Mop 2': { count: 0, tonnage: 0 },
    'Mop 3': { count: 0, tonnage: 0 },
    'Mop 4': { count: 0, tonnage: 0 },
    'Mop 5': { count: 0, tonnage: 0 },
    'Mop 6': { count: 0, tonnage: 0 },
    Otro: { count: 0, tonnage: 0 },
  };

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    logs.push(createLog('warn', 'STOKES_EMPTY_SHEET', 'La hoja de cálculo no contiene filas.'));
    return {
      validRecords,
      quarantinedRecords,
      logs,
      summary: {
        totalRowsScanned: 0,
        validCount: 0,
        quarantinedCount: 0,
        skippedStructuralRows: 0,
        totalTonnage: 0,
        mopBreakdown,
        durationMs: 0,
      },
    };
  }

  let headerRowIndex = -1;
  const indices: Record<string, number> = {};

  for (let rowIndex = 0; rowIndex < Math.min(rawRows.length, 25); rowIndex++) {
    const row = rawRows[rowIndex];
    if (!Array.isArray(row)) continue;

    const normalized = row.map((cell) => String(cell ?? '').toLowerCase().trim());
    const candidateIndices: Record<string, number> = {};

    normalized.forEach((cell, columnIndex) => {
      if (!cell) return;
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (candidateIndices[key] === undefined && aliases.some((alias) => cell.includes(alias))) {
          candidateIndices[key] = columnIndex;
        }
      }
    });

    // Exigir al menos 'guia' y 2 columnas adicionales para no confundir títulos banner (ej. "REPORTE HISTÓRICO DE GUÍAS")
    if (candidateIndices.guia !== undefined && Object.keys(candidateIndices).length >= 3) {
      headerRowIndex = rowIndex;
      Object.assign(indices, candidateIndices);
      break;
    }
  }

  const requiredCols = ['guia', 'fecha', 'producto', 'cant', 'almacenDespacho', 'almacenDestino', 'transportista', 'patente'];
  const missingCols = requiredCols.filter((key) => indices[key] === undefined);

  if (headerRowIndex < 0 || missingCols.length > 0) {
    const errorMsg = `Encabezados inválidos o columnas requeridas faltantes: ${missingCols.join(', ') || 'fila de encabezados no encontrada'}`;
    logs.push(createLog('error', 'STOKES_HEADER_MISMATCH', errorMsg, { context: { missingCols, headerRowIndex } }));
    throw new Error(errorMsg);
  }

  logs.push(
    createLog('info', 'STOKES_HEADERS_DETECTED', `Encabezados detectados en fila ${headerRowIndex + 1}.`, {
      rowIndex: headerRowIndex + 1,
      context: { indices },
    })
  );

  let skippedStructuralRows = 0;
  let totalTonnage = 0;

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const excelRowNum = i + 1;

    // Saltar filas completamente vacías sin enviar a cuarentena
    if (!Array.isArray(row) || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) {
      skippedStructuralRows++;
      continue;
    }

    const rawGuia = String(row[indices.guia] ?? '').trim();
    // Ignorar filas de cierre/totales del ReportServer
    if (!rawGuia && row.some((c) => /total|página|generado|reporte/i.test(String(c ?? '')))) {
      skippedStructuralRows++;
      continue;
    }
    if (/^(gu[ií]a|n°\s*gu[ií]a|hist[oó]rico|total\s+general)/i.test(rawGuia)) {
      skippedStructuralRows++;
      continue;
    }

    const rawAlmacenDespacho = String(row[indices.almacenDespacho] ?? '').trim();
    const mopMeta = extractMopPlant(rawAlmacenDespacho);
    const rawCant = row[indices.cant];
    const parsedCant = parseStrictStokesNumber(rawCant);
    const rawTransportista = String(row[indices.transportista] ?? '').trim();
    const normalizedCarrier = rawTransportista ? normalizeCompanyName(rawTransportista) : '';
    const rawPatente = String(row[indices.patente] ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    const candidate = {
      guia: rawGuia,
      fechaGuia: parseStokesDate(row[indices.fecha]),
      producto: String(row[indices.producto] ?? '').trim(),
      cantDespacho: parsedCant,
      almacenDespachoRaw: rawAlmacenDespacho,
      origenStokes: mopMeta.origenStokes,
      mopPlant: mopMeta.mopPlant,
      almacenDestino: String(row[indices.almacenDestino] ?? '').trim(),
      transportista: normalizedCarrier,
      patenteCamion: rawPatente,
      estadoGuia: indices.estado !== undefined ? String(row[indices.estado] ?? '').trim() || undefined : undefined,
      tipoDespacho: indices.tipoDespacho !== undefined ? String(row[indices.tipoDespacho] ?? '').trim() || undefined : undefined,
      conductor: indices.conductor !== undefined ? String(row[indices.conductor] ?? '').trim() || undefined : undefined,
    };

    const result = StokesRecordSchema.safeParse(candidate);

    if (result.success) {
      const valid = result.data;
      validRecords.push(valid);
      totalTonnage += valid.cantDespacho;

      const bucketKey = valid.mopPlant ?? 'Otro';
      if (!mopBreakdown[bucketKey]) {
        mopBreakdown[bucketKey] = { count: 0, tonnage: 0 };
      }
      mopBreakdown[bucketKey].count += 1;
      mopBreakdown[bucketKey].tonnage += valid.cantDespacho;

      // Advertencia estructurada si la planta origen no corresponde a Mop 1-6 estándar
      if (!mopMeta.isMop1to6) {
        logs.push(
          createLog('warn', 'STOKES_NON_MOP_ORIGIN', `Fila ${excelRowNum} (Guía ${valid.guia}): almacén "${rawAlmacenDespacho}" no corresponde a Mop 1-6.`, {
            rowIndex: excelRowNum,
            guia: valid.guia,
          })
        );
      }
    } else {
      const reasons = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'fila',
        message: issue.message,
      }));

      quarantinedRecords.push({
        rowIndex: excelRowNum,
        rawRow: {
          guia: rawGuia,
          fecha: row[indices.fecha] ?? null,
          producto: row[indices.producto] ?? null,
          cantDespacho: rawCant ?? null,
          almacenDespacho: rawAlmacenDespacho,
          almacenDestino: row[indices.almacenDestino] ?? null,
          transportista: rawTransportista,
          patente: rawPatente,
        },
        reasons,
        timestamp: new Date().toISOString(),
      });

      logs.push(
        createLog(
          'warn',
          'STOKES_ROW_QUARANTINED',
          `Fila ${excelRowNum} enviada a cuarentena: ${reasons.map((r) => `${r.field} (${r.message})`).join('; ')}`,
          {
            rowIndex: excelRowNum,
            guia: rawGuia || 'SIN_GUIA',
            context: { reasons },
          }
        )
      );
    }
  }

  const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const durationMs = Math.max(0, Math.round(endedAt - startedAt));

  logs.push(
    createLog(
      'info',
      'STOKES_PARSE_COMPLETE',
      `Ingesta finalizada en ${durationMs}ms: ${validRecords.length} válidas, ${quarantinedRecords.length} en cuarentena.`,
      {
        context: {
          validCount: validRecords.length,
          quarantinedCount: quarantinedRecords.length,
          totalTonnage: Number(totalTonnage.toFixed(2)),
        },
      }
    )
  );

  return {
    validRecords,
    quarantinedRecords,
    logs,
    summary: {
      totalRowsScanned: rawRows.length - (headerRowIndex + 1) - skippedStructuralRows,
      validCount: validRecords.length,
      quarantinedCount: quarantinedRecords.length,
      skippedStructuralRows,
      totalTonnage: Number(totalTonnage.toFixed(2)),
      mopBreakdown,
      durationMs,
    },
  };
}

/**
 * Lee un buffer binario Excel (.xlsx / .xls) y ejecuta el motor Zod con cuarentena.
 */
export function parseStokesWorkbook(data: ArrayBuffer | Uint8Array): StokesParseResult {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El libro Excel no contiene hojas válidas.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return parseStokesRows(rawRows);
}
