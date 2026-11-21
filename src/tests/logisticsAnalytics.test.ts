import { describe, it, expect } from 'vitest';
import {
  calculateCycleTimeStats,
  aggregateCarrierPerformance,
  aggregateTonnageByDimension,
  type LogisticOperationRow,
} from '../utils/logisticsAnalytics';

describe('logisticsAnalytics - Cálculos Críticos Logísticos', () => {
  const sampleRows: LogisticOperationRow[] = [
    {
      Fecha: '2026-05-10',
      Producto: 'SLIT',
      Destino: 'PLANTA QUÍMICA - COSEDUCAM S A',
      Ton_Prog: 600,
      Ton_Real: 580,
      Eq_Prog: 20,
      Eq_Real: 20,
      faenaMetaHours: 2.0,
      faenaRealHours: 2.5, // +30 min (>10 min SLA breach)
      sdaHours: 2.4,
      pangHours: 1.9,
    },
    {
      Fecha: '2026-05-10',
      Producto: 'LSI (S)',
      Destino: 'TOCOPILLA - JORQUERA',
      Ton_Prog: 300,
      Ton_Real: 315,
      Eq_Prog: 10,
      Eq_Real: 10,
      faenaMetaHours: 2.0,
      faenaRealHours: 2.1, // +6 min (within 10m SLA)
      sdaHours: 2.0,
      pangHours: 2.1,
    },
    {
      Fecha: '2026-05-11',
      Producto: 'BISCHOFITA',
      Destino: 'COYA SUR - M&Q',
      EmpresaMapped: 'Mining Services & Derivates SPA',
      Ton_Prog: 290,
      Ton_Real: 290,
      Eq_Prog: 10,
      Eq_Real: 10,
      faenaMetaHours: 1.5,
      faenaRealHours: 0, // Ton_Real > 0 y faenaRealHours == 0 => Falla MIGTRA
      sdaHours: 0,
      pangHours: 0,
    },
  ];

  describe('calculateCycleTimeStats', () => {
    it('retorna ceros seguros cuando el arreglo está vacío', () => {
      const result = calculateCycleTimeStats([]);
      expect(result).toEqual({
        totalEvaluatedRows: 0,
        avgFaenaRealHours: 0,
        avgFaenaMetaHours: 0,
        avgSdaHours: 0,
        avgPangHours: 0,
        avgDeviationMinutes: 0,
        slaBreachCount: 0,
        migtraAnomalyCount: 0,
      });
    });

    it('calcula promedios de ciclo, incumplimientos SLA (>10 min) y fallas MIGTRA', () => {
      const stats = calculateCycleTimeStats(sampleRows);

      expect(stats.totalEvaluatedRows).toBe(3);
      // Solo filas 1 y 2 tienen faenaRealHours > 0: (2.5 + 2.1) / 2 = 2.3
      expect(stats.avgFaenaRealHours).toBeCloseTo(2.3, 4);
      // Las 3 filas tienen faenaMetaHours > 0: (2.0 + 2.0 + 1.5) / 3 = 1.8333
      expect(stats.avgFaenaMetaHours).toBeCloseTo(1.8333, 4);
      expect(stats.avgSdaHours).toBeCloseTo(2.2, 4);
      expect(stats.avgPangHours).toBeCloseTo(2.0, 4);
      // Desviación en filas con ambos valores > 0: (+30m + +6m) / 2 = 18m
      expect(stats.avgDeviationMinutes).toBeCloseTo(18, 2);
      // Fila 1 excede en 30m (>10m); Fila 2 en 6m (<=10m)
      expect(stats.slaBreachCount).toBe(1);
      // Fila 3 tiene Ton_Real > 0 y faenaRealHours === 0
      expect(stats.migtraAnomalyCount).toBe(1);
    });
  });

  describe('aggregateCarrierPerformance', () => {
    it('normaliza razones sociales de transportistas y calcula toneladas/camión y cumplimiento', () => {
      const rows: LogisticOperationRow[] = [
        ...sampleRows,
        {
          Fecha: '2026-05-11',
          Producto: 'SLIT',
          Destino: 'SALAR',
          transportista: 'M AND Q SPA',
          Ton_Prog: 500,
          Ton_Real: 450,
          Eq_Prog: 16,
          Eq_Real: 15,
          faenaMetaHours: 2.0,
          faenaRealHours: 2.25,
        },
        {
          Fecha: '2026-05-11',
          Producto: 'SLIT',
          Destino: 'SALAR',
          transportista: 'MINING AND QUARRYING SPA', // mismo transportista M&Q SPA
          Ton_Prog: 100,
          Ton_Real: 120,
          Eq_Prog: 4,
          Eq_Real: 4,
          faenaMetaHours: 2.0,
          faenaRealHours: 1.75,
        },
      ];

      const carriers = aggregateCarrierPerformance(rows);

      // Ordenado descendente por Ton_Real: Coseducam (580) > M&Q SPA (570) > Jorquera (315) > M S & D SPA (290)
      expect(carriers.map((c) => c.carrier)).toEqual([
        'COSEDUCAM S A',
        'M&Q SPA',
        'JORQUERA TRANSPORTE S.A.',
        'M S & D SPA',
      ]);

      const mq = carriers.find((c) => c.carrier === 'M&Q SPA')!;
      expect(mq.dispatchesCount).toBe(2);
      expect(mq.tonProg).toBe(600);
      expect(mq.tonReal).toBe(570);
      expect(mq.compliancePct).toBeCloseTo(95, 2);
      expect(mq.avgTonsPerTruck).toBeCloseTo(30, 2); // 570 / 19
      expect(mq.avgCycleHours).toBeCloseTo(2.0, 4); // (2.25 + 1.75) / 2
      expect(mq.cycleDeviationMinutes).toBe(0);
    });
  });

  describe('aggregateTonnageByDimension', () => {
    it('agrega tonelajes por Producto, Destino y Fecha evitando divisiones por cero', () => {
      const rows: LogisticOperationRow[] = [
        ...sampleRows,
        {
          Fecha: '2026-05-11',
          Producto: 'SLIT',
          Destino: 'PLANTA QUÍMICA - COSEDUCAM S A',
          Ton_Prog: 0,
          Ton_Real: 120,
          Eq_Prog: 0,
          Eq_Real: 0,
        },
      ];

      const byProduct = aggregateTonnageByDimension(rows, 'Producto');
      const slit = byProduct.find((p) => p.key === 'SLIT')!;
      expect(slit.tonProg).toBe(600);
      expect(slit.tonReal).toBe(700);
      expect(slit.tonDelta).toBe(100);
      expect(slit.compliancePct).toBeCloseTo(116.67, 2);
      expect(slit.avgTonsPerTruck).toBe(35); // 700 / 20

      const byDate = aggregateTonnageByDimension(rows, 'Fecha');
      expect(byDate).toHaveLength(2);
      expect(byDate[0].key).toBe('2026-05-10');
      expect(byDate[0].tonReal).toBe(895);

      const zeroDiv = aggregateTonnageByDimension(
        [{ Producto: 'SIN_PROG', Ton_Prog: 0, Ton_Real: 50, Eq_Real: 0 }],
        'Producto'
      );
      expect(zeroDiv[0].compliancePct).toBe(0);
      expect(zeroDiv[0].avgTonsPerTruck).toBe(0);
    });
  });
});
