/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileText, Upload, Download, ArrowLeft, CheckCircle2, AlertTriangle,
  TrendingUp, Calendar, Clock, ShieldAlert, Award, Layers, Scale,
  Truck, Check, RefreshCw, Mail, FileSpreadsheet, Activity, ChevronRight,
  Eye, Edit3, Plus, Trash2, Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Area
} from "recharts";

declare const html2canvas: any;
declare const jspdf: any;

// Brand Color Constants
const PURPLE = "#4B1F82";
const GREEN = "#42B68E";
const DARK = "#172033";
const MUTED = "#7C879D";
const LIGHT = "#F6F8FB";
const GRID = "#E7ECF3";
const RED = "#E84A5F";
const AMBER = "#C99635";

// Interface for Operational Day Record
export interface DayRecord {
  row: number;
  fecha: string; // YYYY-MM-DD
  seguridad: string;
  descarga_poza: string;
  alimentacion: string;
  plan_eq: number | null;
  plan_ton: number | null;
  real_eq_carga: number | null;
  real_ton_carga: number | null;
  acum_ton: number | null;
  acum_pedido_eq: number | null;
  acum_real_eq: number | null;
  brecha_eq: number | null;
  descarga_min: number | null;
  total_faena: number | null;
  carga_salar: number | null;
  productividad: number | null;
  cumplimiento: number | null; // Fraction e.g. 0.98 or percentage 98
  factor_carga: number | null;
  regulaciones: number | null;
  recepcion_eq: number | null;
  recepcion_ton: number | null;
  recepcion_m3: number | null;
  nivel_pozas: string;
  densidad: number | null;
}

export interface ObservationItem {
  id: string;
  label: string;
  text: string;
}

// Formatters
function fmtNum(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return "S/Inf.";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function fmtInt(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "S/Inf.";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);
}

function pctValue(val: number | null | undefined): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.abs(val) <= 2 ? val * 100 : val;
}

function fmtPct(val: number | null | undefined, decimals = 1): string {
  const p = pctValue(val);
  if (p === null) return "S/Inf.";
  return `${p.toFixed(decimals).replace(".", ",")}%`;
}

function fmtMinutes(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "S/Inf.";
  const hours = Math.floor(val / 60);
  const mins = Math.round(val % 60);
  if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")} h`;
  return `${mins} min`;
}

// Sample Default Operational Data for July 2026
const SAMPLE_RECORDS: DayRecord[] = Array.from({ length: 25 }, (_, i) => {
  const day = i + 1;
  const dayStr = `2026-07-${String(day).padStart(2, "0")}`;
  const planTon = 2707.5;
  const planEq = 95;
  // Simulated operational variation
  const variation = Math.sin(day * 0.8) * 180 + (day % 3 === 0 ? -120 : 90);
  const realTon = parseFloat((planTon + variation).toFixed(1));
  const realEq = Math.round(realTon / 28.5);
  const cumplimiento = (realTon / planTon) * 100;
  const acumTon = parseFloat(((i + 1) * 2710 + variation).toFixed(1));
  
  return {
    row: i + 6,
    fecha: dayStr,
    seguridad: "Sin accidentes. Operación normal.",
    descarga_poza: "Descarga continua en Poza 4 y Poza 7",
    alimentacion: "Alimentación estable a planta",
    plan_eq: planEq,
    plan_ton: planTon,
    real_eq_carga: realEq,
    real_ton_carga: realTon,
    acum_ton: acumTon,
    acum_pedido_eq: (i + 1) * 95,
    acum_real_eq: (i + 1) * 95 + (i % 2 === 0 ? 3 : -2),
    brecha_eq: i % 2 === 0 ? 3 : -2,
    descarga_min: Math.round(31 + Math.sin(day) * 4),
    total_faena: Math.round(51 + Math.cos(day) * 5),
    carga_salar: 22,
    productividad: parseFloat((1.38 + Math.sin(day) * 0.08).toFixed(2)),
    cumplimiento: cumplimiento,
    factor_carga: 1.28,
    regulaciones: 98.5,
    recepcion_eq: Math.round(realEq * 0.98),
    recepcion_ton: parseFloat((realTon * 0.982).toFixed(1)),
    recepcion_m3: Math.round(realTon / 1.26),
    nivel_pozas: `${Math.round(80 + Math.sin(day) * 5)}%`,
    densidad: 1.24,
  };
});

const DEFAULT_OBSERVATIONS: ObservationItem[] = [
  { id: "1", label: "Seguridad - Observaciones", text: "Uso correcto de EPP en zona de descarga de pozas. Inspección de pre-uso sin hallazgos críticos." },
  { id: "2", label: "Transporte - Observaciones", text: "Flauta de camiones operando a ritmo óptimo. Sin demoras significativas en ruta Salar-Planta." },
  { id: "3", label: "MIGTRA - Observaciones", text: "Monitoreo GPS 100% activo. Cero eventos de exceso de velocidad registrados." },
  { id: "4", label: "Planta - Observaciones", text: "Recepción continua en cancha. Densidad de salmuera dentro del rango objetivo." },
  { id: "5", label: "Romana - Observaciones", text: "Pesaje automatizado en romana Salar sin atascamientos ni tiempos muertos." },
];

export function InformeOperativo({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<DayRecord[]>(SAMPLE_RECORDS);
  const [selectedDate, setSelectedDate] = useState<string>("2026-07-25");
  const [observations, setObservations] = useState<ObservationItem[]>(DEFAULT_OBSERVATIONS);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  const emailPreviewRef = useRef<HTMLDivElement>(null);
  const fullReportRef = useRef<HTMLDivElement>(null);

  // Available dates sorted chronologically
  const availableDates = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.fecha))).sort();
  }, [records]);

  // Current selected record
  const currentRecord = useMemo(() => {
    const found = records.find((r) => r.fecha === selectedDate);
    return found || records[records.length - 1] || SAMPLE_RECORDS[24];
  }, [records, selectedDate]);

  // Previous day record for delta comparisons
  const previousRecord = useMemo(() => {
    const idx = records.findIndex((r) => r.fecha === currentRecord.fecha);
    if (idx > 0) return records[idx - 1];
    return null;
  }, [records, currentRecord]);

  // Last 7 days records ending on current date
  const last7Records = useMemo(() => {
    const currentIdx = records.findIndex((r) => r.fecha === currentRecord.fecha);
    if (currentIdx === -1) return records.slice(-7);
    const startIdx = Math.max(0, currentIdx - 6);
    return records.slice(startIdx, currentIdx + 1);
  }, [records, currentRecord]);

  // Month records up to current date
  const monthRecords = useMemo(() => {
    const [cYear, cMonth] = currentRecord.fecha.split("-").map(Number);
    return records.filter((r) => {
      const [y, m] = r.fecha.split("-").map(Number);
      return y === cYear && m === cMonth && r.fecha <= currentRecord.fecha;
    });
  }, [records, currentRecord]);

  // Status computation for current record
  const currentCompliance = pctValue(currentRecord.cumplimiento) ?? 0;
  const statusInfo = useMemo(() => {
    if (currentCompliance < 95) {
      return { text: "BAJO META", color: RED, bg: "bg-rose-50 text-rose-700 border-rose-200" };
    }
    if (currentCompliance > 105) {
      return { text: "SOBRE RANGO", color: AMBER, bg: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { text: "CUMPLE", color: GREEN, bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }, [currentCompliance]);

  // Delta compliance calculation vs previous day
  const deltaCompliance = useMemo(() => {
    if (!previousRecord) return "Sin comparación";
    const prevC = pctValue(previousRecord.cumplimiento) ?? 0;
    const diff = currentCompliance - prevC;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")} pp`;
  }, [currentCompliance, previousRecord]);

  // Handle Excel Upload
  const handleExcelUpload = async (file: File) => {
    setIsUploading(true);
    setStatusNotice(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

      // Find "Base de Datos" or similar sheet
      const baseSheetName = wb.SheetNames.find((name) => {
        const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return norm.includes("base") || norm.includes("datos") || norm.includes("db");
      }) || wb.SheetNames[0];

      const baseWs = wb.Sheets[baseSheetName];
      if (!baseWs) throw new Error("No se encontró la hoja Base de Datos.");

      const rows: any[][] = XLSX.utils.sheet_to_json(baseWs, { header: 1, raw: false });
      
      const parsedRecords: DayRecord[] = [];

      // Helper to parse cell safely
      const parseNum = (val: any): number | null => {
        if (val === undefined || val === null || val === "") return null;
        if (typeof val === "number") return isNaN(val) ? null : val;
        const str = String(val).replace(/%/g, "").replace(/\./g, "").replace(",", ".").trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      const parseTimeMins = (val: any): number | null => {
        if (val === undefined || val === null) return null;
        if (typeof val === "number") return val <= 2 ? val * 24 * 60 : val;
        const str = String(val).trim();
        const parts = str.split(":");
        if (parts.length >= 2) {
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          return h * 60 + m;
        }
        return parseNum(val);
      };

      // Scan rows from index 5 (row 6)
      for (let r = 5; r < Math.min(rows.length, 500); r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row) || !row[1]) continue;

        let rawDate = row[1]; // Col B
        let dateStr = "";
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().split("T")[0];
        } else {
          const str = String(rawDate).trim();
          const parts = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
          if (parts) {
            let year = parseInt(parts[3], 10);
            if (year < 100) year += 2000;
            dateStr = `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
          } else {
            const d = new Date(str);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split("T")[0];
          }
        }

        if (!dateStr || dateStr < "2020-01-01") continue;

        const planTon = parseNum(row[15]); // Col P
        const realTon = parseNum(row[25]); // Col Z
        const cumpRaw = parseNum(row[41]); // Col AP
        const calculatedCump = cumpRaw ?? (planTon && realTon ? (realTon / planTon) * 100 : null);

        parsedRecords.push({
          row: r + 1,
          fecha: dateStr,
          seguridad: String(row[3] || "Sin observaciones"), // Col D
          descarga_poza: String(row[4] || "Normal"), // Col E
          alimentacion: String(row[5] || "Normal"), // Col F
          plan_eq: parseNum(row[14]), // Col O
          plan_ton: planTon,
          real_eq_carga: parseNum(row[24]), // Col Y
          real_ton_carga: realTon,
          acum_ton: parseNum(row[26]), // Col AA
          acum_pedido_eq: parseNum(row[27]), // Col AB
          acum_real_eq: parseNum(row[28]), // Col AC
          brecha_eq: parseNum(row[29]), // Col AD
          descarga_min: parseTimeMins(row[32]), // Col AG
          total_faena: parseTimeMins(row[34]), // Col AI
          carga_salar: parseTimeMins(row[35]), // Col AJ
          productividad: parseNum(row[40]), // Col AO
          cumplimiento: calculatedCump,
          factor_carga: parseNum(row[42]), // Col AQ
          regulaciones: parseNum(row[43]), // Col AR
          recepcion_eq: parseNum(row[44]), // Col AS
          recepcion_ton: parseNum(row[45]), // Col AT
          recepcion_m3: parseNum(row[46]), // Col AU
          nivel_pozas: String(row[52] || "S/Inf."), // Col BA
          densidad: parseNum(row[53]), // Col BB
        });
      }

      if (parsedRecords.length === 0) {
        throw new Error("No se encontraron filas con fechas válidas en la hoja Base de Datos.");
      }

      // Sort chronologically
      parsedRecords.sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Extract observations from "Informe Operacional" sheet if present
      const informeSheetName = wb.SheetNames.find((name) => {
        const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return norm.includes("informe") || norm.includes("operacional");
      });

      if (informeSheetName && wb.Sheets[informeSheetName]) {
        const infWs = wb.Sheets[informeSheetName];
        const getCellVal = (addr: string) => infWs[addr]?.v ? String(infWs[addr].v).trim() : "";
        
        const extractedObs: ObservationItem[] = [];
        const checkCell = (id: string, label: string, addr: string) => {
          const text = getCellVal(addr);
          if (text && !text.toLowerCase().includes("s/d") && !text.toLowerCase().includes("sin observ")) {
            extractedObs.push({ id, label, text });
          }
        };

        checkCell("1", "Seguridad - Observaciones", "F7");
        checkCell("2", "Seguridad - Desviaciones", "F8");
        checkCell("3", "Seguridad - Oportunidades", "F9");
        checkCell("4", "Transporte - Observaciones", "F22");
        checkCell("5", "Transporte - Desviaciones", "F23");
        checkCell("6", "Transporte - Oportunidades", "F24");
        checkCell("7", "MIGTRA - Observaciones", "E34");
        checkCell("8", "MIGTRA - Desviaciones", "E36");
        checkCell("9", "Planta - Observaciones", "F55");
        checkCell("10", "Romana - Observaciones", "E63");

        if (extractedObs.length > 0) setObservations(extractedObs);
      }

      setRecords(parsedRecords);
      const latestDate = parsedRecords[parsedRecords.length - 1].fecha;
      setSelectedDate(latestDate);
      setFileName(file.name);
      setStatusNotice(`Planilla cargada con éxito: ${parsedRecords.length} jornadas operativas procesadas.`);
    } catch (err: any) {
      console.error(err);
      setStatusNotice(`Error al procesar la planilla: ${err.message || "Formato no compatible"}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Export standalone Email Image PNG (as generated by Python make_email_image)
  const handleExportEmailPng = async () => {
    if (!emailPreviewRef.current) return;
    setIsExportingPng(true);
    try {
      const element = emailPreviewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#FFFFFF",
        logging: false,
      });

      const imageBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0)
      );

      if (imageBlob) {
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Informe_Correo_SLIT_${currentRecord.fecha}.png`;
        link.click();
        URL.revokeObjectURL(url);
        setDownloadSuccessToast("¡Imagen para cuerpo de correo descargada!");
        setTimeout(() => setDownloadSuccessToast(null), 3000);
      }
    } catch (err) {
      console.error("Error generando PNG de correo:", err);
      setStatusNotice("Error al generar la imagen PNG.");
    } finally {
      setIsExportingPng(false);
    }
  };

  // Export Executive PDF Report (as generated by Python make_pdf with ReportLab layout)
  const handleExportPdf = async () => {
    if (!fullReportRef.current) return;
    setIsExportingPdf(true);
    try {
      const element = fullReportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Informe_Operacional_SLIT_${currentRecord.fecha}.pdf`);
      setDownloadSuccessToast("¡Informe PDF adjunto generado!");
      setTimeout(() => setDownloadSuccessToast(null), 3000);
    } catch (err) {
      console.error("Error generando PDF:", err);
      setStatusNotice("Error al generar el documento PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Chart 1 Data: Plan vs Real Toneladas for selected date
  const chart1Data = [
    {
      name: "Carga Toneladas",
      "Plan (Ton)": currentRecord.plan_ton || 0,
      "Real (Ton)": currentRecord.real_ton_carga || 0,
    },
  ];

  // Chart 2 Data: Last 7 Days Compliance Line Chart
  const chart2Data = last7Records.map((r) => {
    const dayLabel = r.fecha.split("-").slice(1).join("/");
    return {
      fecha: dayLabel,
      fullDate: r.fecha,
      Cumplimiento: pctValue(r.cumplimiento) || 0,
      TargetMin: 95,
      TargetMax: 105,
    };
  });

  // Chart 3 Data: Last 7 Days Double Bar Chart (Plan vs Real)
  const chart3Data = last7Records.map((r) => {
    const dayLabel = r.fecha.split("-").slice(1).join("/");
    return {
      fecha: dayLabel,
      fullDate: r.fecha,
      "Plan (Ton)": r.plan_ton || 0,
      "Real (Ton)": r.real_ton_carga || 0,
    };
  });

  // Monthly Summary Calculations
  const monthlyTotals = useMemo(() => {
    const planTotal = monthRecords.reduce((sum, r) => sum + (r.plan_ton || 0), 0);
    const realTotal = monthRecords.reduce((sum, r) => sum + (r.real_ton_carga || 0), 0);
    const recepTotal = monthRecords.reduce((sum, r) => sum + (r.recepcion_ton || 0), 0);
    const avgCompliance = monthRecords.length > 0
      ? monthRecords.reduce((sum, r) => sum + (pctValue(r.cumplimiento) || 0), 0) / monthRecords.length
      : 0;
    const daysBelowTarget = monthRecords.filter((r) => (pctValue(r.cumplimiento) || 0) < 95).length;

    return { planTotal, realTotal, recepTotal, avgCompliance, daysBelowTarget };
  }, [monthRecords]);

  return (
    <div className="min-h-screen bg-[#FAF5E6] text-tecnico font-sans p-4 md:p-8 space-y-8 select-none">
      
      {/* SUCCESS TOAST OVERLAY */}
      <AnimatePresence>
        {downloadSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span>{downloadSuccessToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HEADER & NAVIGATION */}
      <div className="bg-white rounded-3xl p-6 border border-[#D6CADF] shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#461D77] hover:text-nucleo font-black text-xs uppercase tracking-widest transition-colors mb-3 group cursor-pointer"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Volver a Módulo PQL
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4B1F82] text-white flex items-center justify-center font-black text-xl shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#42B68E] uppercase">
                PLANTA QUÍMICA LITIO &bull; PQL
              </span>
              <h1 className="text-2xl font-black text-[#172033] tracking-tight">
                Informe Operativo SLIT
              </h1>
            </div>
          </div>
        </div>

        {/* DATE SELECTOR & EXPORT TOOLBAR */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Date Picker */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#4B1F82]" />
              Fecha Jornada
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#F6F8FB] border border-[#D6CADF] rounded-xl px-3 py-2 text-xs font-bold text-[#172033] focus:outline-none focus:border-[#4B1F82] cursor-pointer shadow-inner"
            >
              {availableDates.map((dateStr) => {
                const [y, m, d] = dateStr.split("-");
                return (
                  <option key={dateStr} value={dateStr}>
                    {d}/{m}/{y} — Jornada {d}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Excel File Upload Dropzone / Button */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-[#42B68E]" />
              Cargar Archivo Excel
            </label>
            <label className="flex items-center gap-2 bg-[#F6F8FB] hover:bg-[#EBF7F3] border border-[#D6CADF] hover:border-[#42B68E] rounded-xl px-4 py-2 text-xs font-extrabold text-[#4B1F82] transition-colors cursor-pointer shadow-xs">
              <Upload className="w-3.5 h-3.5 text-[#42B68E]" />
              <span>{fileName ? "Cambiar Archivo" : "Cargar Excel SLIT"}</span>
              <input
                type="file"
                accept=".xlsx,.xlsm,.csv"
                onChange={(e) => e.target.files?.[0] && handleExcelUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          {/* Export Email Image PNG Button */}
          <button
            onClick={handleExportEmailPng}
            disabled={isExportingPng}
            className="flex items-center gap-2 bg-[#42B68E] hover:bg-[#349e7b] text-white rounded-xl px-4 py-2 text-xs font-extrabold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer mt-auto h-[38px]"
            title="Genera y descarga la imagen optimizada para pegar en el cuerpo del correo"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isExportingPng ? "Generando..." : "Imagen Correo (PNG)"}</span>
          </button>

          {/* Export PDF Report Button */}
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 bg-[#4B1F82] hover:bg-[#3b1767] text-white rounded-xl px-4 py-2 text-xs font-extrabold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer mt-auto h-[38px]"
            title="Genera el informe operacional gerencial completo en formato PDF"
          >
            <Download className="w-3.5 h-3.5 text-[#42B68E]" />
            <span>{isExportingPdf ? "Generando..." : "Descargar PDF"}</span>
          </button>
        </div>
      </div>

      {/* STATUS NOTICE BANNER */}
      {statusNotice && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#4B1F82]" />
            <span>{statusNotice}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* AREA CAPTURABLE: IMAGEN DE CORREO (FORMATO V25 EXACTO) */}
      <div className="space-y-6" id="report-export-area" ref={fullReportRef}>
        
        {/* EMAIL PREVIEW CARD CONTAINER */}
        <div
          ref={emailPreviewRef}
          id="email-image-preview"
          className="bg-white rounded-3xl p-6 md:p-8 border border-[#D6CADF] shadow-lg space-y-6 max-w-5xl mx-auto"
        >
          {/* HEADER EMBEDDED IN IMAGE */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#E7ECF3] gap-4">
            <div>
              <span className="text-xs font-black tracking-[0.25em] text-[#4B1F82] uppercase">
                NOVANDINO
              </span>
              <h2 className="text-2xl font-black text-[#4B1F82] tracking-tight">
                INFORME OPERACIONAL SLIT
              </h2>
              <p className="text-[10px] font-bold text-[#7C879D] tracking-widest uppercase mt-0.5">
                SUBGERENCIA LOGÍSTICA LITIO
              </p>
            </div>

            <div className="text-right bg-[#F6F8FB] px-5 py-2.5 rounded-2xl border border-[#E7ECF3]">
              <span className="text-[9px] font-extrabold text-[#7C879D] uppercase tracking-widest block">
                FECHA JORNADA
              </span>
              <span className="text-lg font-black text-[#42B68E] font-mono">
                {currentRecord.fecha.split("-").reverse().join("-")}
              </span>
            </div>
          </div>

          {/* MAIN STATUS & KPIS CONTAINER */}
          <div className="bg-[#FAF5E6]/40 rounded-2xl p-6 border border-[#D6CADF] relative overflow-hidden">
            <div
              className="absolute top-0 left-0 bottom-0 w-2.5"
              style={{ backgroundColor: statusInfo.color }}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-[#D6CADF]/60">
              <div>
                <span className="text-[10px] font-extrabold text-[#42B68E] tracking-widest uppercase block">
                  KPIS OPERACIONALES
                </span>
                <h3 className="text-xl font-black text-[#4B1F82] flex items-center gap-2">
                  <span>ESTADO GENERAL:</span>
                  <span className={`px-3 py-0.5 rounded-xl border text-sm font-black ${statusInfo.bg}`}>
                    {statusInfo.text}
                  </span>
                </h3>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-[#7C879D]">Cumplimiento Diario:</span>
                <span className="text-2xl font-black font-mono text-[#4B1F82] ml-2">
                  {fmtPct(currentRecord.cumplimiento)}
                </span>
              </div>
            </div>

            {/* 8 KPI GRID CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Card 1: Cumplimiento carga */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Cumplimiento carga
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtPct(currentRecord.cumplimiento)}
                </span>
                <span className="text-[10px] font-bold text-[#42B68E] block">
                  vs día anterior {deltaCompliance}
                </span>
              </div>

              {/* Card 2: Carga real */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Carga real
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtNum(currentRecord.real_ton_carga)} Ton
                </span>
                <span className="text-[10px] font-bold text-[#42B68E] block">
                  plan {fmtNum(currentRecord.plan_ton)}
                </span>
              </div>

              {/* Card 3: Recepción real */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Recepción real
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtNum(currentRecord.recepcion_ton)} Ton
                </span>
                <span className="text-[10px] font-bold text-[#42B68E] block">
                  {fmtInt(currentRecord.recepcion_eq)} EQ
                </span>
              </div>

              {/* Card 4: Equipos carga */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Equipos carga
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtInt(currentRecord.real_eq_carga)} EQ
                </span>
                <span className="text-[10px] font-bold text-[#4B1F82] block">
                  plan {fmtInt(currentRecord.plan_eq)}
                </span>
              </div>

              {/* Card 5: Productividad */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Productividad
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtNum(currentRecord.productividad, 2)} v/eq
                </span>
                <span className="text-[10px] font-bold text-[#4B1F82] block">
                  factor {fmtNum(currentRecord.factor_carga, 1)}
                </span>
              </div>

              {/* Card 6: Tiempo descarga */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Tiempo descarga
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtMinutes(currentRecord.descarga_min)}
                </span>
                <span className={`text-[10px] font-bold block ${(currentRecord.descarga_min || 99) <= 35 ? "text-[#42B68E]" : "text-[#E84A5F]"}`}>
                  meta 35 min
                </span>
              </div>

              {/* Card 7: Tiempo faena */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Tiempo faena
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5">
                  {fmtMinutes(currentRecord.total_faena)}
                </span>
                <span className={`text-[10px] font-bold block ${(currentRecord.total_faena || 99) <= 55 ? "text-[#42B68E]" : "text-[#E84A5F]"}`}>
                  meta 55 min
                </span>
              </div>

              {/* Card 8: Nivel pozas */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E7ECF3] shadow-2xs">
                <span className="text-[9px] font-bold text-[#7C879D] uppercase tracking-wider block">
                  Nivel pozas
                </span>
                <span className="text-base font-black text-[#172033] font-mono block my-0.5 truncate">
                  {currentRecord.nivel_pozas || "S/Inf."}
                </span>
                <span className="text-[10px] font-bold text-[#42B68E] block">
                  control planta
                </span>
              </div>
            </div>
          </div>

          {/* COMPARATIVE ANALYSIS CHARTS IN EMAIL IMAGE */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7ECF3] space-y-4">
            <h4 className="text-xs font-black text-[#4B1F82] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#42B68E]" />
              Análisis Comparativo de la Jornada
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Plan vs Real Bar Chart */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#172033] block">
                  Carga Toneladas: Plan vs Real
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart1Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#E7ECF3" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#7C879D" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#7C879D" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any) => [`${fmtNum(v)} Ton`, ""]} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="Plan (Ton)" fill={PURPLE} radius={[4, 4, 0, 0]} barSize={40} />
                      <Bar dataKey="Real (Ton)" fill={GREEN} radius={[4, 4, 0, 0]} barSize={40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Cumplimiento Últimos 7 Días Line Chart */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#172033] block">
                  Cumplimiento (%) Últimos 7 Días
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart2Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#E7ECF3" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="fecha" stroke="#7C879D" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#7C879D" fontSize={10} domain={[80, 120]} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any) => [`${fmtNum(v, 1)}%`, "Cumplimiento"]} />
                      <Line type="monotone" dataKey="Cumplimiento" stroke={PURPLE} strokeWidth={2.5} dot={{ r: 4, fill: PURPLE }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* DAY SUMMARY TABLE */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7ECF3] space-y-3">
            <h4 className="text-xs font-black text-[#4B1F82] uppercase tracking-wider">
              Resumen Operativo del Día
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E7ECF3] text-[9px] font-bold text-[#7C879D] uppercase tracking-wider">
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3">Plan Ton</th>
                    <th className="py-2 px-3">Real Ton</th>
                    <th className="py-2 px-3">Estado / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7ECF3] font-semibold text-[#172033]">
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Carga</td>
                    <td className="py-2.5 px-3 font-mono">{fmtNum(currentRecord.plan_ton)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#42B68E] font-bold">{fmtNum(currentRecord.real_ton_carga)}</td>
                    <td className="py-2.5 px-3 font-bold text-[#4B1F82]">{fmtPct(currentRecord.cumplimiento)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Recepción</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">-</td>
                    <td className="py-2.5 px-3 font-mono text-[#42B68E] font-bold">{fmtNum(currentRecord.recepcion_ton)}</td>
                    <td className="py-2.5 px-3 font-bold text-[#4B1F82]">{fmtInt(currentRecord.recepcion_eq)} EQ</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Acumulado Mes</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">-</td>
                    <td className="py-2.5 px-3 font-mono text-[#42B68E] font-bold">{fmtNum(currentRecord.acum_ton)}</td>
                    <td className="py-2.5 px-3 font-bold text-[#4B1F82]">Brecha eq {fmtInt(currentRecord.brecha_eq)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER CONFIDENTIAL BRAND BANNER */}
          <div className="pt-4 border-t border-[#E7ECF3] flex justify-between items-center text-[9px] font-bold text-[#7C879D] uppercase tracking-widest">
            <span>SUBGERENCIA LOGÍSTICA LITIO</span>
            <span>DOCUMENTO INTERNO &bull; CONFIDENCIAL</span>
          </div>
        </div>

        {/* DETALLE OPERACIONAL DE PLANTA & TENDENCIA 7 DÍAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* CONTROL DE PLANTA */}
          <div className="bg-white rounded-3xl p-6 border border-[#D6CADF] shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#4B1F82] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#E7ECF3]">
              <Layers className="w-4 h-4 text-[#42B68E]" />
              Control de Planta & Faena
            </h3>

            <div className="space-y-2.5 text-xs font-semibold">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Día Seguridad:</span>
                <span className="font-bold text-[#172033]">{currentRecord.seguridad}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Descarga Camiones:</span>
                <span className="font-bold text-[#172033]">{currentRecord.descarga_poza}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Alimentación:</span>
                <span className="font-bold text-[#172033]">{currentRecord.alimentacion}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Recepción (m³):</span>
                <span className="font-bold font-mono text-[#4B1F82]">{fmtInt(currentRecord.recepcion_m3)} m³</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Densidad SLIT:</span>
                <span className="font-bold font-mono text-[#42B68E]">{fmtNum(currentRecord.densidad, 2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#F6F8FB]">
                <span className="text-[#7C879D]">Regulaciones:</span>
                <span className="font-bold font-mono text-[#4B1F82]">{fmtPct(currentRecord.regulaciones)}</span>
              </div>
            </div>
          </div>

          {/* TENDENCIA ÚLTIMOS 7 DÍAS (DOUBLE BAR) */}
          <div className="bg-white rounded-3xl p-6 border border-[#D6CADF] shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#4B1F82] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#E7ECF3]">
              <TrendingUp className="w-4 h-4 text-[#42B68E]" />
              Tendencia Toneladas (Últimos 7 Días)
            </h3>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart3Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#E7ECF3" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="fecha" stroke="#7C879D" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#7C879D" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${fmtNum(v)} Ton`, ""]} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="Plan (Ton)" fill={PURPLE} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Real (Ton)" fill={GREEN} radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* OBSERVACIONES RELEVANTES & ACUMULADO MENSUAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* OBSERVACIONES */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#D6CADF] shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#E7ECF3]">
              <h3 className="text-sm font-black text-[#4B1F82] uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#42B68E]" />
                Observaciones Relevantes del Turno
              </h3>
            </div>

            <div className="space-y-3">
              {observations.map((obs) => (
                <div key={obs.id} className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] space-y-1">
                  <span className="text-[10px] font-black text-[#4B1F82] uppercase tracking-wider block">
                    {obs.label}
                  </span>
                  <p className="text-xs font-semibold text-[#172033] leading-relaxed">
                    {obs.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ACUMULADO MENSUAL */}
          <div className="bg-white rounded-3xl p-6 border border-[#D6CADF] shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#4B1F82] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#E7ECF3]">
              <Award className="w-4 h-4 text-[#42B68E]" />
              Acumulado Mensual
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] flex justify-between items-center">
                <span className="text-[#7C879D] font-bold">Plan Acumulado:</span>
                <span className="font-black font-mono text-[#172033]">{fmtNum(monthlyTotals.planTotal)} t</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] flex justify-between items-center">
                <span className="text-[#7C879D] font-bold">Carga Real Acumulada:</span>
                <span className="font-black font-mono text-[#42B68E]">{fmtNum(monthlyTotals.realTotal)} t</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] flex justify-between items-center">
                <span className="text-[#7C879D] font-bold">Recepción Acumulada:</span>
                <span className="font-black font-mono text-[#4B1F82]">{fmtNum(monthlyTotals.recepTotal)} t</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] flex justify-between items-center">
                <span className="text-[#7C879D] font-bold">Cumplimiento Promedio:</span>
                <span className="font-black font-mono text-[#4B1F82]">{fmtPct(monthlyTotals.avgCompliance)}</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F6F8FB] border border-[#E7ECF3] flex justify-between items-center">
                <span className="text-[#7C879D] font-bold">Días Bajo 95%:</span>
                <span className={`font-black font-mono ${monthlyTotals.daysBelowTarget > 0 ? "text-[#E84A5F]" : "text-[#42B68E]"}`}>
                  {monthlyTotals.daysBelowTarget} {monthlyTotals.daysBelowTarget === 1 ? "día" : "días"}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
