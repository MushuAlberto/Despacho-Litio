/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { DailyLog, ParseResult, ExcelOverrides } from "../types";

/**
 * Normaliza encabezados removiendo tildes, signos y espacios redundantes
 */
export function normalizeHeader(h: any): string {
  return String(h || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Limpia y parsea valores numéricos en formato chileno o internacional
 * Ejemplos: "2.707,50", "2.708", "2613.83", "2.613,83 Ton", "95 viajes"
 */
export function cleanNumeric(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Remover palabras/unidades habituales
  str = str
    .replace(/[tT]on(?:eladas?)?/gi, "")
    .replace(/\b[tT]\b/g, "")
    .replace(/m3|m³|viajes|vueltas|camiones|hrs|horas/gi, "")
    .replace(/[%$]/g, "")
    .trim();

  if (str.includes(".") && str.includes(",")) {
    const lastDotIdx = str.lastIndexOf(".");
    const lastCommaIdx = str.lastIndexOf(",");
    if (lastDotIdx < lastCommaIdx) {
      // 2.707,50 -> punto miles, coma decimal
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // 2,707.50 -> coma miles, punto decimal
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      // Formato miles chileno sin decimales: 2.708 -> 2708
      str = str.replace(".", "");
    }
  }

  const num = parseFloat(str.replace(/[^-0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * Extrae de forma segura el valor de una celda específica (ej. "G36", "M36")
 */
function getCellValue(worksheet: XLSX.WorkSheet | undefined, address: string): number | undefined {
  if (!worksheet) return undefined;
  const cell = worksheet[address];
  if (!cell || cell.v === null || cell.v === undefined) return undefined;
  const num = cleanNumeric(cell.v);
  return isNaN(num) ? undefined : num;
}

/**
 * Mapeo de meses en español
 */
const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8, set: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11,
};

/**
 * Parsea fechas textuales en español (ej. "20-may-2026", "20 de mayo 2026")
 */
function parseSpanishDateString(str: string): string | null {
  const normalized = str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.-]/g, "/");

  const parts = normalized.split(/[\s/]+/);
  if (parts.length >= 3) {
    let dayStr = parts[0];
    let monthStr = parts[1];
    let yearStr = parts[2];

    if (dayStr.length === 4) {
      const tmp = dayStr;
      dayStr = yearStr;
      yearStr = tmp;
    }

    const day = parseInt(dayStr, 10);
    let year = parseInt(yearStr, 10);
    if (isNaN(day) || isNaN(year)) return null;
    if (year < 100) year += 2000;

    let monthIndex = SPANISH_MONTHS[monthStr];
    if (monthIndex === undefined) {
      const numericMonth = parseInt(monthStr, 10);
      if (!isNaN(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
        monthIndex = numericMonth - 1;
      }
    }

    if (monthIndex !== undefined) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Parsea cualquier valor de celda a formato estándar ISO YYYY-MM-DD.
 * Inmune a problemas de zonas horarias en números de serie Excel.
 */
export function parseCellAsDate(val: any): string | null {
  if (val === null || val === undefined) return null;

  // 1. Número de serie Excel (días desde 1900)
  if (typeof val === "number") {
    if (val > 20000 && val < 80000) {
      const serialDay = Math.floor(val);
      const d = new Date(Math.round((serialDay - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      }
    }
    return null;
  }

  // 2. Instancia Date de Javascript
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
    }
    return null;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 3. DD-MM-YYYY o DD/MM/YYYY o DD.MM.YYYY (con o sin hora adjunta)
  const dPartsReverse = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
  if (dPartsReverse) {
    let year = parseInt(dPartsReverse[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${dPartsReverse[2].padStart(2, "0")}-${dPartsReverse[1].padStart(2, "0")}`;
  }

  // 4. YYYY-MM-DD o YYYY/MM/DD o YYYY.MM.DD (con o sin hora adjunta)
  const dParts = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+[T\d:]+)?/);
  if (dParts) {
    return `${dParts[1]}-${dParts[2].padStart(2, "0")}-${dParts[3].padStart(2, "0")}`;
  }

  // 5. Nombres de mes en español
  const spanishParsed = parseSpanishDateString(str);
  if (spanishParsed) return spanishParsed;

  // 6. Fallback a Date nativo
  const dObj = new Date(str);
  if (!isNaN(dObj.getTime()) && dObj.getFullYear() > 2000 && dObj.getFullYear() < 2100) {
    return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
  }

  return null;
}

/**
 * Identifica si una fila es una fila de resumen, totales o acumulación
 */
function isTotalOrSummaryRow(row: any[]): boolean {
  if (!row || !Array.isArray(row)) return false;
  const keywords = [
    "TOTAL",
    "SUBTOTAL",
    "ACUMULAD",
    "RESUMEN",
    "PROMEDI",
    "SUMA",
    "CUMPLIM",
    "MENSUAL",
    "ANUAL",
    "BALANCE",
    "CONTROL",
    "MTD",
    "M MTD",
  ];

  for (let c = 0; c < Math.min(row.length, 10); c++) {
    const val = row[c];
    if (val !== undefined && val !== null) {
      const s = normalizeHeader(val);
      if (keywords.some((kw) => s.includes(kw))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Normaliza nombres de hojas para búsqueda insensible a mayúsculas y tildes
 */
function findSheetName(workbook: XLSX.WorkBook, targetName: string): string | undefined {
  const normTarget = normalizeHeader(targetName).toLowerCase();
  return workbook.SheetNames.find((name) => {
    const norm = normalizeHeader(name).toLowerCase();
    return norm === normTarget || norm.includes(normTarget);
  });
}

/**
 * Detecta dinámicamente la fila de encabezados y mapea los índices de columnas
 */
function detectHeaderRowAndIndices(rows: any[][]): {
  headerRowIdx: number;
  indices: {
    fecha: number;
    tonDesp: number;
    tonProg: number;
    viajesReal: number;
    viajesProg: number;
    m3: number;
    lceActual: number;
    lceProg: number;
    prodProg: number;
    prodReal: number;
    nivelPozas: number;
    guia: number;
  };
} | null {
  let bestIdx = -1;
  let bestScore = -1;
  let bestIndices = {
    fecha: -1,
    tonDesp: -1,
    tonProg: -1,
    viajesReal: -1,
    viajesProg: -1,
    m3: -1,
    lceActual: -1,
    lceProg: -1,
    prodProg: -1,
    prodReal: -1,
    nivelPozas: -1,
    guia: -1,
  };

  const scanLimit = Math.min(rows.length, 35);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const rowHeaders = row.map((cell) => normalizeHeader(cell));

    let idxFecha = -1;
    let idxTonDesp = -1;
    let idxTonProg = -1;
    let idxViajesReal = -1;
    let idxViajesProg = -1;
    let idxM3 = -1;
    let idxLceActual = -1;
    let idxLceProg = -1;
    let idxProdProg = -1;
    let idxProdReal = -1;
    let idxNivelPozas = -1;
    let idxGuia = -1;

    let score = 0;

    for (let c = 0; c < rowHeaders.length; c++) {
      const h = rowHeaders[c];
      if (!h) continue;

      // FECHA
      if (
        idxFecha === -1 &&
        (h.includes("FECHA") || h.includes("DATE") || h === "DIA" || h.includes("F DESPACHO") || h.includes("F GUIA"))
      ) {
        idxFecha = c;
        score += 8;
      }
      // TONELAJE PROGRAMADO
      else if (
        idxTonProg === -1 &&
        (h.includes("TONELADAS PROGRAMADAS") ||
          h.includes("TONELADAS PROG") ||
          h.includes("TON PROGRAMADAS") ||
          h.includes("TON PROG") ||
          h.includes("PROG TON") ||
          h.includes("PROGRAMADAS TON") ||
          h.includes("PROGRAMADO TON") ||
          h.includes("META TON") ||
          (h.includes("PROGRAMAD") && (h.includes("TON") || h.includes("T"))))
      ) {
        idxTonProg = c;
        score += 4;
      }
      // TONELAJE DESPACHADO / REAL
      else if (
        idxTonDesp === -1 &&
        (h.includes("TONELADAS DESPACHADAS") ||
          h.includes("TONELADAS DESP") ||
          h.includes("TON DESPACHADAS") ||
          h.includes("TON DESP") ||
          h.includes("DESPACHADO TON") ||
          h.includes("DESP TON") ||
          h.includes("TONELADAS REAL") ||
          h.includes("TON REAL") ||
          h.includes("REAL TON") ||
          h.includes("CANTIDAD DESPACHO") ||
          h.includes("CANT DESPACHO") ||
          h.includes("TONELADAS EFECTIVAS") ||
          h.includes("PESO NETO") ||
          h === "TONELADAS" ||
          h === "DESPACHADO" ||
          h === "REAL")
      ) {
        idxTonDesp = c;
        score += 5;
      }
      // VIAJES PROGRAMADOS
      else if (
        idxViajesProg === -1 &&
        (h.includes("VIAJES PROGRAMADOS") ||
          h.includes("VIAJES PROG") ||
          h.includes("CAMIONES PROG") ||
          h.includes("CAMIONES PROGRAMADOS") ||
          h.includes("VUELTAS PROG"))
      ) {
        idxViajesProg = c;
        score += 3;
      }
      // VIAJES REALIZADOS / DESPACHADOS
      else if (
        idxViajesReal === -1 &&
        (h.includes("VIAJES REALIZADOS") ||
          h.includes("VIAJES DESPACHADOS") ||
          h.includes("VIAJES REAL") ||
          h.includes("CAMIONES REAL") ||
          h.includes("CAMIONES DESPACHADOS") ||
          h.includes("CANTIDAD CAMIONES") ||
          h.includes("CANT CAMIONES") ||
          h.includes("VUELTAS REAL") ||
          h.includes("VIAJES EFECTIVOS") ||
          h.includes("N VIAJES") ||
          h === "VIAJES" ||
          h === "CAMIONES" ||
          h === "VUELTAS")
      ) {
        idxViajesReal = c;
        score += 3;
      }
      // M3 / VOLUMEN
      else if (
        idxM3 === -1 &&
        (h.includes("M3") || h.includes("METROS CUBICOS") || h.includes("VOLUMEN"))
      ) {
        idxM3 = c;
        score += 3;
      }
      // LCE PROGRAMADO
      else if (
        idxLceProg === -1 &&
        (h.includes("LCE PROGRAMADO") || h.includes("LCE PROG") || h.includes("LCE META") || h.includes("META LCE"))
      ) {
        idxLceProg = c;
        score += 3;
      }
      // LCE ACTUAL / REAL / SDA
      else if (
        idxLceActual === -1 &&
        (h.includes("LCE ACTUAL") ||
          h.includes("LCE REAL") ||
          h.includes("LCE SDA") ||
          h.includes("LCE DESPACHADO") ||
          h.includes("LCE EFECTIVO") ||
          h === "LCE")
      ) {
        idxLceActual = c;
        score += 4;
      }
      // PRODUCTIVIDAD PROGRAMADA (COL F)
      else if (
        idxProdProg === -1 &&
        (h.includes("PRODUCTIVIDAD PROGRAMADA") ||
          h.includes("PRODUCTIVIDAD PROG") ||
          h.includes("PROD PROG") ||
          h === "COLUMNA F" ||
          h === "COL F")
      ) {
        idxProdProg = c;
        score += 2;
      }
      // PRODUCTIVIDAD REAL (COL G)
      else if (
        idxProdReal === -1 &&
        (h.includes("PRODUCTIVIDAD REAL") ||
          h.includes("PRODUCTIVIDAD EFECTIVA") ||
          h.includes("PROD REAL") ||
          h === "COLUMNA G" ||
          h === "COL G")
      ) {
        idxProdReal = c;
        score += 2;
      }
      // NIVEL POZAS PQLC
      else if (
        idxNivelPozas === -1 &&
        (h.includes("NIVEL POZAS") || h.includes("POZAS PQLC") || h.includes("PQLC") || h === "POZAS")
      ) {
        idxNivelPozas = c;
        score += 2;
      }
      // GUIA DE DESPACHO
      else if (
        idxGuia === -1 &&
        (h.includes("GUIA") || h.includes("N GUIA") || h.includes("NUMERO GUIA") || h.includes("TICKET"))
      ) {
        idxGuia = c;
        score += 2;
      }
    }

    // Debe contener al menos la columna Fecha y alguna métrica para ser considerado encabezado
    if (idxFecha !== -1 && score > bestScore) {
      bestScore = score;
      bestIdx = r;
      bestIndices = {
        fecha: idxFecha,
        tonDesp: idxTonDesp,
        tonProg: idxTonProg,
        viajesReal: idxViajesReal,
        viajesProg: idxViajesProg,
        m3: idxM3,
        lceActual: idxLceActual,
        lceProg: idxLceProg,
        prodProg: idxProdProg,
        prodReal: idxProdReal,
        nivelPozas: idxNivelPozas,
        guia: idxGuia,
      };
    }
  }

  if (bestIdx !== -1) {
    return { headerRowIdx: bestIdx, indices: bestIndices };
  }
  return null;
}

/**
 * Parsea una hoja de cálculo completa en registros operativos DailyLog
 */
function parseWorksheetToDailyLogs(worksheet: XLSX.WorkSheet): DailyLog[] | null {
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: true, defval: null });
  if (!rows || rows.length < 2) return null;

  const detected = detectHeaderRowAndIndices(rows);
  if (!detected) return null;

  const { headerRowIdx, indices } = detected;

  // Mapa para acumular por fecha en caso de que el archivo contenga 1 fila por camión/guía
  const dateMap = new Map<
    string,
    {
      toneladasProgramadas: number;
      toneladasDespachadas: number;
      viajesProgramados: number;
      viajesRealizados: number;
      m3Despachados: number;
      lceActual: number;
      lceProgramado: number;
      nivelPozasPqlc: string;
      productividadProgramada?: number;
      productividadReal?: number;
      rowCount: number;
    }
  >();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length <= indices.fecha) continue;

    // Saltar filas de totales/resúmenes
    if (isTotalOrSummaryRow(row)) continue;

    const cellFecha = row[indices.fecha];
    if (cellFecha === undefined || cellFecha === null) continue;

    const dateStr = parseCellAsDate(cellFecha);
    if (!dateStr) continue;

    // Extraer valores numéricos de la fila
    const tonDesp = indices.tonDesp !== -1 ? cleanNumeric(row[indices.tonDesp]) : 0;
    const tonProg = indices.tonProg !== -1 ? cleanNumeric(row[indices.tonProg]) : 0;
    const viajesReal = indices.viajesReal !== -1 ? Math.round(cleanNumeric(row[indices.viajesReal])) : 0;
    const viajesProg = indices.viajesProg !== -1 ? Math.round(cleanNumeric(row[indices.viajesProg])) : 0;
    const m3Val = indices.m3 !== -1 ? cleanNumeric(row[indices.m3]) : 0;
    const lceActualVal = indices.lceActual !== -1 ? cleanNumeric(row[indices.lceActual]) : 0;
    const lceProgVal = indices.lceProg !== -1 ? cleanNumeric(row[indices.lceProg]) : 845.18;

    const prodProgVal =
      indices.prodProg !== -1 ? cleanNumeric(row[indices.prodProg]) : undefined;
    const prodRealVal =
      indices.prodReal !== -1 ? cleanNumeric(row[indices.prodReal]) : undefined;

    let nivelPozasVal = "S/D";
    if (indices.nivelPozas !== -1 && row[indices.nivelPozas] !== undefined && row[indices.nivelPozas] !== null) {
      const pRaw = row[indices.nivelPozas];
      if (typeof pRaw === "number") {
        if (pRaw > 0 && pRaw <= 1) {
          nivelPozasVal = `${Math.round(pRaw * 100)}%`;
        } else if (pRaw > 1 && pRaw <= 100) {
          nivelPozasVal = `${Math.round(pRaw)}%`;
        } else {
          nivelPozasVal = String(pRaw);
        }
      } else {
        const s = String(pRaw).trim();
        if (s) nivelPozasVal = s;
      }
    }

    // Filtrar falsos positivos de acumulados mensuales gigantescos en una sola fila
    if (tonDesp > 25000 || tonProg > 25000 || viajesReal > 800 || viajesProg > 800) {
      continue;
    }

    // Acumular o registrar por fecha
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        toneladasProgramadas: tonProg,
        toneladasDespachadas: tonDesp,
        viajesProgramados: viajesProg,
        viajesRealizados: viajesReal > 0 ? viajesReal : tonDesp > 0 ? 1 : 0,
        m3Despachados: m3Val,
        lceActual: lceActualVal,
        lceProgramado: lceProgVal,
        nivelPozasPqlc: nivelPozasVal,
        productividadProgramada: prodProgVal && prodProgVal > 0 ? prodProgVal : undefined,
        productividadReal: prodRealVal && prodRealVal > 0 ? prodRealVal : undefined,
        rowCount: 1,
      });
    } else {
      const existing = dateMap.get(dateStr)!;
      existing.toneladasDespachadas += tonDesp;
      existing.viajesRealizados += viajesReal > 0 ? viajesReal : tonDesp > 0 ? 1 : 0;
      existing.m3Despachados += m3Val;
      existing.lceActual += lceActualVal;
      if (tonProg > 0 && existing.toneladasProgramadas === 0) existing.toneladasProgramadas = tonProg;
      if (viajesProg > 0 && existing.viajesProgramados === 0) existing.viajesProgramados = viajesProg;
      if (nivelPozasVal !== "S/D") existing.nivelPozasPqlc = nivelPozasVal;
      if (prodProgVal && prodProgVal > 0) existing.productividadProgramada = prodProgVal;
      if (prodRealVal && prodRealVal > 0) existing.productividadReal = prodRealVal;
      existing.rowCount += 1;
    }
  }

  if (dateMap.size === 0) return null;

  // Convertir a lista de DailyLog con deducciones lógicas de seguridad
  const logs: DailyLog[] = Array.from(dateMap.entries()).map(([dateStr, d]) => {
    let tonDesp = parseFloat(d.toneladasDespachadas.toFixed(2));
    let tonProg = parseFloat(d.toneladasProgramadas.toFixed(2));
    let viajesReal = d.viajesRealizados;
    let viajesProg = d.viajesProgramados;
    let m3 = parseFloat(d.m3Despachados.toFixed(2));
    let lce = parseFloat(d.lceActual.toFixed(2));

    // Si el archivo era detalle de guías/camiones individuales:
    if (d.rowCount > 1) {
      if (viajesProg === 0) viajesProg = 95;
      if (tonProg === 0) tonProg = 2707.5;
    } else {
      // Si era fila diaria y no trae viajes pero sí tonelaje:
      if (viajesReal === 0 && tonDesp > 0) {
        viajesReal = Math.round(tonDesp / 29.01);
      }
      if (viajesProg === 0 && tonProg > 0) {
        viajesProg = 95;
      }
    }

    // Calcular m3 y LCE si venían en 0 pero hay tonelaje
    if (m3 === 0 && tonDesp > 0) {
      m3 = parseFloat((tonDesp / 1.26714).toFixed(2));
    }
    if (lce === 0 && tonDesp > 0) {
      lce = parseFloat((tonDesp * 0.3061).toFixed(2));
    }

    return {
      id: dateStr,
      fecha: dateStr,
      toneladasProgramadas: tonProg,
      toneladasDespachadas: tonDesp,
      viajesProgramados: viajesProg,
      viajesRealizados: viajesReal,
      m3Despachados: m3,
      lceProgramado: d.lceProgramado > 0 ? d.lceProgramado : 845.18,
      lceActual: lce,
      nivelPozasPqlc: d.nivelPozasPqlc,
      productividadProgramada: d.productividadProgramada,
      productividadReal: d.productividadReal,
    };
  });

  logs.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return logs.length > 0 ? logs : null;
}

/**
 * Genera y descarga la plantilla oficial Excel para control de Despacho Litio
 */
export function downloadExcelTemplate(logs: DailyLog[]) {
  const data = logs.map((log) => ({
    "Fecha (AAAA-MM-DD)": log.fecha,
    "Toneladas Programadas": log.toneladasProgramadas,
    "Viajes Programados": log.viajesProgramados,
    "Toneladas Despachadas": log.toneladasDespachadas,
    "Viajes Realizados": log.viajesRealizados,
    "Productividad Programada (Col F)": log.productividadProgramada ?? 1.3,
    "Productividad Real (Col G)":
      log.productividadReal ??
      (log.m3Despachados > 0
        ? parseFloat(((log.toneladasDespachadas / log.m3Despachados) * 1.14417).toFixed(2))
        : 1.45),
    "m3 Despachados": log.m3Despachados,
    "LCE Programado": log.lceProgramado,
    "LCE Actual": log.lceActual,
    "Nivel Pozas PQLC": log.nivelPozasPqlc,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registro Diario");

  const maxW = [16, 20, 18, 20, 18, 22, 22, 16, 16, 16, 16];
  worksheet["!cols"] = maxW.map((w) => ({ wch: w }));

  XLSX.writeFile(workbook, "Plantilla_Despacho_Litio.xlsx");
}

/**
 * Parsea cualquier archivo Excel o CSV cargado por el usuario con máxima compatibilidad
 */
export async function parseUploadedExcel(file: File): Promise<ParseResult> {
  let data: ArrayBuffer;
  if (typeof file.arrayBuffer === "function") {
    data = await file.arrayBuffer();
  } else {
    data = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) resolve(e.target.result);
        else reject(new Error("No se pudo leer el archivo."));
      };
      reader.onerror = () => reject(new Error("Error físico al leer el archivo."));
      reader.readAsArrayBuffer(file);
    });
  }

  const workbook = XLSX.read(data, { type: "array" });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("El archivo no contiene ninguna hoja válida.");
  }

  let overrides: ExcelOverrides | undefined = undefined;

  // 1. Extraer overrides de hojas corporativas Químicas, Base SLIT o Resumen si existen
  const quimicasSheetName = findSheetName(workbook, "Químicas");
  const resumenSheetName = findSheetName(workbook, "Resumen");
  const blitSheetName =
    findSheetName(workbook, "Base SLIT") ||
    findSheetName(workbook, "BLIT") ||
    workbook.SheetNames.find((n) => {
      const low = n.toLowerCase();
      return low.includes("slit") || low.includes("blit");
    });

  if (quimicasSheetName || blitSheetName || resumenSheetName) {
    overrides = {};

    if (quimicasSheetName) {
      const sh = workbook.Sheets[quimicasSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1 });
      if (rows && rows.length > 0) {
        // Buscar fila con datos del mes
        for (let r = 2; r < Math.min(rows.length, 16); r++) {
          const row = rows[r];
          if (!row || row.length < 3) continue;
          const ton = cleanNumeric(row[2]);
          const m3 = cleanNumeric(row[1]);
          const avgTon = cleanNumeric(row[3]);
          const avgM3 = cleanNumeric(row[4]);
          const viajes = Math.round(cleanNumeric(row[5]));

          if (ton > 0) {
            overrides.tonelajeAcumulado = ton;
            if (m3 > 0) overrides.m3Acumulados = m3;
            if (avgTon > 0) overrides.promedioCamionTon = avgTon;
            if (avgM3 > 0) overrides.promedioCamionM3 = avgM3;
            if (viajes > 0) overrides.cantidadCamiones = viajes;
            break;
          }
        }
      }
    }

    if (blitSheetName) {
      const sh = workbook.Sheets[blitSheetName];
      // Leer celdas directas del informe Base SLIT
      const prod = getCellValue(sh, "G36");
      if (prod !== undefined && prod > 0) overrides.productividadMes = prod;

      const lceMVal = getCellValue(sh, "M36");
      if (lceMVal !== undefined && lceMVal > 0) overrides.lceActualTotal = lceMVal;

      const tonProgCum = getCellValue(sh, "B36");
      if (tonProgCum !== undefined && tonProgCum > 0) overrides.tonelajeProgramadoAcumulado = tonProgCum;

      const viajesProgCum = getCellValue(sh, "C36");
      if (viajesProgCum !== undefined && viajesProgCum > 0) overrides.viajesProgramadosAcumulados = Math.round(viajesProgCum);
    }

    if (resumenSheetName) {
      const sh = workbook.Sheets[resumenSheetName];
      const lceProgVal =
        getCellValue(sh, "F4") ??
        getCellValue(sh, "G4") ??
        getCellValue(sh, "H4") ??
        getCellValue(sh, "I4");
      if (lceProgVal !== undefined && lceProgVal > 0) {
        overrides.lceProgramadoTotal = lceProgVal;
      }
    }
  }

  // 2. Extraer registros diarios de la mejor hoja disponible
  let candidateSheets: string[] = [];

  if (blitSheetName) candidateSheets.push(blitSheetName);

  for (const name of workbook.SheetNames) {
    const lName = name.toLowerCase();
    if (
      lName.includes("registro") ||
      lName.includes("diario") ||
      lName.includes("despacho") ||
      lName.includes("control") ||
      lName.includes("lce") ||
      lName.includes("log") ||
      lName.includes("data")
    ) {
      if (!candidateSheets.includes(name)) candidateSheets.push(name);
    }
  }

  for (const name of workbook.SheetNames) {
    if (!candidateSheets.includes(name)) candidateSheets.push(name);
  }

  let parsedLogs: DailyLog[] | null = null;

  for (const sheetName of candidateSheets) {
    if (sheetName === quimicasSheetName || sheetName === resumenSheetName) continue;

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const result = parseWorksheetToDailyLogs(worksheet);
    if (result && result.length > 0) {
      parsedLogs = result;
      break;
    }
  }

  if (!parsedLogs || parsedLogs.length === 0) {
    throw new Error(
      "No se encontraron registros de días válidos en el archivo. Verifique que la planilla contenga columnas de Fecha y Toneladas/Despacho."
    );
  }

  return { logs: parsedLogs, overrides };
}
