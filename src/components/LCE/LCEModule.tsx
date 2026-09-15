/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { defaultDailyLogs, computeSummaryForDate } from "./data";
import { DashboardHeader } from "./components/DashboardHeader";
import { KPICards } from "./components/KPICards";
import { OtrosDatosTable } from "./components/OtrosDatosTable";
import { DashboardCharts } from "./components/DashboardCharts";
import { downloadExcelTemplate, parseUploadedExcel } from "./utils/excelGenerator";
import { BarChart3, ListFilter, AlertCircle, Sparkles, Home, ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ExcelOverrides } from "./types";
import { NovandinoLogo } from "../BrandLogo";
import { logActivity, SystemUser } from "../../services/firebase";

declare const html2canvas: any;

export default function LCEModule({ currentUser, onBack }: { currentUser: SystemUser | null; onBack: () => void }) {
  // Application states
  const [logs, setLogs] = useState(defaultDailyLogs);
  const [selectedDate, setSelectedDate] = useState("2026-05-20");
  const [isCustomFileLoaded, setIsCustomFileLoaded] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [excelOverrides, setExcelOverrides] = useState<ExcelOverrides | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEditingLce, setIsEditingLce] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // For LCE Reprogramaciones
  const [lceConfigByMonth, setLceConfigByMonth] = useState<Record<string, {
    inicioMes: number;
    reprogramaciones: Array<{ fecha: string; tonelaje: number }>;
  }>>(() => {
    const saved = localStorage.getItem("novandino_lce_config_by_month");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing lce config", e);
      }
    }
    // Seed default for July 2026 and May 2026
    return {
      "2026-7": {
        inicioMes: 18500,
        reprogramaciones: [
          { fecha: "2026-07-02", tonelaje: 20500 }
        ]
      },
      "2026-5": {
        inicioMes: 18500,
        reprogramaciones: [
          { fecha: "2026-05-02", tonelaje: 20500 }
        ]
      }
    };
  });

  const saveLceConfig = (monthKey: string, config: { inicioMes: number; reprogramaciones: Array<{ fecha: string; tonelaje: number }> }) => {
    const updated = {
      ...lceConfigByMonth,
      [monthKey]: config
    };
    setLceConfigByMonth(updated);
    localStorage.setItem("novandino_lce_config_by_month", JSON.stringify(updated));
  };

  const currentMonthKey = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return `${d.getFullYear()}-${d.getMonth() + 1}`;
  }, [selectedDate]);

  const currentLceConfig = useMemo(() => {
    const config = lceConfigByMonth[currentMonthKey];
    if (config) return config;
    
    // Default fallback
    return {
      inicioMes: 18500,
      reprogramaciones: []
    };
  }, [lceConfigByMonth, currentMonthKey]);

  const computedLceProgramadoTotal = useMemo(() => {
    if (currentLceConfig.reprogramaciones && currentLceConfig.reprogramaciones.length > 0) {
      const sorted = [...currentLceConfig.reprogramaciones]
        .filter(r => r.fecha && r.tonelaje > 0)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      if (sorted.length > 0) {
        return sorted[sorted.length - 1].tonelaje;
      }
    }
    return currentLceConfig.inicioMes;
  }, [currentLceConfig]);

  // Derive unique absolute dates available in logs (sorted chronologically)
  const allDates = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.fecha)));
  }, [logs]);

  // Read current selected daily log
  const currentLog = useMemo(() => {
    const found = logs.find((log) => log.fecha === selectedDate);
    // Fallback if date is not found
    return found || logs[logs.length - 1] || defaultDailyLogs[19];
  }, [logs, selectedDate]);

  // Compute month summary statistics accumulated up to selected date
  const summary = useMemo(() => {
    const baseSummary = computeSummaryForDate(logs, selectedDate);
    
    // Default manual configuration values
    const manualLceProgramadoTotal = computedLceProgramadoTotal;
    const manualLceActualTotal = baseSummary.lceActualTotal;
    const manualLceCumplimiento = manualLceProgramadoTotal > 0 ? (manualLceActualTotal / manualLceProgramadoTotal) * 100 : 0;

    if (isCustomFileLoaded && excelOverrides) {
      const overridenLceActualTotal = excelOverrides.lceActualTotal !== undefined ? excelOverrides.lceActualTotal : baseSummary.lceActualTotal;
      const finalLceProgramadoTotal = manualLceProgramadoTotal > 0 ? manualLceProgramadoTotal : (excelOverrides.lceProgramadoTotal !== undefined ? excelOverrides.lceProgramadoTotal : baseSummary.lceProgramadoTotal);
      const finalLceCumplimiento = finalLceProgramadoTotal > 0 ? (overridenLceActualTotal / finalLceProgramadoTotal) * 100 : 0;

      const overridenTonelajeDespachadoAcumulado = excelOverrides.tonelajeAcumulado !== undefined ? excelOverrides.tonelajeAcumulado : baseSummary.tonelajeDespachadoAcumulado;
      const overridenTonelajeProgramadoAcumulado = excelOverrides.tonelajeProgramadoAcumulado !== undefined ? excelOverrides.tonelajeProgramadoAcumulado : baseSummary.tonelajeProgramadoAcumulado;
      const overridenCumplimientoTonelaje = overridenTonelajeProgramadoAcumulado > 0 
        ? (overridenTonelajeDespachadoAcumulado / overridenTonelajeProgramadoAcumulado) * 100 
        : 0;

      const overridenViajesDespachadosAcumulados = excelOverrides.cantidadCamiones !== undefined ? excelOverrides.cantidadCamiones : baseSummary.viajesDespachadosAcumulados;
      const overridenViajesProgramadosAcumulados = excelOverrides.viajesProgramadosAcumulados !== undefined ? excelOverrides.viajesProgramadosAcumulados : baseSummary.viajesProgramadosAcumulados;
      const overridenCumplimientoViajes = overridenViajesProgramadosAcumulados > 0 
        ? (overridenViajesDespachadosAcumulados / overridenViajesProgramadosAcumulados) * 100 
        : 0;

      return {
        ...baseSummary,
        tonelajeDespachadoAcumulado: overridenTonelajeDespachadoAcumulado,
        tonelajeProgramadoAcumulado: overridenTonelajeProgramadoAcumulado,
        cumplimientoTonelaje: overridenCumplimientoTonelaje,
        m3Acumulados: excelOverrides.m3Acumulados !== undefined ? excelOverrides.m3Acumulados : baseSummary.m3Acumulados,
        promedioCamionTon: excelOverrides.promedioCamionTon !== undefined ? excelOverrides.promedioCamionTon : baseSummary.promedioCamionTon,
        promedioCamionM3: excelOverrides.promedioCamionM3 !== undefined ? excelOverrides.promedioCamionM3 : baseSummary.promedioCamionM3,
        cantidadCamiones: overridenViajesDespachadosAcumulados,
        viajesDespachadosAcumulados: overridenViajesDespachadosAcumulados,
        viajesProgramadosAcumulados: overridenViajesProgramadosAcumulados,
        cumplimientoViajes: overridenCumplimientoViajes,
        productividadMes: excelOverrides.productividadMes !== undefined ? excelOverrides.productividadMes : baseSummary.productividadMes,
        lceProgramadoTotal: finalLceProgramadoTotal,
        lceActualTotal: overridenLceActualTotal,
        lceCumplimiento: finalLceCumplimiento,
      };
    }
    
    return {
      ...baseSummary,
      lceProgramadoTotal: manualLceProgramadoTotal,
      lceCumplimiento: manualLceCumplimiento,
    };
  }, [logs, selectedDate, excelOverrides, isCustomFileLoaded, computedLceProgramadoTotal]);

  // Handlers
  const handleFileUpload = async (file: File) => {
    try {
      setErrorNotice(null);
      const parsed = await parseUploadedExcel(file);
      
      if (parsed.logs.length === 0) {
        throw new Error("No se encontraron registros de días válidos.");
      }

      // Deduplicate parsed logs by date to solve Recharts & dropdown options duplicate key errors safely
      const uniqueLogsMap = new Map<string, typeof parsed.logs[0]>();
      parsed.logs.forEach(log => {
        if (log.fecha) {
          uniqueLogsMap.set(log.fecha, log);
        }
      });
      const uniqueLogs = Array.from(uniqueLogsMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

      setLogs(uniqueLogs);
      setExcelOverrides(parsed.overrides || null);
      setIsCustomFileLoaded(true);
      setFileName(file.name);
      
      // Auto-select the last parsed date so the dashboard isn't blank
      const lastDate = uniqueLogs[uniqueLogs.length - 1]?.fecha || "2026-05-20";
      setSelectedDate(lastDate);

      // Record LCE file upload activity log in Firestore
      if (currentUser) {
        logActivity(
          currentUser,
          'Carga de Datos',
          `Cargó archivo base Excel de control LCE (${file.name}) con ${uniqueLogs.length} jornadas operativas.`
        ).catch(err => console.error('Error logging LCE excel upload:', err));
      }
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err?.message || err || "Error al procesar el archivo de Excel.");
    }
  };

  const handleDownloadImage = () => {
    setIsCapturing(true);
    setErrorNotice(null);
    // Let the DOM/render cycle align
    setTimeout(async () => {
      const element = document.getElementById("dashboard-capture-area");
      if (!element) {
        setIsCapturing(false);
        setErrorNotice("No se pudo encontrar el área del tablero para la captura.");
        return;
      }
      
      const originalGetComputedStyle = window.getComputedStyle;
      try {

        // Regex to match oklch(...) and oklab(...) color values with up to one nested parentheses level
        const oklchOklabRegex = /(oklch|oklab)\((?:[^()]+|\([^()]*\))*\)/gi;

        // Custom parser to approximate oklch / oklab colors to standard rgb / hex
        // so that the old CSS parser of html2canvas doesn't crash on modern Tailwind CSS v4 styles
        const approximateOklch = (matchedStr: string): string => {
          const cleaned = matchedStr.replace(/\s+/g, " ").trim().toLowerCase();
          const match = cleaned.match(/(?:oklch|oklab)\(\s*([0-9.%eE-]+)\s+([0-9.%eE-]+)\s+([0-9.%eE-]+)(?:\s*\/\s*([0-9.%eE-]+))?\s*\)/i);
          if (!match) {
            return "rgba(120, 120, 120, 0.5)"; // Neutral fallback for variable-based oklch colors
          }

          const l = parseFloat(match[1]);
          const c = parseFloat(match[2]);
          const h = parseFloat(match[3]);
          const alphaStr = match[4];
          
          let alpha = 1;
          if (alphaStr) {
            if (alphaStr.endsWith("%")) {
              alpha = parseFloat(alphaStr) / 100;
            } else {
              alpha = parseFloat(alphaStr);
            }
          }

          let hex = "#888888"; // standard neutral gray approximation
          if (l >= 0.95) {
            hex = "#f9fafb";
          } else if (l <= 0.15) {
            hex = "#111827";
          } else if (c < 0.03) {
            if (l > 0.8) hex = "#f3f4f6";
            else if (l > 0.6) hex = "#d1d5db";
            else if (l > 0.4) hex = "#9ca3af";
            else hex = "#4b5563";
          } else {
            if (h >= 0 && h < 50) {
              hex = l > 0.6 ? "#fda4af" : l > 0.4 ? "#f43f5e" : "#be123c";
            } else if (h >= 50 && h < 110) {
              hex = l > 0.75 ? "#fef08a" : l > 0.5 ? "#f97316" : "#c2410c";
            } else if (h >= 110 && h < 200) {
              hex = l > 0.6 ? "#86efac" : l > 0.4 ? "#22c55e" : "#15803d";
            } else if (h >= 200 && h < 300) {
              hex = l > 0.6 ? "#93c5fd" : l > 0.4 ? "#3b82f6" : "#1d4ed8";
            } else {
              hex = l > 0.6 ? "#d8b4fe" : l > 0.4 ? "#8b5cf6" : "#6d28d9";
            }
          }

          if (alpha < 1) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          }
          return hex;
        };

        const replaceOklchInString = (str: string): string => {
          if (typeof str !== "string") return str;
          if (!str.includes("oklch") && !str.includes("oklab")) return str;
          return str.replace(oklchOklabRegex, (m) => approximateOklch(m));
        };

        const makeCustomGetComputedStyle = (originalFn: typeof window.getComputedStyle, boundCtx: any) => {
          return function(el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
            const style = originalFn.call(boundCtx, el, pseudoElt);
            return new Proxy(style, {
              get(target, prop) {
                if (prop === "getPropertyValue") {
                  return function(propertyName: string): string {
                    const value = target.getPropertyValue(propertyName);
                    return replaceOklchInString(value);
                  };
                }
                const val = Reflect.get(target, prop, target);
                if (typeof val === "string") {
                  return replaceOklchInString(val);
                }
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return val;
              }
            });
          };
        };

        // Apply global temporary override
        window.getComputedStyle = makeCustomGetComputedStyle(originalGetComputedStyle, window);

        const canvas = await html2canvas(element, {
          backgroundColor: "#FAF5E6", // Match --color-calido
          scale: 2.0, // Crisp image resolution without extra lag
          useCORS: true,
          logging: false,
          allowTaint: false, // Must be false or canvas.toDataURL fails with SecurityError
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            // Apply getComputedStyle interceptor proxy within the cloned document's frame
            if (clonedDoc.defaultView) {
              const clonedOriginal = clonedDoc.defaultView.getComputedStyle;
              clonedDoc.defaultView.getComputedStyle = makeCustomGetComputedStyle(clonedOriginal, clonedDoc.defaultView);
            }

            // Apply the oklch/oklab replacement fix to all style tags in the cloned document
            clonedDoc.querySelectorAll("style").forEach((styleEl) => {
              if (styleEl.textContent) {
                styleEl.textContent = styleEl.textContent.replace(oklchOklabRegex, (m) => approximateOklch(m));
              }
            });

            // Apply the oklch/oklab replacement fix to any inline styles
            clonedDoc.querySelectorAll("[style]").forEach((el) => {
              const styleAttr = el.getAttribute("style");
              if (styleAttr) {
                el.setAttribute("style", styleAttr.replace(oklchOklabRegex, (m) => approximateOklch(m)));
              }
            });

            // Walk and sanitize all loaded sheets
            try {
              for (let i = 0; i < clonedDoc.styleSheets.length; i++) {
                try {
                  const sheet = clonedDoc.styleSheets[i] as CSSStyleSheet;
                  const rules = sheet.cssRules || sheet.rules;
                  if (!rules) continue;
                  for (let j = rules.length - 1; j >= 0; j--) {
                    const rule = rules[j];
                    if (rule instanceof CSSStyleRule) {
                      if (rule.cssText.includes("oklch") || rule.cssText.includes("oklab")) {
                        for (let k = rule.style.length - 1; k >= 0; k--) {
                          const propName = rule.style[k];
                          const propVal = rule.style.getPropertyValue(propName);
                          if (propVal.includes("oklch") || propVal.includes("oklab")) {
                            const newVal = propVal.replace(oklchOklabRegex, (m) => approximateOklch(m));
                            rule.style.setProperty(propName, newVal, rule.style.getPropertyPriority(propName));
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Ignore security boundary limitations on external stylesheets
                }
              }
            } catch (e) {
              // Ignore general stylesheet traversing limitations
            }

            const clonedEl = clonedDoc.getElementById("dashboard-capture-area");
            if (clonedEl) {
              clonedEl.style.width = "1240px";
              clonedEl.style.padding = "32px";
              clonedEl.style.borderRadius = "16px";
            }
          }
        });
        
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `NOVANDINO_Reporte_Despacho_${selectedDate}.png`;
        link.href = dataUrl;
        
        // Dynamic appending is extremely critical for reliable downloads inside iframe sandboxes
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Feedback toast for download process
        setDownloadToast(`Reporte PNG generado exitosamente.`);
        setTimeout(() => setDownloadToast(null), 3500);

        // Record download audit log
        // Record download audit log (before trigger to avoid frame blockages)
        if (currentUser) {
          const [y, m, d] = selectedDate.split('-');
          const formattedDate = `${d}/${m}/${y}`;
          logActivity(
            currentUser,
            'Descargó Imagen',
            `Descargó reporte gráfico LCE (Cloruro de Litio) para la fecha ${formattedDate}.`
          ).catch(err => console.error('Error logging LCE image download:', err));
        }
      } catch (err: any) {
        console.error("Error al generar la imagen del tablero:", err);
        setErrorNotice(`No se pudo descargar la imagen: ${err?.message || err}`);
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
        setIsCapturing(false);
      }
    }, 400);
  };

  const handleResetData = () => {
    setErrorNotice(null);
    setLogs(defaultDailyLogs);
    setExcelOverrides(null);
    setIsCustomFileLoaded(false);
    setFileName(null);
    setSelectedDate("2026-05-20");

    // Record LCE reset activity log in Firestore
    if (currentUser) {
      logActivity(
        currentUser,
        'Restableció Datos LCE',
        'Restableció los datos del módulo LCE a los registros predeterminados del sistema.'
      ).catch(err => console.error('Error logging LCE reset:', err));
    }
  };

  return (
    <div className="min-h-screen bg-calido text-tecnico p-4 sm:p-6 lg:p-8 font-sans antialiased selection:bg-nucleo/10 relative">
      
      {/* Subtle modern corporate radial highlight in brand purple / aquamarine */}
      <div className="absolute top-0 left-1/4 w-[35rem] h-[35rem] bg-nucleo/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-0 w-[20rem] h-[20rem] bg-litio/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Navigation Action Area */}
        <div className="flex justify-start items-center no-print">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#461D77] hover:bg-black rounded-full shadow-md hover:shadow-lg transition-all duration-300 uppercase tracking-widest active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver al Menú Principal</span>
          </button>
        </div>
        
        {/* Error Alert Display */}
        {errorNotice && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-6 py-4 rounded-xl flex items-center gap-4 shadow-md">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-xs uppercase tracking-widest text-rose-950">Error de Estructura de Datos</h4>
              <p className="text-xs text-rose-700 mt-0.5">{errorNotice}</p>
            </div>
            <button 
              onClick={() => setErrorNotice(null)}
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 bg-rose-100 hover:bg-rose-200 rounded border border-rose-200 active:scale-95 transition-all text-rose-900"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Dashboard Header Panel */}
        <DashboardHeader
          selectedDate={selectedDate}
          allDates={allDates}
          onDateChange={setSelectedDate}
          onFileUpload={handleFileUpload}
          onDownloadImage={handleDownloadImage}
          onResetData={handleResetData}
          isCustomFileLoaded={isCustomFileLoaded}
          fileName={fileName}
          isCapturing={isCapturing}
          isEditingLce={isEditingLce}
          onToggleEditingLce={() => setIsEditingLce(!isEditingLce)}
        />

        {/* Floating Download Capture Overlay Indicator */}
        <AnimatePresence>
          {isCapturing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-[#461D77]/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-4 pointer-events-none"
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="w-8 h-8 border-2 border-white/20 border-t-[#3FAA88] rounded-full"
                />
                <Download className="w-3.5 h-3.5 text-[#FAF5E6] absolute" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-widest uppercase text-[#FAF5E6]">
                    Generando Descarga
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#3FAA88]/20 text-[#3FAA88] font-bold rounded border border-[#3FAA88]/40">
                    PNG HD
                  </span>
                </div>
                <span className="text-[11px] text-white/80 font-medium">
                  Capturando tablero y gráficos del reporte...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Download Success Toast */}
        <AnimatePresence>
          {downloadToast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-6 right-6 z-50 bg-white text-[#171717] px-5 py-3.5 rounded-xl shadow-2xl border border-[#CBE9DE] flex items-center gap-3.5 select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[#EBF7F3] flex items-center justify-center text-[#3FAA88] shrink-0 border border-[#CBE9DE]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#171717] uppercase tracking-wide">Descarga Exitosa</span>
                <span className="text-[11px] text-[#525252] font-mono">{downloadToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captured Content Wrapper representing everything requested in the attached image */}
        <div 
          id="dashboard-capture-area" 
          className={`flex flex-col gap-6 bg-calido relative transition-all ${isCapturing ? "w-[1240px] p-8 mx-auto" : "w-full"}`}
        >
          {/* Animated visual scan beam during capture - ignored by html2canvas */}
          {isCapturing && (
            <div 
              data-html2canvas-ignore="true" 
              className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-2xl"
            >
              <motion.div
                initial={{ top: "0%" }}
                animate={{ top: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#7177EC] to-transparent shadow-[0_0_20px_4px_rgba(113,119,236,0.6)]"
              />
            </div>
          )}
          {/* SECTION: Quick Status Overview Title */}
          <div className="flex flex-col gap-4 select-none items-center justify-center text-center">
            {/* High-Fidelity Professional Novandino Logo Image */}
            <div className="flex items-center justify-center w-full">
              <NovandinoLogo className="h-32 sm:h-36 w-[450px] max-w-full" variant="large" />
            </div>

            {/* Custom Brand Header Text block matching user upload */}
            <div className="flex flex-col items-center justify-center gap-1 select-none">
              <h1 className="text-xl lg:text-2xl font-bold tracking-[0.05em] uppercase flex items-center justify-center flex-wrap gap-x-2.5">
                <span className="text-[#461D77] font-extrabold">DESPACHO DIARIO</span>
                <span className="text-[#DFD5E7] font-light">|</span>
                <span className="text-[#4E7A9F] font-light">CLORURO DE LITIO</span>
              </h1>
              <p className="text-[11px] lg:text-xs font-bold tracking-[0.05em] text-[#461D77] mt-1 uppercase flex items-center justify-center gap-1.5">
                <span>SUBGERENCIA LOGÍSTICA LITIO</span>
                <span className="text-[#461D77]/80">&middot;</span>
                <span>DESPACHO LITIO</span>
              </p>
              <p className="text-[9px] lg:text-[10px] font-semibold tracking-[0.4em] text-[#8E9AA6] uppercase mt-1">
                SALAR DE ATACAMA
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 mt-2">
              <BarChart3 className="w-4 h-4 text-nucleo" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-nucleo uppercase">
                Estadísticas e Indicadores Clave (KPI)
              </h2>
            </div>
          </div>

          {/* High-Fidelity KPI Despatch & Compliance Cards */}
          <KPICards
            currentLog={currentLog}
            summary={summary}
            lceConfig={currentLceConfig}
            onUpdateLceConfig={(cfg) => saveLceConfig(currentMonthKey, cfg)}
            selectedDate={selectedDate}
            isEditingLce={isEditingLce}
          />

          {/* "Otros Datos" Widget Table */}
          <OtrosDatosTable summary={summary} />

          {/* Interactive Month Charts & Graphs */}
          <DashboardCharts logs={logs} selectedDate={selectedDate} isCapturing={isCapturing} />
        </div>

        {/* Sticky Executive Footer with general helpful notes */}
        <footer className="pt-8 pb-4 text-center border-t border-nucleo/15 select-none text-[9px] tracking-[0.3em] text-tecnico/40 uppercase">
          <p className="font-sans">
            Tablero Gerencial de Control &bull; Novandino Litio &copy; {new Date().getFullYear()} &bull; Confidencial e Interno
          </p>
        </footer>

      </div>
    </div>
  );
}
