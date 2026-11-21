import { normalizeCompanyName } from './dataProcessor';

export interface LogisticOperationRow {
  Fecha?: string;
  Producto?: string;
  Destino?: string;
  EmpresaMapped?: string;
  transportista?: string;
  Ton_Prog?: number;
  Ton_Real?: number;
  Eq_Prog?: number;
  Eq_Real?: number;
  faenaMetaHours?: number;
  faenaRealHours?: number;
  sdaHours?: number;
  pangHours?: number;
  Regulacion_Real?: number;
}

export interface CycleTimeStats {
  totalEvaluatedRows: number;
  avgFaenaRealHours: number;
  avgFaenaMetaHours: number;
  avgSdaHours: number;
  avgPangHours: number;
  avgDeviationMinutes: number;
  slaBreachCount: number;
  migtraAnomalyCount: number;
}

export interface CarrierPerformanceMetric {
  carrier: string;
  dispatchesCount: number;
  tonProg: number;
  tonReal: number;
  compliancePct: number;
  eqProg: number;
  eqReal: number;
  avgTonsPerTruck: number;
  avgCycleHours: number;
  avgTargetCycleHours: number;
  cycleDeviationMinutes: number;
}

export interface TonnageDimensionAggregation {
  key: string;
  tonProg: number;
  tonReal: number;
  tonDelta: number;
  compliancePct: number;
  eqProg: number;
  eqReal: number;
  avgTonsPerTruck: number;
}

const SLA_TOLERANCE_HOURS = 10 / 60; // 10 minutos de tolerancia estándar en faena

/**
 * Calcula estadísticas de tiempos de ciclo (faena real vs meta, SdA y Pang/NY)
 * y detecta anomalías de telemetría MIGTRA o desviaciones sobre el SLA de 10 minutos.
 */
export function calculateCycleTimeStats(rows: LogisticOperationRow[]): CycleTimeStats {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalEvaluatedRows: 0,
      avgFaenaRealHours: 0,
      avgFaenaMetaHours: 0,
      avgSdaHours: 0,
      avgPangHours: 0,
      avgDeviationMinutes: 0,
      slaBreachCount: 0,
      migtraAnomalyCount: 0,
    };
  }

  let realSum = 0;
  let realCount = 0;
  let metaSum = 0;
  let metaCount = 0;
  let sdaSum = 0;
  let sdaCount = 0;
  let pangSum = 0;
  let pangCount = 0;
  let deviationMinutesSum = 0;
  let deviationCount = 0;
  let slaBreachCount = 0;
  let migtraAnomalyCount = 0;

  for (const row of rows) {
    const tonReal = Number(row.Ton_Real) || 0;
    const realHrs = Number(row.faenaRealHours) || 0;
    const metaHrs = Number(row.faenaMetaHours) || 0;
    const sdaHrs = Number(row.sdaHours) || 0;
    const pangHrs = Number(row.pangHours) || 0;

    if (tonReal > 0 && realHrs <= 0) {
      migtraAnomalyCount++;
    }

    if (realHrs > 0) {
      realSum += realHrs;
      realCount++;
    }
    if (metaHrs > 0) {
      metaSum += metaHrs;
      metaCount++;
    }
    if (sdaHrs > 0) {
      sdaSum += sdaHrs;
      sdaCount++;
    }
    if (pangHrs > 0) {
      pangSum += pangHrs;
      pangCount++;
    }

    if (realHrs > 0 && metaHrs > 0) {
      const diffHours = realHrs - metaHrs;
      deviationMinutesSum += diffHours * 60;
      deviationCount++;
      if (diffHours > SLA_TOLERANCE_HOURS) {
        slaBreachCount++;
      }
    }
  }

  return {
    totalEvaluatedRows: rows.length,
    avgFaenaRealHours: realCount > 0 ? Number((realSum / realCount).toFixed(4)) : 0,
    avgFaenaMetaHours: metaCount > 0 ? Number((metaSum / metaCount).toFixed(4)) : 0,
    avgSdaHours: sdaCount > 0 ? Number((sdaSum / sdaCount).toFixed(4)) : 0,
    avgPangHours: pangCount > 0 ? Number((pangSum / pangCount).toFixed(4)) : 0,
    avgDeviationMinutes: deviationCount > 0 ? Number((deviationMinutesSum / deviationCount).toFixed(2)) : 0,
    slaBreachCount,
    migtraAnomalyCount,
  };
}

/**
 * Agrupa y calcula rendimiento operativo normalizado por empresa transportista.
 */
export function aggregateCarrierPerformance(rows: LogisticOperationRow[]): CarrierPerformanceMetric[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const buckets = new Map<
    string,
    {
      count: number;
      tonProg: number;
      tonReal: number;
      eqProg: number;
      eqReal: number;
      cycleRealSum: number;
      cycleRealCount: number;
      cycleMetaSum: number;
      cycleMetaCount: number;
    }
  >();

  for (const row of rows) {
    const rawCarrier = row.EmpresaMapped || row.transportista || extractCarrierFromDestino(row.Destino);
    const carrier = normalizeCompanyName(rawCarrier || 'SIN TRANSPORTISTA');

    let acc = buckets.get(carrier);
    if (!acc) {
      acc = {
        count: 0,
        tonProg: 0,
        tonReal: 0,
        eqProg: 0,
        eqReal: 0,
        cycleRealSum: 0,
        cycleRealCount: 0,
        cycleMetaSum: 0,
        cycleMetaCount: 0,
      };
      buckets.set(carrier, acc);
    }

    acc.count += 1;
    acc.tonProg += Number(row.Ton_Prog) || 0;
    acc.tonReal += Number(row.Ton_Real) || 0;
    acc.eqProg += Number(row.Eq_Prog) || 0;
    acc.eqReal += Number(row.Eq_Real) || 0;

    const realHrs = Number(row.faenaRealHours) || 0;
    const metaHrs = Number(row.faenaMetaHours) || 0;
    if (realHrs > 0) {
      acc.cycleRealSum += realHrs;
      acc.cycleRealCount += 1;
    }
    if (metaHrs > 0) {
      acc.cycleMetaSum += metaHrs;
      acc.cycleMetaCount += 1;
    }
  }

  return Array.from(buckets.entries())
    .map(([carrier, acc]) => {
      const compliancePct = acc.tonProg > 0 ? Number(((acc.tonReal / acc.tonProg) * 100).toFixed(2)) : 0;
      const avgTonsPerTruck = acc.eqReal > 0 ? Number((acc.tonReal / acc.eqReal).toFixed(2)) : 0;
      const avgCycleHours = acc.cycleRealCount > 0 ? Number((acc.cycleRealSum / acc.cycleRealCount).toFixed(4)) : 0;
      const avgTargetCycleHours = acc.cycleMetaCount > 0 ? Number((acc.cycleMetaSum / acc.cycleMetaCount).toFixed(4)) : 0;
      const cycleDeviationMinutes =
        avgCycleHours > 0 && avgTargetCycleHours > 0
          ? Number(((avgCycleHours - avgTargetCycleHours) * 60).toFixed(2))
          : 0;

      return {
        carrier,
        dispatchesCount: acc.count,
        tonProg: Number(acc.tonProg.toFixed(2)),
        tonReal: Number(acc.tonReal.toFixed(2)),
        compliancePct,
        eqProg: acc.eqProg,
        eqReal: acc.eqReal,
        avgTonsPerTruck,
        avgCycleHours,
        avgTargetCycleHours,
        cycleDeviationMinutes,
      };
    })
    .sort((a, b) => b.tonReal - a.tonReal);
}

function extractCarrierFromDestino(destino?: string): string {
  const upper = String(destino || '').toUpperCase();
  if (upper.includes('COSEDUCAM')) return 'COSEDUCAM S A';
  if (upper.includes('JORQUERA')) return 'JORQUERA TRANSPORTE S.A.';
  if (upper.includes('M&Q') || upper.includes('MQ') || upper.includes('M Q')) return 'M&Q SPA';
  if (upper.includes('M S & D') || upper.includes('MSD') || upper.includes('MINING SERVICES')) return 'M S & D SPA';
  if (upper.includes('AG SERVICE')) return 'AG SERVICES SPA';
  return 'OTRA / FLOTA EXTERNA';
}

/**
 * Agrega tonelajes y cumplimiento por dimensión (`Producto`, `Destino` o `Fecha`).
 */
export function aggregateTonnageByDimension(
  rows: LogisticOperationRow[],
  dimension: 'Producto' | 'Destino' | 'Fecha'
): TonnageDimensionAggregation[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const groups = new Map<
    string,
    { tonProg: number; tonReal: number; eqProg: number; eqReal: number }
  >();

  for (const row of rows) {
    const key = String(row[dimension] || 'S/D').trim() || 'S/D';
    let acc = groups.get(key);
    if (!acc) {
      acc = { tonProg: 0, tonReal: 0, eqProg: 0, eqReal: 0 };
      groups.set(key, acc);
    }
    acc.tonProg += Number(row.Ton_Prog) || 0;
    acc.tonReal += Number(row.Ton_Real) || 0;
    acc.eqProg += Number(row.Eq_Prog) || 0;
    acc.eqReal += Number(row.Eq_Real) || 0;
  }

  return Array.from(groups.entries())
    .map(([key, acc]) => {
      const tonProg = Number(acc.tonProg.toFixed(2));
      const tonReal = Number(acc.tonReal.toFixed(2));
      const tonDelta = Number((tonReal - tonProg).toFixed(2));
      const compliancePct = tonProg > 0 ? Number(((tonReal / tonProg) * 100).toFixed(2)) : 0;
      const avgTonsPerTruck = acc.eqReal > 0 ? Number((tonReal / acc.eqReal).toFixed(2)) : 0;

      return {
        key,
        tonProg,
        tonReal,
        tonDelta,
        compliancePct,
        eqProg: acc.eqProg,
        eqReal: acc.eqReal,
        avgTonsPerTruck,
      };
    })
    .sort((a, b) => b.tonReal - a.tonReal);
}
