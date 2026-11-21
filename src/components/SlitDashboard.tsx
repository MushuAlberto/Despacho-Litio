import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import { 
  Home, TrendingUp, Truck, Target, Scale, Eye, Award, BarChart3, Calendar, ShieldCheck, ArrowLeft, Filter,
  Clock, ClipboardCheck, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, Package, MapPin
} from 'lucide-react';
import { normalizeCompanyName, normalizeHeader, cleanNumeric, parseExcelTime, formatNumberWithDecimals } from '../utils/dataProcessor';

interface SlitRow {
  Fecha: string;
  Producto: string;
  Destino: string;
  Ton_Prog: number;
  Ton_Real: number;
  Eq_Prog: number;
  Eq_Real: number;
  Regulacion_Real: number;
}

interface SlitDashboardProps {
  data: any[];
  onBack: () => void;
}

// Robust helper to extract the transport company (empresa) from the "Destino" string
const getCompanyFromDestino = (destino: string): string => {
  const destUpper = String(destino || '').trim().toUpperCase();
  if (destUpper.includes('COSEDUCAM')) return 'COSEDUCAM';
  if (destUpper.includes('M&Q') || destUpper.includes('M & Q') || destUpper.includes('M Q') || destUpper.includes('MINING & QUARRYING') || destUpper.includes('MINING AND QUARRYING')) return 'M&Q SPA';
  if (destUpper.includes('M S & D') || destUpper.includes('M S D') || destUpper.includes('MS&D') || destUpper.includes('MINING SERVICES')) return 'M S & D SPA';
  if (destUpper.includes('JORQUERA')) return 'JORQUERA TRANSPORTE S.A.';
  if (destUpper.includes('AG SERVICES') || destUpper.includes('AG SERVICE')) return 'AG SERVICES';
  
  // Fallback cleanup
  const firstWord = destUpper.split(' ')[0] || 'OTRA';
  if (['COYA', 'TOCOPILLA', 'LAGUNAS', 'S/D', 'SD', 'PRODUCTO', 'FAENA', 'SALAR', 'SDA', 'PANG'].includes(firstWord)) {
    return 'MINEX / OTRA';
  }
  return firstWord;
};

const formatDateToCL = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

const mapArrivalCompanyToStandard = (co: string): string => {
  const upper = String(co || '').trim().toUpperCase();
  if (upper.includes('COSEDUCAM')) return 'COSEDUCAM';
  if (upper.includes('M&Q') || upper.includes('MQ')) return 'M&Q SPA';
  if (upper.includes('M S & D') || upper.includes('MSD') || upper.includes('MINING SERVICES')) return 'M S & D SPA';
  if (upper.includes('JORQUERA')) return 'JORQUERA TRANSPORTE S.A.';
  if (upper.includes('AG SERVICES') || upper.includes('AG SERVICE')) return 'AG SERVICES';
  return upper;
};

export const SlitDashboard: React.FC<SlitDashboardProps> = ({ data = [], onBack }) => {
  // Local state for Base de Datos (Informe Operativo)
  const [operationalRawData, setOperationalRawData] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_raw_data');
      return saved ? JSON.parse(saved) : (data || []);
    } catch {
      return data || [];
    }
  });

  // Local state for Llegada de Equipos
  const [arrivalRawState, setArrivalRawState] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_llegadas_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI States for file upload integration
  const [showUploadCenter, setShowUploadCenter] = useState(true);
  const [dragOverOps, setDragOverOps] = useState(false);
  const [dragOverArrivals, setDragOverArrivals] = useState(false);
  const [uploadingOps, setUploadingOps] = useState(false);
  const [uploadingArrivals, setUploadingArrivals] = useState(false);
  const [errorMsgOps, setErrorMsgOps] = useState<string | null>(null);
  const [errorMsgArrivals, setErrorMsgArrivals] = useState<string | null>(null);
  const [successMsgOps, setSuccessMsgOps] = useState<string | null>(null);
  const [successMsgArrivals, setSuccessMsgArrivals] = useState<string | null>(null);

  // Excel parsing executors
  const handleUploadOperationalFile = (file: File) => {
    setUploadingOps(true);
    setErrorMsgOps(null);
    setSuccessMsgOps(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n => n === "Base de Datos") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Planilla vacía o estructura errónea.");

        let bestHeaderRowIdx = 0;
        let bestMatchCount = -1;
        let bestIdxs: Record<string, number> = {};
        let bestHeadersList: string[] = [];

        const scanLimit = Math.min(jsonData.length, 15);
        for (let rIdx = 0; rIdx < scanLimit; rIdx++) {
          const rowHeaders = Array.from(jsonData[rIdx] || []).map(h => normalizeHeader(h));
          const getIdxForHeaders = (
            aliases: string[], 
            fuzzyKeywords?: { mustContain: string[], orContain?: string[] }[]
          ): number => {
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 2) continue;
              const exactIdx = rowHeaders.findIndex(h => h === normAlias);
              if (exactIdx !== -1) return exactIdx;
            }
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 3) continue;
              const partialIdx = rowHeaders.findIndex(h => h && (h.includes(normAlias) || normAlias.includes(h)));
              if (partialIdx !== -1) return partialIdx;
            }
            if (fuzzyKeywords) {
              for (const fk of fuzzyKeywords) {
                const foundIdx = rowHeaders.findIndex(h => {
                  if (!h) return false;
                  const hasAllMust = fk.mustContain.every(term => h.includes(term));
                  if (!hasAllMust) return false;
                  if (fk.orContain && fk.orContain.length > 0) {
                    return fk.orContain.some(term => h.includes(term));
                  }
                  return true;
                });
                if (foundIdx !== -1) return foundIdx;
              }
            }
            return -1;
          };

          const currentIdxs = {
            fecha: getIdxForHeaders(["FECHA", "JORNADA", "DIA"], [{ mustContain: ["FECHA"] }, { mustContain: ["JORNADA"] }]),
            producto: getIdxForHeaders(["PRODUCTO", "NIVEL", "PRODUCTO META", "PROD"], [{ mustContain: ["PRODUCTO"] }, { mustContain: ["PROD", "META"] }, { mustContain: ["NIVEL"] }]),
            destino: getIdxForHeaders(["DESTINO", "UBICACION", "UBICACIÓN", "ENTREGA", "PUNTO ENTREGA", "DES"], [{ mustContain: ["DESTIN"] }, { mustContain: ["UBICAC"] }, { mustContain: ["ENTREG"] }]),
            empresa: getIdxForHeaders(["EMPRESA", "TRANSPORTISTA", "EMPRESA TRANSPORTE", "FLETERO", "COMPAÑÍA", "CÍA", "COMPAÑIA", "CIA"], [{ mustContain: ["EMPRES"] }, { mustContain: ["FLETER"] }, { mustContain: ["TRANSP"] }]),
            tonProg: getIdxForHeaders(["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS", "TONELADAS PROG", "TONELADA PROGRAMADA"], [{ mustContain: ["TON", "PROG"] }, { mustContain: ["TONELADA", "PROG"] }]),
            tonReal: getIdxForHeaders(["TON REAL", "REAL", "TONELADAS REALES", "TONELADA REAL"], [{ mustContain: ["TON", "REAL"] }, { mustContain: ["TONELADA", "REAL"] }]),
            eqProg: getIdxForHeaders(["EQ PROG", "EQUIPOS PROGRAMADOS", "EQUIPOS PROG", "FLOTA PROGRAMADA", "FLOTA PROG"], [{ mustContain: ["FLOTA", "PROG"] }, { mustContain: ["EQUIP", "PROG"] }]),
            eqReal: getIdxForHeaders(["EQ REAL", "EQUIPOS REALES", "EQ REALES", "FLOTA REAL", "FLOTA REALES", "INTENSIDAD FLOTA", "INTENSIDAD DE FLOTA"], [{ mustContain: ["FLOTA", "REAL"] }, { mustContain: ["EQUIP", "REAL"] }]),
            regReal: getIdxForHeaders(["REGULACION REAL", "REGULACION", "PORCENTAJE DE REGULACION", "REGULACION REAL %", "% REGULALION", "% REGULACION", "REGULACION %", "REG REAL"], [{ mustContain: ["REGULAC"] }]),
            sda: getIdxForHeaders(["SDA HRS", "SDA", "SDA HOURS", "SDA H"], [{ mustContain: ["SDA"] }]),
            pang: getIdxForHeaders(["PANG HRS", "PANG", "PANG HOURS"], [{ mustContain: ["PANG"] }]),
            faenaMeta: getIdxForHeaders(["FAENA META HRS", "FAENA META"], [{ mustContain: ["FAENA", "META"] }]),
            faenaReal: getIdxForHeaders(["FAENA REAL HRS", "FAENA REAL"], [{ mustContain: ["FAENA", "REAL"] }])
          };

          const matchCount = Object.values(currentIdxs).filter(v => v !== -1).length;
          if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestHeaderRowIdx = rIdx;
            bestIdxs = currentIdxs;
            bestHeadersList = rowHeaders;
          }
        }

        const idx = bestIdxs;
        const rows = jsonData.slice(bestHeaderRowIdx + 1);

        if (idx.fecha === -1) {
          throw new Error("No se pudo mapear la columna base FECHA u operacionales obligatorias.");
        }

        const processed = rows.map((row) => {
          if (!row || row[idx.fecha] === undefined || row[idx.fecha] === null) return null;
          
          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else {
            const rawVal = String(rawDate).trim();
            if (rawVal.includes('/')) {
              const pts = rawVal.split('/');
              if (pts[2]?.length === 4) dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
            } else if (rawVal.includes('-')) {
              const pts = rawVal.split('-');
              if (pts[0]?.length === 4) {
                dateStr = rawVal;
              } else if (pts[2]?.length === 4) {
                dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
              }
            }
          }
          if (!dateStr || dateStr === 'undefined') return null;

          const valAF = row[31] !== undefined && row[31] !== null ? String(row[31]).trim().toUpperCase() : '';
          const isSlit = valAF === 'SLIT' || valAF.includes('SLIT');

          const finalProduct = isSlit ? valAF : (idx.producto !== -1 ? String(row[idx.producto]).trim().toUpperCase() : 'DESCONOCIDO');

          return {
            Fecha: dateStr,
            Producto: finalProduct,
            Destino: idx.destino !== -1 ? String(row[idx.destino]).trim().toUpperCase() : 'S/D',
            EmpresaMapped: idx.empresa !== -1 ? String(row[idx.empresa] || '').trim().toUpperCase() : '',
            Ton_Prog: isSlit ? cleanNumeric(row[33]) : (idx.tonProg !== -1 ? cleanNumeric(row[idx.tonProg]) : 0), // AH
            Ton_Real: isSlit ? cleanNumeric(row[34]) : (idx.tonReal !== -1 ? cleanNumeric(row[idx.tonReal]) : 0), // AI
            Eq_Prog: isSlit ? cleanNumeric(row[35]) : (idx.eqProg !== -1 ? cleanNumeric(row[idx.eqProg]) : 0),   // AJ
            Eq_Real: isSlit ? cleanNumeric(row[36]) : (idx.eqReal !== -1 ? cleanNumeric(row[idx.eqReal]) : 0),   // AK
            Regulacion_Real: idx.regReal !== -1 ? (() => {
              const raw = row[idx.regReal];
              const val = cleanNumeric(raw);
              if (val > 0 && val <= 1.0) return val * 100;
              return val;
            })() : (isSlit ? (() => {
              const val38 = cleanNumeric(row[38]); // col AM: fallback % Regulación
              if (val38 > 0) {
                return val38 > 0 && val38 <= 1.0 ? val38 * 100 : val38;
              }
              const val37 = cleanNumeric(row[37]); // col AL fallback
              return val37 > 0 && val37 <= 1.0 ? val37 * 100 : val37;
            })() : 0),
            sdaHours: idx.sda !== -1 ? parseExcelTime(row[idx.sda]) : 0,
            pangHours: idx.pang !== -1 ? parseExcelTime(row[idx.pang]) : 0,
            faenaMetaHours: isSlit ? parseExcelTime(row[49]) : (idx.faenaMeta !== -1 ? parseExcelTime(row[idx.faenaMeta]) : 0), // AX
            faenaRealHours: isSlit ? parseExcelTime(row[50]) : (idx.faenaReal !== -1 ? parseExcelTime(row[idx.faenaReal]) : 0), // AY

            // Custom fields mapped exactly from corresponding columns:
            col_TiempoInteriorFaenaProdMeta: parseExcelTime(row[49]), // AX (index 49)
            col_TiempoInteriorFaenaReal: parseExcelTime(row[50]), // AY (index 50)
            col_PromedioCargaMeta: cleanNumeric(row[47]), // AV (index 47)
            col_PromedioCargaReal: cleanNumeric(row[48]), // AW (index 48)
            col_TonProg: cleanNumeric(row[33]), // AH (index 33)
            col_TonReal: cleanNumeric(row[34]), // AI (index 34)
            col_EqProg: cleanNumeric(row[35]), // AJ (index 35)
            col_EqReal: cleanNumeric(row[36]), // AK (index 36)
            col_PercentCumplimiento: (() => {
              const val = cleanNumeric(row[37]); // AL (index 37)
              return val > 0 && val <= 1.0 ? val * 100 : val;
            })(),
            col_CantidadRegulaciones: cleanNumeric(row[44]), // AS (index 44)
            col_MqAljibesProg: cleanNumeric(row[12]), // M (index 12)
            col_MqAljibesReal: cleanNumeric(row[13]), // N (index 13)
            col_JorqueraAljibesProg: cleanNumeric(row[20]), // U (index 20)
            col_JorqueraAljibesReal: cleanNumeric(row[21])  // V (index 21)
          };
        }).filter(r => r !== null);

        if (processed.length === 0) throw new Error("No se encontraron registros operacionales válidos.");

        setOperationalRawData(processed);
        localStorage.setItem('sqm_raw_data', JSON.stringify(processed));
        setSuccessMsgOps(`¡Informe operativo de despacho cargado con éxito! Detected ${processed.filter((p: any) => String(p.Producto).toUpperCase().includes('SLIT')).length} registros SLIT.`);
        setTimeout(() => setSuccessMsgOps(null), 6000);
      } catch (err: any) {
        console.error("Error al procesar archivo operativo en modulo SLIT:", err);
        setErrorMsgOps(err.message || "Error al procesar la planilla.");
        setTimeout(() => setErrorMsgOps(null), 6000);
      } finally {
        setUploadingOps(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadArrivalsFile = (file: File) => {
    setUploadingArrivals(true);
    setErrorMsgArrivals(null);
    setSuccessMsgArrivals(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n =>
          n.toUpperCase().includes("BASE") ||
          n.toUpperCase().includes("LLEGADA") ||
          n.toUpperCase().includes("DATOS")
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Plantilla de llegada vacía.");

        let headerIdx = -1;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i].map(c => String(c || '').toUpperCase());
          if (row.includes('FECHA') || row.includes('EMPRESA') || row.includes('PRODUCTO')) {
            headerIdx = i;
            break;
          }
        }

        const startRow = headerIdx !== -1 ? headerIdx : 0;
        const headers = jsonData[startRow].map(h => String(h || '').toUpperCase().trim());
        const getIdx = (name: string, fallback: number) => {
          const found = headers.findIndex(h => h.includes(name.toUpperCase()));
          return found !== -1 ? found : fallback;
        };

        const idx = {
          fecha: getIdx("FECHA", 0),
          destino: getIdx("DESTINO", 3),
          empresa: getIdx("EMPRESA", 11),
          hora: getIdx("HORA", 14)
        };

        const processed = jsonData.slice(startRow + 1).map(row => {
          if (!row || row.length < 2) return null;

          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              else dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          if (!dateStr) return null;

          let horaNum = 0;
          const rawHora = row[idx.hora];
          if (rawHora instanceof Date) {
            horaNum = rawHora.getHours() + (rawHora.getMinutes() / 60);
          } else if (typeof rawHora === 'string' && rawHora.includes(':')) {
            const parts = rawHora.split(':').map(Number);
            horaNum = (parts[0] || 0) + ((parts[1] || 0) / 60);
          } else if (typeof rawHora === 'number') {
            horaNum = rawHora * 24;
          }

          return {
            fecha: dateStr,
            destino: String(row[idx.destino] || 'SIN DESTINO').trim().toUpperCase(),
            empresa: normalizeCompanyName(row[idx.empresa]),
            hora: horaNum
          };
        }).filter(r => r !== null && !!r.fecha && !!r.empresa);

        if (processed.length === 0) throw new Error("No se procesaron transitos válidos.");

        setArrivalRawState(processed);
        localStorage.setItem('sqm_llegadas_data', JSON.stringify(processed));
        setSuccessMsgArrivals(`¡Llegadas de flota cargadas y sincronizadas correctas! Detected ${processed.length} tránsitos.`);
        setTimeout(() => setSuccessMsgArrivals(null), 6000);
      } catch (err: any) {
        console.error("Error al procesar archivo de llegada en modulo SLIT:", err);
        setErrorMsgArrivals(err.message || "Error al procesar bitácora.");
        setTimeout(() => setErrorMsgArrivals(null), 6000);
      } finally {
        setUploadingArrivals(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Load Llegada de Equipos data filtered specifically for SLIT companies
  const arrivalRawData = useMemo(() => {
    return (arrivalRawState || [])
      .map((row: any) => ({
        ...row,
        empresaStandard: mapArrivalCompanyToStandard(row.empresa)
      }))
      .filter((row: any) => row.empresaStandard === 'M&Q SPA' || row.empresaStandard === 'JORQUERA TRANSPORTE S.A.');
  }, [arrivalRawState]);

  // 1. Process and filter only SLIT rows for the 2 target companies
  const slitData = useMemo(() => {
    return (operationalRawData || [])
      .filter((row: any) => {
        const prod = String(row.Producto || '').trim().toUpperCase();
        return prod === 'SLIT' || prod.includes('SLIT');
      })
      .map((row: any) => {
        // Intelligent company determination waterfall for SLIT records
        let company = 'MINEX / OTRA';
        const rawEmp = String(row.EmpresaMapped || '').trim().toUpperCase();
        if (rawEmp) {
          company = mapArrivalCompanyToStandard(rawEmp);
        }
        
        // Waterfall check: Aljibes columns
        if (company === 'MINEX / OTRA') {
          const mqProg = Number(row.col_MqAljibesProg) || 0;
          const mqReal = Number(row.col_MqAljibesReal) || 0;
          const jorqProg = Number(row.col_JorqueraAljibesProg) || 0;
          const jorqReal = Number(row.col_JorqueraAljibesReal) || 0;
          
          if (mqProg > 0 || mqReal > 0) {
            company = 'M&Q SPA';
          } else if (jorqProg > 0 || jorqReal > 0) {
            company = 'JORQUERA TRANSPORTE S.A.';
          }
        }
        
        // Fallback: Check Destino text content
        if (company === 'MINEX / OTRA') {
          company = getCompanyFromDestino(row.Destino);
        }

        return {
          Fecha: row.Fecha,
          Producto: row.Producto,
          Destino: row.Destino,
          Empresa: company,
          Ton_Prog: Number(row.Ton_Prog) || 0,
          Ton_Real: Number(row.Ton_Real) || 0,
          Eq_Prog: Number(row.Eq_Prog) || 0,
          Eq_Real: Number(row.Eq_Real) || 0,
          Regulacion_Real: Number(row.Regulacion_Real) || 0,

          // Custom columns propagated from Excel parsing
          col_TiempoInteriorFaenaProdMeta: Number(row.col_TiempoInteriorFaenaProdMeta) || 0,
          col_TiempoInteriorFaenaReal: Number(row.col_TiempoInteriorFaenaReal) || 0,
          col_PromedioCargaMeta: Number(row.col_PromedioCargaMeta) || 0,
          col_PromedioCargaReal: Number(row.col_PromedioCargaReal) || 0,
          col_TonProg: Number(row.col_TonProg) || 0,
          col_TonReal: Number(row.col_TonReal) || 0,
          col_EqProg: Number(row.col_EqProg) || 0,
          col_EqReal: Number(row.col_EqReal) || 0,
          col_PercentCumplimiento: Number(row.col_PercentCumplimiento) || 0,
          col_CantidadRegulaciones: Number(row.col_CantidadRegulaciones) || 0,
          col_MqAljibesProg: Number(row.col_MqAljibesProg) || 0,
          col_MqAljibesReal: Number(row.col_MqAljibesReal) || 0,
          col_JorqueraAljibesProg: Number(row.col_JorqueraAljibesProg) || 0,
          col_JorqueraAljibesReal: Number(row.col_JorqueraAljibesReal) || 0
        };
      })
      .filter((row: any) => row.Empresa === 'M&Q SPA' || row.Empresa === 'JORQUERA TRANSPORTE S.A.');
  }, [operationalRawData]);


  // Extract unique sorted dates for option selections
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(slitData.map(r => r.Fecha))];
    return dates.sort(); // Ascending chronological: oldest first
  }, [slitData]);

  const uniqueDatesDesc = useMemo(() => {
    return [...uniqueDates].reverse(); // Descending: newest first
  }, [uniqueDates]);

  // Admin filter states
  const [filterType, setFilterType] = useState<'all' | 'single' | 'range'>('all');
  const [singleDate, setSingleDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : ''; // Default to newest
  });
  const [startDate, setStartDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[0] : ''; // Default to oldest
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : ''; // Default to newest
  });

  // Keep filter dates synchronized when uniqueDates updates (e.g. after file upload or localstorage sync)
  useEffect(() => {
    if (uniqueDates.length > 0) {
      if (!singleDate || !uniqueDates.includes(singleDate)) {
        setSingleDate(uniqueDates[uniqueDates.length - 1]);
      }
      if (!startDate || !uniqueDates.includes(startDate)) {
        setStartDate(uniqueDates[0]);
      }
      if (!endDate || !uniqueDates.includes(endDate)) {
        setEndDate(uniqueDates[uniqueDates.length - 1]);
      }
    }
  }, [uniqueDates, singleDate, startDate, endDate]);

  // Filter raw data based on selections
  const filteredSlitRows = useMemo(() => {
    if (filterType === 'all') {
      return slitData;
    }
    if (filterType === 'single') {
      return slitData.filter(r => r.Fecha === singleDate);
    }
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return slitData.filter(r => r.Fecha >= start && r.Fecha <= end);
    }
    return slitData;
  }, [slitData, filterType, singleDate, startDate, endDate]);

  // Helper to determine if we should plot a historical timeline or a single category representation
  const showAsTimeline = useMemo(() => {
    if (filterType === 'all') return true;
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return start !== end;
    }
    return false;
  }, [filterType, startDate, endDate]);

  const formatHoursToTime = (hours: number): string => {
    if (isNaN(hours) || hours <= 0) return "0:00";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const IndicatorRow = ({ label, value, color = 'text-[#1C1917]' }: any) => (
    <div className="flex justify-between items-center py-3 border-b border-[#E2DFD7] last:border-0 hover:bg-[#F7F6F2] px-2 transition-colors duration-150 ease-out">
      <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  );

  // Aggregate metrics
  const stats = useMemo(() => {
    const count = filteredSlitRows.length;
    const progTon = filteredSlitRows.reduce((a, b) => a + b.Ton_Prog, 0);
    const realTon = filteredSlitRows.reduce((a, b) => a + b.Ton_Real, 0);
    const progEq = filteredSlitRows.reduce((a, b) => a + b.Eq_Prog, 0);
    const realEq = filteredSlitRows.reduce((a, b) => a + b.Eq_Real, 0);
    const compliance = progTon > 0 ? (realTon / progTon) * 100 : 0;
    
    // Unique companies
    const activeCompanies = [...new Set(filteredSlitRows.map(r => r.Empresa))].length;

    // 1. Destinations frequency to find mainDest
    const destinations: Record<string, number> = {};
    filteredSlitRows.forEach(d => {
      const dest = String(d.Destino || 'S/D');
      destinations[dest] = (destinations[dest] || 0) + 1;
    });
    const mainDestEntry = Object.entries(destinations).sort((a, b) => b[1] - a[1])[0];
    const mainDest = mainDestEntry ? mainDestEntry[0] : 'S/D';

    // 2. Average regulacion real
    const avgReg = filteredSlitRows.length > 0 
      ? (filteredSlitRows.reduce((a, b) => a + (b.Regulacion_Real || 0), 0) / filteredSlitRows.length)
      : 0;

    // 3. Average load factor
    const avgLoad = realEq > 0 ? (realTon / realEq) : 0;

    // 4. Time calculations
    const faenaRealHoursList = filteredSlitRows.map(d => Number(d.col_TiempoInteriorFaenaReal) || 0).filter(v => v > 0);
    const faenaMetaHoursList = filteredSlitRows.map(d => Number(d.col_TiempoInteriorFaenaProdMeta) || 0).filter(v => v > 0);
    const avgFaenaReal = faenaRealHoursList.length > 0 
      ? (faenaRealHoursList.reduce((a, b) => a + b, 0) / faenaRealHoursList.length) 
      : 0;
    const avgFaenaMeta = faenaMetaHoursList.length > 0 
      ? (faenaMetaHoursList.reduce((a, b) => a + b, 0) / faenaMetaHoursList.length) 
      : 0;

    const isTonDeviation = compliance < 90;
    const isTimeDeviation = avgFaenaReal > 0 && avgFaenaMeta > 0 && (avgFaenaReal - avgFaenaMeta) >= (10 / 60);
    const hasAnyDeviation = isTonDeviation || isTimeDeviation;

    return {
      count,
      progTon,
      realTon,
      progEq,
      realEq,
      compliance,
      activeCompanies,
      tonDiff: realTon - progTon,
      eqDiff: realEq - progEq,
      mainDest,
      avgReg,
      avgLoad,
      avgFaenaReal,
      avgFaenaMeta,
      isTonDeviation,
      isTimeDeviation,
      hasAnyDeviation
    };
  }, [filteredSlitRows]);

  // Filter core transit arrivals based on selection
  const filteredArrivalRows = useMemo(() => {
    if (filterType === 'all') {
      return arrivalRawData;
    }
    if (filterType === 'single') {
      return arrivalRawData.filter((r: any) => r.fecha === singleDate);
    }
    if (filterType === 'range') {
      const start = startDate <= endDate ? startDate : endDate;
      const end = startDate <= endDate ? endDate : startDate;
      return arrivalRawData.filter((r: any) => r.fecha >= start && r.fecha <= end);
    }
    return arrivalRawData;
  }, [arrivalRawData, filterType, singleDate, startDate, endDate]);

  // Combined statistics
  const crossStats = useMemo(() => {
    const totalArrivals = filteredArrivalRows.length;
    const hasArrivalsData = arrivalRawData.length > 0;
    const activeEqReal = stats.realEq;
    const globalTripsPerTruck = activeEqReal > 0 ? (totalArrivals / activeEqReal) : 0;
    const globalTonsPerTrip = totalArrivals > 0 ? (stats.realTon / totalArrivals) : 0;

    return {
      totalArrivals,
      hasArrivalsData,
      globalTripsPerTruck: Number(globalTripsPerTruck.toFixed(2)),
      globalTonsPerTrip: Number(globalTonsPerTrip.toFixed(1))
    };
  }, [filteredArrivalRows, arrivalRawData, stats]);

  const crossCompanyAnalytics = useMemo(() => {
    // Get all unique companies from both datasets
    const uniqueCos = [...new Set([
      ...filteredSlitRows.map(r => r.Empresa),
      ...filteredArrivalRows.map(r => r.empresaStandard)
    ])].filter(Boolean);

    return uniqueCos.map(co => {
      const slitRows = filteredSlitRows.filter(r => r.Empresa === co);
      const arrivalRows = filteredArrivalRows.filter(r => r.empresaStandard === co);

      const tonsReal = slitRows.reduce((sum, r) => sum + r.Ton_Real, 0);
      const eqReal = slitRows.reduce((sum, r) => sum + r.Eq_Real, 0);
      const physicalArrivals = arrivalRows.length;

      // Viajes promedio por camión
      const tripsPerTruck = eqReal > 0 ? (physicalArrivals / eqReal) : 0;
      // Toneladas promedio por viaje físico
      const tonsPerTrip = physicalArrivals > 0 ? (tonsReal / physicalArrivals) : 0;

      return {
        name: co,
        tonsReal: Number(tonsReal.toFixed(2)),
        eqReal,
        physicalArrivals,
        tripsPerTruck: Number(tripsPerTruck.toFixed(1)),
        tonsPerTrip: Number(tonsPerTrip.toFixed(1))
      };
    }).sort((a, b) => b.tonsReal - a.tonsReal);
  }, [filteredSlitRows, filteredArrivalRows]);

  // Timeline of arrivals vs tons
  const crossTimelineData = useMemo(() => {
    if (!showAsTimeline) return [];
    
    // Group by Fecha
    const grouped: Record<string, { name: string; dateLabel: string; RealTon: number; Arribos: number }> = {};
    
    filteredSlitRows.forEach(row => {
      if (!grouped[row.Fecha]) {
        grouped[row.Fecha] = { name: row.Fecha, dateLabel: formatDateToCL(row.Fecha), RealTon: 0, Arribos: 0 };
      }
      grouped[row.Fecha].RealTon += row.Ton_Real;
    });

    filteredArrivalRows.forEach(row => {
      if (!grouped[row.fecha]) {
        grouped[row.fecha] = { name: row.fecha, dateLabel: formatDateToCL(row.fecha), RealTon: 0, Arribos: 0 };
      }
      grouped[row.fecha].Arribos += 1;
    });

    return Object.values(grouped)
      .map(item => ({
        ...item,
        RealTon: Number(item.RealTon.toFixed(2))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSlitRows, filteredArrivalRows, showAsTimeline]);

  // NEW ANALYSIS DATASET: Process the 14 custom columns requested by the user
  const customColumnsData = useMemo(() => {
    // 1. Group by date to show trends over time
    const groupedByDate: Record<string, any> = {};
    
    filteredSlitRows.forEach((row: any) => {
      const dt = row.Fecha;
      if (!groupedByDate[dt]) {
        groupedByDate[dt] = {
          date: dt,
          dateLabel: formatDateToCL(dt),
          // Time Inside Faena (Meta AX vs Real AY)
          timeInsideFaenaMetaSum: 0,
          timeInsideFaenaMetaCount: 0,
          timeInsideFaenaRealSum: 0,
          timeInsideFaenaRealCount: 0,
          // Average Load (Meta AV vs Real AW)
          avgLoadMetaSum: 0,
          avgLoadMetaCount: 0,
          avgLoadRealSum: 0,
          avgLoadRealCount: 0,
          // Totals for Ton, Eq, Compliance, Regulations
          tonProg: 0,
          tonReal: 0,
          eqProg: 0,
          eqReal: 0,
          complianceSum: 0,
          complianceCount: 0,
          regulationsCount: 0,
          // Aljibes water bowsers
          mqAljibesProg: 0,
          mqAljibesReal: 0,
          jorqueraAljibesProg: 0,
          jorqueraAljibesReal: 0
        };
      }
      
      const g = groupedByDate[dt];
      
      if (row.col_TiempoInteriorFaenaProdMeta > 0) {
        g.timeInsideFaenaMetaSum += row.col_TiempoInteriorFaenaProdMeta;
        g.timeInsideFaenaMetaCount++;
      }
      if (row.col_TiempoInteriorFaenaReal > 0) {
        g.timeInsideFaenaRealSum += row.col_TiempoInteriorFaenaReal;
        g.timeInsideFaenaRealCount++;
      }
      
      if (row.col_PromedioCargaMeta > 0) {
        g.avgLoadMetaSum += row.col_PromedioCargaMeta;
        g.avgLoadMetaCount++;
      }
      if (row.col_PromedioCargaReal > 0) {
        g.avgLoadRealSum += row.col_PromedioCargaReal;
        g.avgLoadRealCount++;
      }
      
      g.tonProg += row.col_TonProg || 0;
      g.tonReal += row.col_TonReal || 0;
      g.eqProg += row.col_EqProg || 0;
      g.eqReal += row.col_EqReal || 0;
      
      if (row.col_PercentCumplimiento > 0) {
        g.complianceSum += row.col_PercentCumplimiento;
        g.complianceCount++;
      }
      
      g.regulationsCount += row.col_CantidadRegulaciones || 0;
      
      g.mqAljibesProg += row.col_MqAljibesProg || 0;
      g.mqAljibesReal += row.col_MqAljibesReal || 0;
      g.jorqueraAljibesProg += row.col_JorqueraAljibesProg || 0;
      g.jorqueraAljibesReal += row.col_JorqueraAljibesReal || 0;
    });
    
    const timeTrend = Object.values(groupedByDate).map((g: any) => {
      const timeMeta = g.timeInsideFaenaMetaCount > 0 ? (g.timeInsideFaenaMetaSum / g.timeInsideFaenaMetaCount) : 0;
      const timeReal = g.timeInsideFaenaRealCount > 0 ? (g.timeInsideFaenaRealSum / g.timeInsideFaenaRealCount) : 0;
      const loadMeta = g.avgLoadMetaCount > 0 ? (g.avgLoadMetaSum / g.avgLoadMetaCount) : 0;
      const loadReal = g.avgLoadRealCount > 0 ? (g.avgLoadRealSum / g.avgLoadRealCount) : 0;
      const avgCompliance = g.complianceCount > 0 ? (g.complianceSum / g.complianceCount) : (g.tonProg > 0 ? (g.tonReal / g.tonProg) * 100 : 0);
      
      return {
        date: g.date,
        dateLabel: g.dateLabel,
        timeInsideFaenaMeta: Number(timeMeta.toFixed(2)),
        timeInsideFaenaReal: Number(timeReal.toFixed(2)),
        avgLoadMeta: Number(loadMeta.toFixed(1)),
        avgLoadReal: Number(loadReal.toFixed(1)),
        tonProg: Number(g.tonProg.toFixed(2)),
        tonReal: Number(g.tonReal.toFixed(2)),
        eqProg: g.eqProg,
        eqReal: g.eqReal,
        compliancePercent: Number(avgCompliance.toFixed(1)),
        regulationsCount: g.regulationsCount,
        mqAljibesProg: g.mqAljibesProg,
        mqAljibesReal: g.mqAljibesReal,
        jorqueraAljibesProg: g.jorqueraAljibesProg,
        jorqueraAljibesReal: g.jorqueraAljibesReal,
        totalAljibesProg: g.mqAljibesProg + g.jorqueraAljibesProg,
        totalAljibesReal: g.mqAljibesReal + g.jorqueraAljibesReal
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    // 2. Global averages/sums for summary cards
    let globalTimeMetaSum = 0;
    let globalTimeMetaCount = 0;
    let globalTimeRealSum = 0;
    let globalTimeRealCount = 0;
    
    let globalLoadMetaSum = 0;
    let globalLoadMetaCount = 0;
    let globalLoadRealSum = 0;
    let globalLoadRealCount = 0;
    
    let globalTonProg = 0;
    let globalTonReal = 0;
    let globalEqProg = 0;
    let globalEqReal = 0;
    let globalComplianceSum = 0;
    let globalComplianceCount = 0;
    let globalRegulations = 0;
    
    let globalMqAljibesProg = 0;
    let globalMqAljibesReal = 0;
    let globalJorqueraAljibesProg = 0;
    let globalJorqueraAljibesReal = 0;
    
    filteredSlitRows.forEach((row: any) => {
      if (row.col_TiempoInteriorFaenaProdMeta > 0) {
        globalTimeMetaSum += row.col_TiempoInteriorFaenaProdMeta;
        globalTimeMetaCount++;
      }
      if (row.col_TiempoInteriorFaenaReal > 0) {
        globalTimeRealSum += row.col_TiempoInteriorFaenaReal;
        globalTimeRealCount++;
      }
      if (row.col_PromedioCargaMeta > 0) {
        globalLoadMetaSum += row.col_PromedioCargaMeta;
        globalLoadMetaCount++;
      }
      if (row.col_PromedioCargaReal > 0) {
        globalLoadRealSum += row.col_PromedioCargaReal;
        globalLoadRealCount++;
      }
      
      globalTonProg += row.col_TonProg || 0;
      globalTonReal += row.col_TonReal || 0;
      globalEqProg += row.col_EqProg || 0;
      globalEqReal += row.col_EqReal || 0;
      
      if (row.col_PercentCumplimiento > 0) {
        globalComplianceSum += row.col_PercentCumplimiento;
        globalComplianceCount++;
      }
      globalRegulations += row.col_CantidadRegulaciones || 0;
      
      globalMqAljibesProg += row.col_MqAljibesProg || 0;
      globalMqAljibesReal += row.col_MqAljibesReal || 0;
      globalJorqueraAljibesProg += row.col_JorqueraAljibesProg || 0;
      globalJorqueraAljibesReal += row.col_JorqueraAljibesReal || 0;
    });
    
    const globalTimeInsideFaenaMeta = globalTimeMetaCount > 0 ? (globalTimeMetaSum / globalTimeMetaCount) : 0;
    const globalTimeInsideFaenaReal = globalTimeRealCount > 0 ? (globalTimeRealSum / globalTimeRealCount) : 0;
    
    const globalAvgLoadMeta = globalLoadMetaCount > 0 ? (globalLoadMetaSum / globalLoadMetaCount) : 0;
    const globalAvgLoadReal = globalLoadRealCount > 0 ? (globalLoadRealSum / globalLoadRealCount) : 0;
    
    const globalPercentCompliance = globalComplianceCount > 0 ? (globalComplianceSum / globalComplianceCount) : (globalTonProg > 0 ? (globalTonReal / globalTonProg) * 100 : 0);
    
    const aljibesData = [
      { name: 'M&Q Aljibes', Programado: globalMqAljibesProg, Real: globalMqAljibesReal },
      { name: 'Jorquera Aljibes', Programado: globalJorqueraAljibesProg, Real: globalJorqueraAljibesReal }
    ];
    
    return {
      timeTrend,
      aljibesData,
      summary: {
        timeMeta: Number(globalTimeInsideFaenaMeta.toFixed(2)),
        timeReal: Number(globalTimeInsideFaenaReal.toFixed(2)),
        loadMeta: Number(globalAvgLoadMeta.toFixed(1)),
        loadReal: Number(globalAvgLoadReal.toFixed(1)),
        tonProg: Number(globalTonProg.toFixed(2)),
        tonReal: Number(globalTonReal.toFixed(2)),
        eqProg: globalEqProg,
        eqReal: globalEqReal,
        compliancePercent: Number(globalPercentCompliance.toFixed(1)),
        totalRegulations: globalRegulations,
        mqAljibesProg: globalMqAljibesProg,
        mqAljibesReal: globalMqAljibesReal,
        jorqueraAljibesProg: globalJorqueraAljibesProg,
        jorqueraAljibesReal: globalJorqueraAljibesReal
      }
    };
  }, [filteredSlitRows]);

  // Chart data: Tonnage by Company
  const companyTonnageData = useMemo(() => {
    const grouped: Record<string, { name: string; Programado: number; Real: number }> = {};
    filteredSlitRows.forEach(row => {
      const emp = row.Empresa;
      if (!grouped[emp]) {
        grouped[emp] = { name: emp, Programado: 0, Real: 0 };
      }
      grouped[emp].Programado += row.Ton_Prog;
      grouped[emp].Real += row.Ton_Real;
    });
    return Object.values(grouped).map(item => ({
      ...item,
      Programado: Number(item.Programado.toFixed(2)),
      Real: Number(item.Real.toFixed(2))
    })).sort((a, b) => b.Real - a.Real);
  }, [filteredSlitRows]);

  // Chart data: Equipos by Company
  const companyEquiposData = useMemo(() => {
    const grouped: Record<string, { name: string; Programado: number; Real: number }> = {};
    filteredSlitRows.forEach(row => {
      const emp = row.Empresa;
      if (!grouped[emp]) {
        grouped[emp] = { name: emp, Programado: 0, Real: 0 };
      }
      grouped[emp].Programado += row.Eq_Prog;
      grouped[emp].Real += row.Eq_Real;
    });
    return Object.values(grouped).sort((a, b) => b.Real - a.Real);
  }, [filteredSlitRows]);

  // Chart data: Timeline representation (Historical progression when "all dates" is active, or just day details)
  const timelineData = useMemo(() => {
    const grouped: Record<string, { name: string; dateLabel: string; ProgramadoTon: number; RealTon: number; ProgramadoEq: number; RealEq: number }> = {};
    const groupKey = showAsTimeline ? 'Fecha' : 'Empresa';
    
    filteredSlitRows.forEach(row => {
      const key = groupKey === 'Fecha' ? row.Fecha : row.Empresa;
      if (!grouped[key]) {
        grouped[key] = { 
          name: key, 
          dateLabel: groupKey === 'Fecha' ? formatDateToCL(row.Fecha) : key,
          ProgramadoTon: 0, 
          RealTon: 0,
          ProgramadoEq: 0,
          RealEq: 0
        };
      }
      grouped[key].ProgramadoTon += row.Ton_Prog;
      grouped[key].RealTon += row.Ton_Real;
      grouped[key].ProgramadoEq += row.Eq_Prog;
      grouped[key].RealEq += row.Eq_Real;
    });
    
    return Object.values(grouped)
       .map(item => ({
         ...item,
         ProgramadoTon: Number(item.ProgramadoTon.toFixed(2)),
         RealTon: Number(item.RealTon.toFixed(2))
       }))
       .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSlitRows, showAsTimeline]);

  return (
    <div className="min-h-screen w-full bg-[#ECEAE3] text-[#181615] flex flex-col justify-between font-sans">
      <div className="w-full max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col gap-6">
        
        {/* Header bar */}
        <header className="w-full surface-card border-t-2 border-t-[#461D77] rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button 
              type="button" 
              onClick={onBack}
              aria-label="Volver"
              className="w-9 h-9 rounded-md bg-[#F2F0EA] hover:bg-[#E5E2D9] border border-[#D8D4CA] flex items-center justify-center text-[#57534E] hover:text-[#181615] transition-colors duration-150 ease-out cursor-pointer"
            >
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
            <div className="h-6 w-px bg-[#D8D4CA]" />
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wider text-[#461D77] uppercase">
                <ShieldCheck size={12} /> Administración Exclusiva
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#181615] tracking-[-0.025em] leading-none">
                Analítica de Producto: SLIT
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              type="button"
              onClick={() => setShowUploadCenter(!showUploadCenter)}
              className="px-4 py-2 bg-[#461D77] hover:bg-[#36155E] text-white rounded-md text-xs font-semibold shadow-[0_1px_2px_rgba(70,29,119,0.2)] transition-colors duration-150 ease-out flex items-center gap-2 cursor-pointer"
            >
              <Upload size={14} className={uploadingOps || uploadingArrivals ? "animate-spin" : ""} />
              {showUploadCenter ? 'Ocultar Panel Excel' : 'Cargar Planillas Excel'}
            </button>

            <div className="border-l border-[#D8D4CA] pl-3 flex items-center gap-2">
              <span className="text-[10px] font-medium text-[#57534E] uppercase tracking-wider">Producto</span>
              <span className="text-xs font-mono font-bold text-white bg-[#181615] px-2.5 py-1 rounded-md">
                SLIT
              </span>
            </div>
          </div>
        </header>

        {/* Centro de carga de planillas */}
        {showUploadCenter && (
          <section className="w-full surface-card p-5 rounded-lg space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E2DFD7] pb-3.5">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-[#1C1917] tracking-[-0.01em] flex items-center gap-2">
                  <FileSpreadsheet className="text-[#461D77]" size={16} />
                  Centro de Carga y Sincronización Doble (SLIT)
                </h2>
                <p className="text-xs text-[#57534E]">
                  Cargue las planillas de despacho y tránsito para cruzar métricas en tiempo real.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowUploadCenter(false)}
                className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] underline underline-offset-4 cursor-pointer transition-colors duration-150"
              >
                Ocultar panel
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* UPLOADER 1: INFORME OPERATIVO */}
              <div 
                className={`border border-dashed rounded-lg p-5 transition-colors duration-150 ease-out flex flex-col justify-between min-h-[210px] ${
                  dragOverOps 
                    ? 'border-[#461D77] bg-[#F3EEF8]/60' 
                    : 'border-[#E2DFD7] hover:border-[#461D77]/50 bg-[#F7F6F2]/60'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverOps(true); }}
                onDragLeave={() => setDragOverOps(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverOps(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleUploadOperationalFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white border border-[#E2DFD7] text-[#461D77] rounded-md">
                        <FileSpreadsheet size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wide">1. Informe Operativo</h3>
                        <p className="text-[11px] text-[#57534E]">Base de Datos General</p>
                      </div>
                    </div>
                    {operationalRawData.length > 0 ? (
                      <span className="text-[11px] font-mono font-semibold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 flex items-center gap-1 tabular-nums">
                        <CheckCircle2 size={12} /> {operationalRawData.length} regs
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-[#B45309] bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#57534E] leading-relaxed mb-3">
                    Toneladas, flota programada/real, cumplimientos, regulaciones y dotación de aljibes (cols. M, N, U, V, AH–AY).
                  </p>
                  
                  <div className="text-[11px] text-[#57534E] bg-white border border-[#E2DFD7] rounded-md px-3 py-2 flex items-center justify-between">
                    <span>Filtro M&Q / Jorquera detectado:</span>
                    <strong className="font-mono tabular-nums text-[#1C1917]">{slitData.length} filas</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2DFD7] flex flex-col gap-2">
                  <label className="w-full flex items-center justify-center gap-2 bg-[#461D77] hover:bg-[#36155E] text-white py-2.5 px-4 rounded-md text-xs font-semibold transition-colors duration-150 ease-out cursor-pointer select-none">
                    {uploadingOps ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> Procesando planilla...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Cargar Informe Operativo
                      </>
                    )}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.xlsm" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadOperationalFile(e.target.files[0]);
                        }
                      }}
                      disabled={uploadingOps}
                    />
                  </label>

                  {errorMsgOps && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-xs font-medium text-[#B91C1C] flex items-start gap-2 font-mono">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsgOps}</span>
                    </div>
                  )}

                  {successMsgOps && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-[#15803D] flex items-start gap-2 font-mono">
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                      <span>{successMsgOps}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* UPLOADER 2: LLEGADA DE EQUIPOS */}
              <div 
                className={`border border-dashed rounded-lg p-5 transition-colors duration-150 ease-out flex flex-col justify-between min-h-[210px] ${
                  dragOverArrivals 
                    ? 'border-[#461D77] bg-[#F3EEF8]/60' 
                    : 'border-[#E2DFD7] hover:border-[#461D77]/50 bg-[#F7F6F2]/60'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverArrivals(true); }}
                onDragLeave={() => setDragOverArrivals(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverArrivals(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleUploadArrivalsFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white border border-[#E2DFD7] text-[#57534E] rounded-md">
                        <Truck size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wide">2. Llegada de Equipos</h3>
                        <p className="text-[11px] text-[#57534E]">Bitácora de Tránsito / Retornos</p>
                      </div>
                    </div>
                    {arrivalRawData.length > 0 ? (
                      <span className="text-[11px] font-mono font-semibold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 flex items-center gap-1 tabular-nums">
                        <CheckCircle2 size={12} /> {arrivalRawData.length} arribos
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-[#B45309] bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#57534E] leading-relaxed mb-3">
                    Registra tránsitos y arribos físicos de flota para calcular rotación y cargabilidad real por empresa.
                  </p>

                  <div className="text-[11px] text-[#57534E] bg-white border border-[#E2DFD7] rounded-md px-3 py-2 flex items-center justify-between">
                    <span>Tránsitos generales cargados:</span>
                    <strong className="font-mono tabular-nums text-[#1C1917]">{arrivalRawState.length}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2DFD7] flex flex-col gap-2">
                  <label className="w-full flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#2E2925] text-white py-2.5 px-4 rounded-md text-xs font-semibold transition-colors duration-150 ease-out cursor-pointer select-none">
                    {uploadingArrivals ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> Procesando bitácora...
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Cargar Llegada de Equipos
                      </>
                    )}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.xlsm" 
                      className="hidden"  
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadArrivalsFile(e.target.files[0]);
                        }
                      }}
                      disabled={uploadingArrivals}
                    />
                  </label>

                  {errorMsgArrivals && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-xs font-medium text-[#B91C1C] flex items-start gap-2 font-mono">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsgArrivals}</span>
                    </div>
                  )}

                  {successMsgArrivals && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-[#15803D] flex items-start gap-2 font-mono">
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                      <span>{successMsgArrivals}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Filters control bar */}
        <section className="surface-card px-5 py-4 rounded-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F2F0EA] border border-[#D8D4CA] text-[#461D77] rounded-md shrink-0">
              <Filter size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#181615] uppercase tracking-wider">Rango de Consulta Operativa</h2>
              <p className="text-xs text-[#57534E]">Alcance temporal para indicadores SLIT</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="inline-flex surface-well p-1 rounded-md shrink-0">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 ease-out cursor-pointer ${
                  filterType === 'all' 
                    ? 'bg-[#181615] text-white shadow-[0_1px_2px_rgba(24,22,21,0.2)]' 
                    : 'text-[#57534E] hover:text-[#181615]'
                }`}
              >
                Histórico
              </button>
              <button
                type="button"
                onClick={() => setFilterType('single')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 ease-out cursor-pointer ${
                  filterType === 'single' 
                    ? 'bg-[#181615] text-white shadow-[0_1px_2px_rgba(24,22,21,0.2)]' 
                    : 'text-[#57534E] hover:text-[#181615]'
                }`}
              >
                Día Único
              </button>
              <button
                type="button"
                onClick={() => setFilterType('range')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 ease-out cursor-pointer ${
                  filterType === 'range' 
                    ? 'bg-[#181615] text-white shadow-[0_1px_2px_rgba(24,22,21,0.2)]' 
                    : 'text-[#57534E] hover:text-[#181615]'
                }`}
              >
                Rango
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {filterType === 'single' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase text-[#57534E]">Fecha:</span>
                  <select
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="surface-well rounded-md px-3 py-1.5 text-xs font-mono font-semibold text-[#181615] outline-none focus:border-[#461D77]"
                  >
                    {uniqueDatesDesc.map(d => (
                      <option key={d} value={d}>{formatDateToCL(d)}</option>
                    ))}
                  </select>
                </div>
              )}

              {filterType === 'range' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase text-[#57534E]">Desde:</span>
                    <select
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="surface-well rounded-md px-3 py-1.5 text-xs font-mono font-semibold text-[#181615] outline-none focus:border-[#461D77]"
                    >
                      {uniqueDates.map(d => (
                        <option key={d} value={d}>{formatDateToCL(d)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase text-[#57534E]">Hasta:</span>
                    <select
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="surface-well rounded-md px-3 py-1.5 text-xs font-mono font-semibold text-[#181615] outline-none focus:border-[#461D77]"
                    >
                      {uniqueDates.map(d => (
                        <option key={d} value={d}>{formatDateToCL(d)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filterType === 'all' && (
                <div className="text-xs font-mono font-semibold text-[#181615] surface-well px-3 py-1.5 rounded-md tabular-nums">
                  {uniqueDates.length} jornadas consolidadas
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AUDITORÍA DE DESEMPEÑO SLIT */}
        <section className="surface-card p-6 rounded-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E2D9] pb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">
                Auditoría de Desempeño
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#181615] tracking-[-0.03em] leading-none">
                SLIT
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
                stats.hasAnyDeviation
                  ? 'text-[#B91C1C]'
                  : 'text-[#15803D]'
              }`}>
                {stats.hasAnyDeviation ? 'Requiere Justificación Técnica' : 'Cumplimiento Operativo'}
              </span>
              <span className="text-[#BDB8AC]" aria-hidden="true">·</span>
              <span className="bg-[#181615] text-white px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold">
                ÍTEM 1 / 7
              </span>
            </div>
          </div>

          {/* 4-Col Hairline-Divided KPI Strip with Dark Anchor on Cumplimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8D4CA] border border-[#D8D4CA] rounded-lg overflow-hidden bg-[#FFFFFF]">
            <div className="p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={13} className="text-[#461D77]" /> Carga Real
                </span>
                <span className={`text-[11px] font-mono tabular-nums font-bold ${stats.tonDiff >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                  {stats.tonDiff >= 0 ? '+' : ''}{formatNumberWithDecimals(stats.tonDiff, 2)} t
                </span>
              </div>
              <p className="text-3xl font-extrabold font-mono tabular-nums tracking-[-0.025em] text-[#181615]">
                {formatNumberWithDecimals(stats.realTon, 2)} <span className="text-xs font-sans font-medium text-[#57534E]">Ton</span>
              </p>
            </div>

            <div className="p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                  <Truck size={13} className="text-[#461D77]" /> Flota Real
                </span>
                <span className={`text-[11px] font-mono tabular-nums font-bold ${stats.eqDiff >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                  {stats.eqDiff >= 0 ? '+' : ''}{stats.eqDiff} EQ
                </span>
              </div>
              <p className="text-3xl font-extrabold font-mono tabular-nums tracking-[-0.025em] text-[#181615]">
                {stats.realEq} <span className="text-xs font-sans font-medium text-[#57534E]">EQ</span>
              </p>
            </div>

            <div className="p-5 flex flex-col justify-between gap-3 bg-[#181615] text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#BDB8AC] uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={13} className="text-[#C4A6EB]" /> Cumplimiento
                </span>
                <span className={`text-[11px] font-mono tabular-nums font-bold ${
                  stats.compliance >= 100 ? 'text-[#86EFAC]' : stats.compliance >= 90 ? 'text-[#FCD34D]' : 'text-[#FCA5A5]'
                }`}>
                  {(stats.compliance - 100) >= 0 ? '+' : ''}{(stats.compliance - 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-3xl font-extrabold font-mono tabular-nums tracking-[-0.025em] text-white">
                {stats.compliance.toFixed(1)}%
              </p>
            </div>

            <div className="p-5 flex flex-col justify-between gap-3">
              <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-[#461D77]" /> Destino Crítico
              </span>
              <p className="text-lg font-extrabold text-[#181615] uppercase truncate tracking-tight" title={stats.mainDest}>
                {stats.mainDest}
              </p>
            </div>
          </div>

          {/* Comparative chart & indicators table layout (Asymmetric 12-col split) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
            <div className="lg:col-span-8 border border-[#E2DFD7] rounded-lg p-5 bg-white">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'Tonelaje', Programado: stats.progTon, Real: stats.realTon },
                      { name: 'Equipos', Programado: stats.progEq, Real: stats.realEq }
                    ]} 
                    barGap={15} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#57534E' }} />
                    <YAxis hide />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: '600' }} 
                      iconType="square" 
                      iconSize={8} 
                    />
                    <Bar isAnimationActive={false} dataKey="Programado" fill="#78716C" radius={[4, 4, 0, 0]} barSize={44}>
                      <LabelList dataKey="Programado" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#57534E', fontSize: '10px', fontWeight: '700' }} offset={8} />
                    </Bar>
                    <Bar isAnimationActive={false} dataKey="Real" fill="#461D77" radius={[4, 4, 0, 0]} barSize={44}>
                      <LabelList dataKey="Real" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#461D77', fontSize: '10px', fontWeight: '700' }} offset={8} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 border border-[#E2DFD7] rounded-lg p-5 bg-[#F7F6F2]/50 flex flex-col justify-center">
              <IndicatorRow label="Regulaciones" value={`${formatNumberWithDecimals(stats.avgReg, 1)}%`} />
              <IndicatorRow label="Factor Carga" value={`${stats.avgLoad.toFixed(1)} T/EQ`} />
              <IndicatorRow label="Tpo. Real" value={formatHoursToTime(stats.avgFaenaReal)} color={stats.avgFaenaReal > stats.avgFaenaMeta && (stats.avgFaenaReal - stats.avgFaenaMeta) >= (10 / 60) ? 'text-[#B91C1C]' : 'text-[#15803D]'} />
              <IndicatorRow label="Tpo. Meta" value={formatHoursToTime(stats.avgFaenaMeta)} />
            </div>
          </div>

          <div className="flex justify-end border-t border-[#E2DFD7] pt-3">
            <span className="text-[11px] font-mono text-[#57534E] uppercase">
              Persistencia local: {filterType === 'single' ? formatDateToCL(singleDate) : filterType === 'range' ? `${formatDateToCL(startDate)} / ${formatDateToCL(endDate)}` : 'Consolidado General'} · SLIT
            </span>
          </div>
        </section>

        {/* ANÁLISIS CRUZADO OPERATIVO VS TRÁNSITO */}
        <section className="surface-card p-6 rounded-lg space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2DFD7]">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">
                Cruce Operativo vs Bitácora
              </span>
              <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.01em]">
                Analítica Cruzacional: Despacho vs Tránsito
              </h2>
              <p className="text-xs text-[#57534E]">
                Intersección de toneladas declaradas con arribos físicos registrados en Llegada de Equipos.
              </p>
            </div>
            
            <div className="text-xs font-mono bg-[#F7F6F2] border border-[#E2DFD7] px-3 py-1.5 rounded-md flex items-center gap-2 text-[#57534E]">
              <span>Estado cruce:</span>
              <span className={crossStats.hasArrivalsData ? "text-[#15803D] font-bold" : "text-[#B45309] font-bold"}>
                {crossStats.hasArrivalsData ? "CONECTADO" : "PENDIENTE"}
              </span>
            </div>
          </div>

          {!crossStats.hasArrivalsData ? (
            <div className="p-8 bg-[#F7F6F2] border border-[#E2DFD7] rounded-lg text-center max-w-2xl mx-auto space-y-3">
              <div className="w-11 h-11 bg-white border border-[#E2DFD7] text-[#B45309] rounded-md flex items-center justify-center mx-auto">
                <Truck size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1C1917]">Archivo de Llegada de Equipos no detectado</h3>
                <p className="text-xs text-[#57534E] max-w-md mx-auto leading-relaxed">
                  Cargue la planilla de tránsito en el panel superior o en el módulo <strong className="text-[#461D77]">Llegada de Equipos</strong> para habilitar rotación y cargabilidad real.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2DFD7] border border-[#E2DFD7] rounded-lg bg-[#F7F6F2]/40">
                <div className="p-4 flex flex-col justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={13} className="text-[#461D77]" /> Arribos Físicos
                  </span>
                  <h3 className="text-2xl font-bold font-mono tabular-nums text-[#1C1917]">{crossStats.totalArrivals}</h3>
                  <p className="text-[11px] text-[#57534E]">Registrados en bitácora de tránsito</p>
                </div>

                <div className="p-4 flex flex-col justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-[#461D77]" /> Rotación Promedio
                  </span>
                  <h3 className="text-2xl font-bold font-mono tabular-nums text-[#461D77]">{crossStats.globalTripsPerTruck} <span className="text-xs font-sans font-medium text-[#57534E]">viajes/eq</span></h3>
                  <p className="text-[11px] text-[#57534E]">Viajes por camión activo</p>
                </div>

                <div className="p-4 flex flex-col justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider flex items-center gap-1.5">
                    <Scale size={13} className="text-[#461D77]" /> Cargabilidad Real
                  </span>
                  <h3 className="text-2xl font-bold font-mono tabular-nums text-[#1C1917]">{crossStats.globalTonsPerTrip} <span className="text-xs font-sans font-medium text-[#57534E]">Ton/viaje</span></h3>
                  <p className="text-[11px] text-[#57534E]">Peso promedio por tránsito</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Eficiencia por Flota</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Rotación de Flota (Viajes/Camión)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossCompanyAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} viajes/eq`, 'Rotación']} />
                        <Bar dataKey="tripsPerTruck" name="Viajes/Camión" fill="#461D77" radius={[4, 4, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-widest">Aprovechamiento Útil</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Factor de Carga Promedio (Ton/Viaje)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossCompanyAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} Ton/Viaje`, 'Factor de Carga']} />
                        <Bar dataKey="tonsPerTrip" name="Tons/Viaje" fill="#57534E" radius={[4, 4, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {showAsTimeline && (
                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white w-full">
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Correlación Temporal</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Toneladas Reales vs Frecuencia de Arribos</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={crossTimelineData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#57534E', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#461D77' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="RealTon" name="Tonelaje Real (Ton)" stroke="#57534E" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="Arribos" name="Arribos Físicos" stroke="#461D77" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* No data warning or Main Charts */}
        {slitData.length === 0 ? (
          <div className="bg-white border border-[#E2DFD7] text-[#1C1917] p-8 rounded-lg text-center space-y-2.5">
            <Eye size={28} className="mx-auto text-[#B45309]" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sin registros de producto "SLIT"</h3>
            <p className="text-xs text-[#57534E] max-w-md mx-auto">
              Cargue una planilla operativa que contenga registros SLIT para habilitar los gráficos y la tabla diaria.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CHART 1 */}
              <div className="surface-card p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Rendimiento General</span>
                  <h3 className="text-sm font-bold text-[#181615] mt-0.5 mb-4">Tons: Programado vs Real (Consolidado)</h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {showAsTimeline ? (
                      <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                        <Area type="monotone" dataKey="ProgramadoTon" name="Prog Ton" stroke="#78716C" fillOpacity={0.08} fill="#78716C" strokeWidth={2} />
                        <Area type="monotone" dataKey="RealTon" name="Real Ton" stroke="#461D77" fillOpacity={0.14} fill="#461D77" strokeWidth={2.5} />
                      </AreaChart>
                    ) : (
                      <BarChart data={[{ name: 'General', Programado: stats.progTon, Real: stats.realTon }]} barGap={12} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                        <Bar dataKey="Programado" name="Prog Ton" fill="#78716C" radius={[4, 4, 0, 0]} barSize={52} />
                        <Bar dataKey="Real" name="Real Ton" fill="#461D77" radius={[4, 4, 0, 0]} barSize={52} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 2 */}
              <div className="surface-card p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-widest">Por Transportista</span>
                  <h3 className="text-sm font-bold text-[#181615] mt-0.5 mb-4">Tons: Programado vs Real (Por Empresas)</h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyTonnageData} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                      <Bar dataKey="Programado" name="Prog Ton" fill="#78716C" radius={[4, 4, 0, 0]} barSize={26} />
                      <Bar dataKey="Real" name="Real Ton" fill="#461D77" radius={[4, 4, 0, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 3 */}
              <div className="surface-card p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Logística de Acceso</span>
                  <h3 className="text-sm font-bold text-[#181615] mt-0.5 mb-4">Equipos: Programado vs Real (Consolidado)</h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {showAsTimeline ? (
                      <LineChart data={timelineData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                        <Line type="step" dataKey="ProgramadoEq" name="Prog EQ" stroke="#78716C" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="RealEq" name="Real EQ" stroke="#461D77" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={[{ name: 'General', Programado: stats.progEq, Real: stats.realEq }]} barGap={12} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                        <Bar dataKey="Programado" name="Prog EQ" fill="#78716C" radius={[4, 4, 0, 0]} barSize={52} />
                        <Bar dataKey="Real" name="Real EQ" fill="#461D77" radius={[4, 4, 0, 0]} barSize={52} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 4 */}
              <div className="surface-card p-5 rounded-lg flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-widest">Operadores en Faena</span>
                  <h3 className="text-sm font-bold text-[#181615] mt-0.5 mb-4">Equipos: Programado vs Real (Por Empresas)</h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyEquiposData} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontWeight: 600 }} />
                      <Bar dataKey="Programado" name="Prog EQ" fill="#78716C" radius={[4, 4, 0, 0]} barSize={26} />
                      <Bar dataKey="Real" name="Real EQ" fill="#461D77" radius={[4, 4, 0, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* CONTROL DE INDICADORES CRÍTICOS */}
            <section className="surface-card p-6 rounded-lg space-y-6">
              <div className="pb-4 border-b border-[#E2DFD7]">
                <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart3 size={12} /> Variables Operativas Faena
                </span>
                <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.01em] mt-0.5">
                  Control de Indicadores Críticos
                </h2>
                <p className="text-xs text-[#57534E]">
                  Tiempos en interior faena, factor de carga promedio, aljibes y regulaciones.
                </p>
              </div>

              {/* Hairline-Divided 4-Col KPI Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2DFD7] border border-[#E2DFD7] rounded-lg bg-[#F7F6F2]/40">
                {(() => {
                  const isTimeOver = customColumnsData.summary.timeReal > 0 && 
                    customColumnsData.summary.timeMeta > 0 && 
                    (customColumnsData.summary.timeReal - customColumnsData.summary.timeMeta) >= (10 / 60);
                  return (
                    <div className={`p-4 flex flex-col justify-between gap-2 ${isTimeOver ? 'bg-red-50/50' : ''}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">Tiempo Interior Faena</span>
                        <Clock size={14} className={isTimeOver ? 'text-[#B91C1C]' : 'text-[#461D77]'} />
                      </div>
                      <h4 className={`text-2xl font-bold font-mono tabular-nums ${isTimeOver ? 'text-[#B91C1C]' : 'text-[#1C1917]'}`}>
                        {customColumnsData.summary.timeReal.toFixed(2)}h
                      </h4>
                      <div className="text-[11px] text-[#57534E] flex justify-between items-center font-mono tabular-nums">
                        <span>Meta (AX):</span>
                        <span className="font-semibold text-[#1C1917]">
                          {customColumnsData.summary.timeMeta.toFixed(2)}h
                          {isTimeOver && <span className="ml-1.5 text-[#B91C1C] font-bold">+10m</span>}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="p-4 flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">Promedio Carga Real</span>
                    <Scale size={14} className="text-[#461D77]" />
                  </div>
                  <h4 className="text-2xl font-bold font-mono tabular-nums text-[#1C1917]">
                    {customColumnsData.summary.loadReal.toFixed(1)} T
                  </h4>
                  <div className="text-[11px] text-[#57534E] flex justify-between items-center font-mono tabular-nums">
                    <span>Meta (AV):</span>
                    <span className="font-semibold text-[#1C1917]">{customColumnsData.summary.loadMeta.toFixed(1)} T</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">Aljibes en Faena</span>
                    <Truck size={14} className="text-[#461D77]" />
                  </div>
                  <h4 className="text-2xl font-bold font-mono tabular-nums text-[#1C1917]">
                    {(customColumnsData.summary.mqAljibesReal + customColumnsData.summary.jorqueraAljibesReal).toLocaleString()} EQ
                  </h4>
                  <div className="text-[11px] text-[#57534E] flex justify-between items-center font-mono tabular-nums">
                    <span>Prog. (M+U):</span>
                    <span className="font-semibold text-[#1C1917]">{(customColumnsData.summary.mqAljibesProg + customColumnsData.summary.jorqueraAljibesProg).toLocaleString()} EQ</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">Regulaciones Totales</span>
                    <ClipboardCheck size={14} className="text-[#461D77]" />
                  </div>
                  <h4 className="text-2xl font-bold font-mono tabular-nums text-[#1C1917]">
                    {customColumnsData.summary.totalRegulations}
                  </h4>
                  <div className="text-[11px] text-[#57534E] flex justify-between items-center font-mono tabular-nums">
                    <span>Cumpl. prom.:</span>
                    <span className="font-semibold text-[#461D77]">{customColumnsData.summary.compliancePercent}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Eficiencia de Tiempo</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Tiempo Interior Faena (Real AY vs Meta AX)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} hrs`, 'Tiempo']} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 600 }} />
                        <Area type="monotone" dataKey="timeInsideFaenaMeta" name="Meta (AX)" stroke="#78716C" strokeWidth={2} fillOpacity={0.08} fill="#78716C" />
                        <Area type="monotone" dataKey="timeInsideFaenaReal" name="Real (AY)" stroke="#461D77" strokeWidth={2.5} fillOpacity={0.14} fill="#461D77" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-widest">Rendimiento Unitario</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Factor Promedio de Carga (Real AW vs Meta AV)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => [`${value} Ton`, 'Promedio Carga']} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 600 }} />
                        <Line type="monotone" dataKey="avgLoadMeta" name="Meta (AV)" stroke="#78716C" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="avgLoadReal" name="Real (AW)" stroke="#461D77" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-widest">Apoyo Vial</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Asignación de Aljibes (Prog vs Real)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customColumnsData.aljibesData} barGap={8} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 600 }} />
                        <Bar dataKey="Programado" name="Prog Aljibes (Col M/U)" fill="#78716C" radius={[4, 4, 0, 0]} barSize={36} />
                        <Bar dataKey="Real" name="Real Aljibes (Col N/V)" fill="#461D77" radius={[4, 4, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-[#E2DFD7] rounded-lg p-5 bg-white">
                  <span className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Calibraciones y Cumplimiento</span>
                  <h3 className="text-sm font-bold text-[#1C1917] mt-0.5 mb-4">Regulaciones Totales vs Cumplimiento (%)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customColumnsData.timeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 600, fill: '#57534E' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#461D77' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#B45309' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 600 }} />
                        <Line yAxisId="left" type="monotone" dataKey="compliancePercent" name="Cumplimiento (% col AL)" stroke="#461D77" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="regulationsCount" name="Regulaciones (Cant AS)" stroke="#B45309" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>

            {/* DETAILED DATA TABLE */}
            <div className="surface-card rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D8D4CA] bg-[#F2F0EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-widest">Registro Analítico</p>
                  <h3 className="text-sm font-bold text-[#181615] mt-0.5">Resumen Diario de Despacho SLIT</h3>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-[#181615]">
                  {stats.count} registros filtrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#E7E4DC] border-b border-[#D8D4CA]">
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider">Empresa</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider">Destino</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider text-right">Tons Prog</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider text-right">Tons Real</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider text-right">Eq Prog</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider text-right">Eq Real</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-[#44403C] uppercase tracking-wider text-center">Desviación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2D9]">
                    {filteredSlitRows.map((row, rIdx) => {
                      const devPct = row.Ton_Prog > 0 ? (row.Ton_Real / row.Ton_Prog) * 100 : 0;
                      const timeReal = Number(row.col_TiempoInteriorFaenaReal) || 0;
                      const timeMeta = Number(row.col_TiempoInteriorFaenaProdMeta) || 0;
                      const isTimeDev = timeReal > 0 && timeMeta > 0 && (timeReal - timeMeta) >= (10 / 60);

                      return (
                        <tr key={rIdx} className="hover:bg-[#F5F3EE] transition-colors duration-150">
                          <td className="px-4 py-3 text-xs font-mono tabular-nums text-[#57534E]">{formatDateToCL(row.Fecha)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-[#461D77] uppercase">{row.Empresa}</td>
                          <td className="px-4 py-3 text-xs font-medium text-[#181615] uppercase">{row.Destino}</td>
                          <td className="px-4 py-3 text-xs font-mono tabular-nums text-[#57534E] text-right">{formatNumberWithDecimals(row.Ton_Prog, 2)}</td>
                          <td className="px-4 py-3 text-xs font-mono tabular-nums font-bold text-[#181615] text-right">{formatNumberWithDecimals(row.Ton_Real, 2)}</td>
                          <td className="px-4 py-3 text-xs font-mono tabular-nums text-[#57534E] text-right">{row.Eq_Prog}</td>
                          <td className="px-4 py-3 text-xs font-mono tabular-nums font-bold text-[#181615] text-right">{row.Eq_Real}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-bold">
                              <span className={
                                devPct >= 100 
                                  ? 'text-[#15803D]' 
                                  : devPct >= 90 
                                    ? 'text-[#B45309]' 
                                    : 'text-[#B91C1C]'
                              }>
                                {devPct.toFixed(0)}%
                              </span>
                              {isTimeDev && (
                                <span className="text-[10px] text-[#B91C1C] font-bold">
                                  · +10m
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="py-4 bg-[#E5E2D9] border-t border-[#D5D0C5] text-center mt-8">
        <p className="text-[11px] font-mono text-[#44403C] uppercase tracking-wider">
          Subgerencia Logística Litio · Producto SLIT · Novandino
        </p>
      </footer>
    </div>
  );
};

export default SlitDashboard;
