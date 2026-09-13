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
  const trimmed = raw.trim();
  // Regla de Negocio Crítica: Si es cualquier variante de Salar Atacama MOP (1..6) o contiene Salar -> 'Salar'
  if (/^Salar Atacama,\s*Mop/i.test(trimmed) || trimmed.toLowerCase().includes('salar')) {
    return 'Salar';
  }
  return trimmed;
}

/**
 * Parsea un archivo Excel de Microsoft ReportServer (.xlsx / .xls)
 * Soporta detección automática por nombre de encabezados o por posición de columnas.
 */
export function parsearExcelReportServer(data: ArrayBuffer | Uint8Array): StokesItem[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!rawRows || rawRows.length === 0) {
    return [];
  }

  // Buscar fila de encabezados si existe
  let headerRowIndex = -1;
  let colIndices = {
    guia: 0,
    fecha: 1,
    producto: -1,
    cant: -1,
    almacenDespacho: -1,
    almacenDestino: -1,
    transportista: -1,
    patente: -1,
    estado: -1,
    tipoDespacho: -1
  };

  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;

    const rowStr = row.map(c => String(c || '').toLowerCase().trim());
    if (rowStr.some(c => c.includes('guía') || c.includes('guia') || c.includes('n° guía') || c.includes('n° guia'))) {
      headerRowIndex = i;
      row.forEach((cellVal, idx) => {
        const val = String(cellVal || '').toLowerCase().trim();
        if (val.includes('guía') || val.includes('guia')) colIndices.guia = idx;
        else if (val.includes('fecha')) colIndices.fecha = idx;
        else if (val.includes('producto')) colIndices.producto = idx;
        else if (val.includes('cant') && val.includes('despacho')) colIndices.cant = idx;
        else if (val.includes('almacen despacho') || val.includes('almacén despacho')) colIndices.almacenDespacho = idx;
        else if (val.includes('almacen destino') || val.includes('almacén destino')) colIndices.almacenDestino = idx;
        else if (val.includes('transportista')) colIndices.transportista = idx;
        else if (val.includes('patente')) colIndices.patente = idx;
        else if (val.includes('estado')) colIndices.estado = idx;
        else if (val.includes('tipo despacho')) colIndices.tipoDespacho = idx;
      });
      break;
    }
  }

  // Fallbacks si no se encontró fila de encabezados
  if (colIndices.producto === -1) colIndices.producto = 6;
  if (colIndices.cant === -1) colIndices.cant = 9; // o 13 según variante
  if (colIndices.almacenDespacho === -1) colIndices.almacenDespacho = 10; // Columna O es 14 en export amplio
  if (colIndices.almacenDestino === -1) colIndices.almacenDestino = 11; // Columna P es 15
  if (colIndices.transportista === -1) colIndices.transportista = 13; // Columna R es 17
  if (colIndices.patente === -1) colIndices.patente = 16; // Columna U es 20

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 8;
  const items: StokesItem[] = [];

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const guia = String(row[colIndices.guia] || row[0] || '').trim();
    if (!guia || guia.toLowerCase().includes('históricos') || guia.toLowerCase().includes('guías')) {
      continue;
    }

    // Identificar Almacen Despacho (priorizando Columna O / índice 14 o índice detectado)
    let almacenDespachoRaw = '';
    if (row[colIndices.almacenDespacho] !== undefined) {
      almacenDespachoRaw = String(row[colIndices.almacenDespacho] || '').trim();
    }
    if (!almacenDespachoRaw && row[14] !== undefined) {
      almacenDespachoRaw = String(row[14] || '').trim();
    }
    if (!almacenDespachoRaw && row[10] !== undefined) {
      almacenDespachoRaw = String(row[10] || '').trim();
    }

    let producto = '';
    if (colIndices.producto !== -1 && row[colIndices.producto]) {
      producto = String(row[colIndices.producto]).trim();
    } else if (row[6]) {
      producto = String(row[6]).trim();
    } else if (row[10]) {
      producto = String(row[10]).trim();
    }

    let cantDespacho = 0;
    const rawCant = row[colIndices.cant] ?? row[9] ?? row[13];
    if (rawCant !== undefined && rawCant !== null) {
      const numStr = String(rawCant).replace(',', '.').replace(/[^\d.-]/g, '');
      cantDespacho = parseFloat(numStr) || 0;
    }

    const almacenDestino = String(row[colIndices.almacenDestino] ?? row[11] ?? row[15] ?? '').trim();
    const transportista = String(row[colIndices.transportista] ?? row[13] ?? row[17] ?? '').trim();
    const patenteCamion = String(row[colIndices.patente] ?? row[16] ?? row[20] ?? '').trim();
    const fechaGuia = String(row[colIndices.fecha] ?? row[1] ?? '10-09-2026').trim();

    items.push({
      guia,
      fechaGuia,
      producto: producto || 'SIN ESPECIFICAR',
      cantDespacho,
      almacenDespachoRaw,
      origenStokes: normalizarAlmacenDespacho(almacenDespachoRaw),
      almacenDestino,
      transportista,
      patenteCamion,
      estadoGuia: colIndices.estado !== -1 ? String(row[colIndices.estado] || '') : 'Emitida',
      tipoDespacho: colIndices.tipoDespacho !== -1 ? String(row[colIndices.tipoDespacho] || '') : ''
    });
  }

  return items;
}

/**
 * 112 Guías reales del reporte oficial de Microsoft ReportServer
 * Reporte: "Históricos Guías Transportista" (Periodo 10/09/2026 - 10/09/2026)
 */
export const DATOS_REALES_STOKES: StokesItem[] = [
  // =========================================================================
  // Bloque 1: Guías 673096 a 673132 (37 Guías SLIT - Salar Atacama MOP 1)
  // Origen Crudo: "Salar Atacama, Mop (1)" -> Normalizado: "Salar"
  // Destino: "Antofagasta, P De Litio"
  // =========================================================================
  { guia: "673096", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.24, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "VXVL-31", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673097", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.29, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-39", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673098", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.74, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-34", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673099", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.41, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXV-33", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673100", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.19, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Coseducam S A", patenteCamion: "JKYV-58", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673101", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.93, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "VXVL-32", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673102", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.92, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-45", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673103", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.79, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXT-49", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673104", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.68, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXT-46", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673105", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.11, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RVFL-35", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673106", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.99, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-42", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673107", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.41, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RVFL-32", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673108", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.96, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "RYCB-56", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673109", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.89, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TPJB-36", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673110", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.50, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXT-50", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673111", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.84, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RTBB-83", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673112", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.17, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "VXVL-29", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673113", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.15, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RTBB-70", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673114", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.19, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "VXVL-28", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673115", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 30.05, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXV-32", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673116", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.57, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXT-52", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673117", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.82, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RTBB-86", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673118", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.32, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RTBB-87", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673119", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.09, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "VCHG-26", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673120", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.00, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "VWWF-48", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673121", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.25, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TPJB-29", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673122", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.67, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "RYCB-66", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673123", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.67, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-57", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673124", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 30.23, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "RYCB-74", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673125", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.58, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TPJB-28", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673126", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.85, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TPJB-22", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673127", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.12, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TPJB-35", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673128", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 29.41, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "JORQUERA TRANSPORTE S A", patenteCamion: "SWXV-24", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673129", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.30, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "LZRW-89", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673130", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 27.94, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "RTBB-73", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673131", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.72, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-53", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "673132", fechaGuia: "10-09-2026", producto: "SLIT", cantDespacho: 28.05, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Antofagasta, P De Litio", transportista: "Mining And Quarrying Spa", patenteCamion: "TZFC-44", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },

  // =========================================================================
  // Bloque 2: Guías 674006 a 674031 (26 Guías SILVINITA - Salar Atacama MOP 2)
  // Origen Crudo: "Salar Atacama, Mop (2)" -> Normalizado: "Salar"
  // Destino: "Pta. Npt-3 Cs" | Transportista: "Mining Services And Derivates"
  // =========================================================================
  { guia: "674006", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.16, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-23", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674007", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.71, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-74", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674008", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.93, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSGF-95", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674009", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.89, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-40", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674010", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.03, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "PYXD-14", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674011", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.92, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "THKR-20", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674012", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.02, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-76", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674013", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.25, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "PTLR-23", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674014", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.34, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-34", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674015", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.10, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSGG-24", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674016", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.87, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFC-56", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674017", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.02, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSGC-65", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674018", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.95, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSGG-14", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674019", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.93, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TSKS-99", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674020", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.04, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "PTLR-24", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674021", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.32, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "PYXD-17", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674022", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.99, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-24", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674023", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.78, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSGF-35", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674024", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.90, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-43", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674025", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.13, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "RTBB-65", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674026", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.84, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFL-19", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674027", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.69, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-38", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674028", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.97, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFP-42", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674029", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 28.87, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-73", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674030", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.18, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-77", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674031", fechaGuia: "10-09-2026", producto: "SILVINITA", cantDespacho: 29.18, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-31", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },

  // =========================================================================
  // Bloque 3: Guías 674032 a 674046 (15 Guías MOP-H-BL - Salar Atacama MOP 2)
  // Origen Crudo: "Salar Atacama, Mop (2)" -> Normalizado: "Salar"
  // Destino: "Pta. Npt-3 Cs" | Transportista: "Mining Services And Derivates"
  // =========================================================================
  { guia: "674032", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.35, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFB-96", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674033", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.85, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFB-76", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674034", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.10, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "RTBB-77", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674035", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.76, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-69", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674036", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.03, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFP-62", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674037", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.05, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "THKR-23", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674038", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.23, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "RVFL-34", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674039", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.88, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-39", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674040", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.79, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJXG-79", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674041", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.84, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-20", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674042", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.91, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJFT-46", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674043", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 28.95, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TPJB-25", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674044", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.33, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "TJFT-43", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674045", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.11, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "PYXD-12", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },
  { guia: "674046", fechaGuia: "10-09-2026", producto: "MOP-H-BL", cantDespacho: 29.18, almacenDespachoRaw: "Salar Atacama, Mop (2)", origenStokes: "Salar", almacenDestino: "Pta. Npt-3 Cs", transportista: "Mining Services And Derivates", patenteCamion: "VSFK-89", estadoGuia: "Emitida", tipoDespacho: "Devolucion a Planta" },

  // =========================================================================
  // Bloque 4: Guías 674345 a 674364 (20 Guías de Litio - Antofagasta, P De Litio)
  // Origen Crudo: "Antofagasta, P De Litio" (No Salar)
  // =========================================================================
  { guia: "674345", fechaGuia: "10-09-2026", producto: "CRY9000.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "KHBF29", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "674346", fechaGuia: "10-09-2026", producto: "CRY9000.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "GXYY43", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "674347", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 0.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LDSV11", estadoGuia: "Anulada", tipoDespacho: "Terrestre Nacional" },
  { guia: "674348", fechaGuia: "10-09-2026", producto: "MIC9000.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Puerto Angamos (Exportación)", transportista: "Transportes HANSA", patenteCamion: "HBDP 72", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "ONE SINCERITY 2630W" },
  { guia: "674349", fechaGuia: "10-09-2026", producto: "MIC9000.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Puerto Angamos (Exportación)", transportista: "Transportes HANSA", patenteCamion: "HBSL 40", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "ONE SINCERITY 2630W" },
  { guia: "674350", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LXVC45", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674351", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 0.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "TBGJ57", estadoGuia: "Anulada", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674352", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LDSV10", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "674353", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "TBGJ57", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674354", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LXJP44", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674355", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 0.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LXJP42", estadoGuia: "Anulada", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674356", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "KHBF29", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "674357", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Centro PANG", transportista: "Maersk Logistics & Services Ch", patenteCamion: "GXYY43", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "674358", fechaGuia: "10-09-2026", producto: "MIC9000.00", cantDespacho: 0.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Puerto Angamos (Exportación)", transportista: "Transportes HANSA", patenteCamion: "HBSL 40", estadoGuia: "Anulada", tipoDespacho: "Maritimo Internacional", nave: "ONE SINCERITY 2630W" },
  { guia: "674359", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "KJSF61", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674360", fechaGuia: "10-09-2026", producto: "MIC9000.00", cantDespacho: 20.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Puerto Angamos (Exportación)", transportista: "Transportes HANSA", patenteCamion: "HBDP 72", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "ONE SINCERITY 2630W" },
  { guia: "674361", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LXVC45", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674362", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "TBGJ57", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674363", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "LXJP44", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },
  { guia: "674364", fechaGuia: "10-09-2026", producto: "FIN9500.00", cantDespacho: 24.00, almacenDespachoRaw: "Antofagasta, P De Litio", origenStokes: "Antofagasta, P De Litio", almacenDestino: "Antofagasta Terminal", transportista: "Maersk Logistics & Services Ch", patenteCamion: "KJSF61", estadoGuia: "Emitida", tipoDespacho: "Maritimo Internacional", nave: "LITTLE ATHINA 638S" },

  // =========================================================================
  // Bloque 5: Guías 675125 a 675132 (8 Guías LSI (S) - Salar Atacama MOP 4)
  // Origen Crudo: "Salar Atacama, Mop (4)" -> Normalizado: "Salar"
  // Destino: "Centro PANG" | Transportista: "AG Services Spa"
  // =========================================================================
  { guia: "675125", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "VBZK-38", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675126", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "VCCG-13", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675127", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "TWPZ-35", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675128", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "VBPS-90", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675129", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "VYYR-40", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675130", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "RTBD-74", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675131", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "KSRB-57", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "675132", fechaGuia: "10-09-2026", producto: "LSI (S)", cantDespacho: 28.00, almacenDespachoRaw: "Salar Atacama, Mop (4)", origenStokes: "Salar", almacenDestino: "Centro PANG", transportista: "AG Services Spa", patenteCamion: "TWPZ-36", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },

  // =========================================================================
  // Bloque 6: Guías 76006 a 76008 (3 Guías BISCHOFITA - Origen Baquedano)
  // Origen Crudo: "Baquedano" (No Salar)
  // Destino: "Baquedano"
  // =========================================================================
  { guia: "76006", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 29.48, almacenDespachoRaw: "Baquedano", origenStokes: "Baquedano", almacenDestino: "Baquedano", transportista: "Coseducam S A", patenteCamion: "SKPK-83", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "76007", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 29.62, almacenDespachoRaw: "Baquedano", origenStokes: "Baquedano", almacenDestino: "Baquedano", transportista: "Coseducam S A", patenteCamion: "PYCH-26", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "76008", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 28.95, almacenDespachoRaw: "Baquedano", origenStokes: "Baquedano", almacenDestino: "Baquedano", transportista: "ABALCO SERVICIOS INDUSTRIALES", patenteCamion: "FRJB-51", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },

  // =========================================================================
  // Bloque 7: Guías 76103 a 76105 (3 Guías BISCHOFITA - Salar Atacama MOP 1)
  // Origen Crudo: "Salar Atacama, Mop (1)" -> Normalizado: "Salar"
  // Destino: "Baquedano" | Transportista: "Coseducam S A"
  // =========================================================================
  { guia: "76103", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 28.28, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Baquedano", transportista: "Coseducam S A", patenteCamion: "SBLW-82", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "76104", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 28.19, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Baquedano", transportista: "Coseducam S A", patenteCamion: "JKYV-58", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" },
  { guia: "76105", fechaGuia: "10-09-2026", producto: "BISCHOFITA", cantDespacho: 29.57, almacenDespachoRaw: "Salar Atacama, Mop (1)", origenStokes: "Salar", almacenDestino: "Baquedano", transportista: "Coseducam S A", patenteCamion: "PSFH-69", estadoGuia: "Emitida", tipoDespacho: "Terrestre Nacional" }
];
