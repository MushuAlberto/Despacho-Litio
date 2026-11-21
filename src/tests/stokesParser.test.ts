import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  extractMopPlant,
  parseStrictStokesNumber,
  parseStokesDate,
  parseStokesRows,
  parseStokesWorkbook,
} from '../services/stokesParser';

describe('stokesParser - Motor de parseo defensivo Zod (Mop 1-6)', () => {
  describe('extractMopPlant', () => {
    it('normaliza variantes oficiales de plantas Mop 1 a Mop 6 hacia origen "Salar"', () => {
      expect(extractMopPlant('Salar Atacama, Mop 1')).toEqual({
        origenStokes: 'Salar',
        mopPlant: 'Mop 1',
        isMop1to6: true,
      });
      expect(extractMopPlant('Salar de Atacama, Mop (4)')).toEqual({
        origenStokes: 'Salar',
        mopPlant: 'Mop 4',
        isMop1to6: true,
      });
      expect(extractMopPlant('Salar Atacama Mop6')).toEqual({
        origenStokes: 'Salar',
        mopPlant: 'Mop 6',
        isMop1to6: true,
      });
    });

    it('preserva otros orígenes sin marcarlos como Mop 1-6', () => {
      expect(extractMopPlant('Planta Coya Sur')).toEqual({
        origenStokes: 'Planta Coya Sur',
        mopPlant: null,
        isMop1to6: false,
      });
      expect(extractMopPlant('')).toEqual({
        origenStokes: '—',
        mopPlant: null,
        isMop1to6: false,
      });
    });
  });

  describe('parseStrictStokesNumber y parseStokesDate', () => {
    it('soporta formatos numéricos chilenos e internacionales y rechaza texto corrupto', () => {
      expect(parseStrictStokesNumber('1.250,75')).toBe(1250.75);
      expect(parseStrictStokesNumber('29,40')).toBe(29.4);
      expect(parseStrictStokesNumber(31.2)).toBe(31.2);
      expect(Number.isNaN(parseStrictStokesNumber('28ABC'))).toBe(true);
      expect(Number.isNaN(parseStrictStokesNumber(null))).toBe(true);
    });

    it('normaliza fechas desde serial Excel o cadenas DD/MM/YYYY', () => {
      expect(parseStokesDate('14/05/2026')).toBe('2026-05-14');
      expect(parseStokesDate('2026-05-15')).toBe('2026-05-15');
      expect(parseStokesDate(46156)).toMatch(/^2026-\d{2}-\d{2}$/);
    });
  });

  describe('parseStokesRows - Validación estricta con cuarentena de filas', () => {
    it('procesa filas válidas Mop 1-6 y envía filas corruptas a cuarentena sin fallar', () => {
      const sheetRows = [
        ['REPORTE HISTÓRICO DE GUÍAS - SQM LITIO'],
        ['Generado por Microsoft ReportServer'],
        [],
        [
          'N° Guía',
          'Fecha Guía',
          'Producto',
          'Cant. Despacho',
          'Almacén Despacho',
          'Almacén Destino',
          'Transportista',
          'Patente Camión',
        ],
        // Fila válida Mop 1 (formato numérico chileno)
        ['G-9001', '10/05/2026', 'SLIT', '29,50', 'Salar Atacama, Mop 1', 'Planta Química', 'M AND Q SPA', 'abcd-12'],
        // Fila válida Mop 5
        ['G-9002', '10/05/2026', 'MOP-G', 31.2, 'Salar de Atacama, Mop (5)', 'Tocopilla', 'Jorquera Transporte S A', 'XYZW89'],
        // Fila completamente vacía (se omite estructuralmente)
        ['', '', '', '', '', '', '', ''],
        // Fila corrupta #1: tonelaje inválido y patente inválida
        ['G-ERR-1', '10/05/2026', 'SLIT', 'NO_NUM', 'Salar Atacama, Mop 2', 'Coya Sur', 'Coseducam S A', '??'],
        // Fila corrupta #2: tonelaje físico imposible (>500 TON) y destino nulo
        ['G-ERR-2', '10/05/2026', 'LSI', 9999, 'Salar Atacama, Mop 3', null, 'Coseducam S A', 'BCFG45'],
        // Fila de cierre/totales de ReportServer (ignorada estructuralmente)
        ['Total General', '', '', '60,70', '', '', '', ''],
      ];

      const result = parseStokesRows(sheetRows);

      expect(result.summary.validCount).toBe(2);
      expect(result.summary.quarantinedCount).toBe(2);
      expect(result.summary.totalTonnage).toBeCloseTo(60.7, 2);
      expect(result.summary.mopBreakdown['Mop 1']).toEqual({ count: 1, tonnage: 29.5 });
      expect(result.summary.mopBreakdown['Mop 5']).toEqual({ count: 1, tonnage: 31.2 });

      expect(result.validRecords[0]).toMatchObject({
        guia: 'G-9001',
        fechaGuia: '2026-05-10',
        origenStokes: 'Salar',
        mopPlant: 'Mop 1',
        transportista: 'M&Q SPA',
        patenteCamion: 'ABCD-12',
      });

      expect(result.quarantinedRecords[0].rawRow.guia).toBe('G-ERR-1');
      expect(result.quarantinedRecords[0].reasons.some((r) => r.field === 'cantDespacho')).toBe(true);
      expect(result.quarantinedRecords[0].reasons.some((r) => r.field === 'patenteCamion')).toBe(true);

      expect(result.quarantinedRecords[1].rawRow.guia).toBe('G-ERR-2');
      expect(result.quarantinedRecords[1].reasons.some((r) => r.field === 'almacenDestino')).toBe(true);

      expect(result.logs.some((l) => l.code === 'STOKES_HEADERS_DETECTED')).toBe(true);
      expect(result.logs.some((l) => l.code === 'STOKES_ROW_QUARANTINED')).toBe(true);
      expect(result.logs.some((l) => l.code === 'STOKES_PARSE_COMPLETE')).toBe(true);
    });

    it('lanza error descriptivo cuando faltan columnas obligatorias en los encabezados', () => {
      const badRows = [
        ['Columna A', 'Columna B', 'Columna C'],
        ['1', '2', '3'],
      ];
      expect(() => parseStokesRows(badRows)).toThrow(/Encabezados inválidos/i);
    });

    it('lee correctamente un libro binario XLSX real mediante parseStokesWorkbook', () => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Guía', 'Fecha', 'Producto', 'Cant Despacho', 'Almacén Despacho', 'Almacén Destino', 'Transportista', 'Patente'],
        ['100555', '2026-05-12', 'BISCHOFITA', 28.8, 'Salar Atacama, Mop 6', 'Coya Sur', 'Coseducam S A', 'HJKP44'],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stokes');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

      const parsed = parseStokesWorkbook(buffer);
      expect(parsed.validRecords).toHaveLength(1);
      expect(parsed.validRecords[0].mopPlant).toBe('Mop 6');
      expect(parsed.validRecords[0].cantDespacho).toBe(28.8);
    });
  });
});
