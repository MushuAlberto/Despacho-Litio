/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BarChart3, HelpCircle, ShieldCheck, Scale, Compass, Award, Calendar } from "lucide-react";
import { MonthSummary } from "../types";

interface OtrosDatosTableProps {
  summary: MonthSummary;
}

export function OtrosDatosTable({ summary }: OtrosDatosTableProps) {
  const numFmt = (val: number, precision = 2) => 
    new Intl.NumberFormat("es-CL", { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(val);

  const intFmt = (val: number) => 
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);

  // Format month and year cleanly from "mes-año" (e.g. "septiembre-2026" -> "Septiembre", "2026")
  const parseMonthYear = (rawMes: string) => {
    if (!rawMes) return { mes: "Mes", anio: "" };
    const parts = rawMes.split("-");
    const m = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "";
    const a = parts[1] || "";
    return { mes: m, anio: a };
  };

  const { mes: displayMes, anio: displayAnio } = parseMonthYear(summary.mes);

  // Determine productivity status
  const prodDiff = summary.productividadMes - summary.productividadMeta;
  const isMetaAchieved = prodDiff >= 0;

  return (
    <div className="bg-white rounded-xl border border-[#D6CADF] shadow-sm flex flex-col lg:flex-row overflow-hidden select-none">
      
      {/* Month & Year Banner */}
      <div className="bg-nucleo p-4 lg:p-6 lg:w-36 flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-3 border-b lg:border-b-0 lg:border-r border-[#A38EB9] relative shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent)] pointer-events-none" />
        
        <div className="flex items-center gap-3 lg:flex-col lg:text-center relative z-10 w-full justify-between lg:justify-center">
          <div className="flex items-center gap-2.5 lg:flex-col">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shadow-xs shrink-0">
              <Calendar className="w-4 h-4 text-[#FAF5E6]" />
            </div>
            <div className="text-left lg:text-center">
              <span className="text-[10px] font-bold text-[#E9D5FF] uppercase tracking-widest block">
                Período
              </span>
              <span className="text-base lg:text-lg font-black text-[#FAF5E6] capitalize leading-tight block">
                {displayMes}
              </span>
            </div>
          </div>
          
          {displayAnio && (
            <span className="text-xs font-mono font-bold text-[#FAF5E6] px-2.5 py-1 bg-white/15 rounded-md border border-white/25 shadow-xs">
              {displayAnio}
            </span>
          )}
        </div>
      </div>

      {/* Main Stats Data Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI Segment 1: Accumulated Volumes */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-nucleo tracking-wider uppercase flex items-center gap-1.5 pb-2 border-b border-[#D6CADF]">
            <Scale className="w-4 h-4 text-nucleo" />
            Volúmenes Acumulados
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-calido border border-[#F0EBF5] hover:bg-slate-50 transition-colors">
              <span className="text-xs text-[#525252] font-semibold">Tonelaje Acumulado</span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-tecnico">
                  {numFmt(summary.tonelajeDespachadoAcumulado, 2)}
                </span>
                <span className="text-[10px] text-[#8e8e8e] font-medium ml-1">t</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-calido border border-[#F0EBF5] hover:bg-slate-50 transition-colors">
              <span className="text-xs text-[#525252] font-semibold">m³ Acumulados</span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-tecnico">
                  {intFmt(summary.m3Acumulados)}
                </span>
                <span className="text-[10px] text-[#8e8e8e] font-medium ml-1">m³</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Segment 2: Logistics & Fleets */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-nucleo tracking-wider uppercase flex items-center gap-1.5 pb-2 border-b border-[#D6CADF]">
            <Compass className="w-4 h-4 text-nucleo" />
            Rendimiento del Transporte
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-calido border border-[#F0EBF5] hover:bg-slate-50 transition-colors">
              <span className="text-xs text-[#525252] font-semibold">Promedio por Camión (Ton)</span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-tecnico">
                  {numFmt(summary.promedioCamionTon, 2)}
                </span>
                <span className="text-[10px] text-[#8e8e8e] font-medium ml-1">t</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-calido border border-[#F0EBF5] hover:bg-slate-50 transition-colors">
              <span className="text-xs text-[#525252] font-semibold">Promedio por Camión (Vol.)</span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-tecnico">
                  {numFmt(summary.promedioCamionM3, 2)}
                </span>
                <span className="text-[10px] text-[#8e8e8e] font-medium ml-1">m³</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-calido border border-[#F0EBF5] hover:bg-slate-50 transition-colors">
              <span className="text-xs text-[#525252] font-semibold">Cantidad de Camiones (Viajes)</span>
              <div className="text-right font-bold font-mono text-tecnico">
                {intFmt(summary.cantidadCamiones)}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Segment 3: Productivity metrics */}
        <div className="space-y-4 md:col-span-2 lg:col-span-1">
          <h3 className="text-xs font-bold text-nucleo tracking-wider uppercase flex items-center gap-1.5 pb-2 border-b border-[#D6CADF]">
            <Award className="w-4 h-4 text-nucleo" />
            Productividad Mensual
          </h3>
          
          <div className="bg-calido rounded-xl p-3 border border-[#F0EBF5] flex flex-col justify-between h-[92px] hover:bg-slate-50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-[#737373] uppercase font-semibold">Productividad Lograda</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-xl font-extrabold font-mono ${isMetaAchieved ? "text-ionizado" : "text-mineral"}`}>
                    {numFmt(summary.productividadMes, 2)}
                  </span>
                  <span className="text-xs text-[#8e8e8e]">vs Meta {numFmt(summary.productividadMeta, 1)}</span>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                isMetaAchieved 
                  ? "bg-[#EBF7F3] text-[#3FAA88] border border-[#CBE9DE]" 
                  : "bg-[#FAF5EC] text-[#C59E4D] border border-[#EFE1C5]"
              }`}>
                {isMetaAchieved ? "Superada" : "Desviada"}
              </span>
            </div>

            {/* Micro visual progress gauge */}
            <div className="w-full bg-white h-1.5 rounded-full overflow-hidden mt-1 relative border border-[#F0EBF5]">
              <div
                className={`absolute left-0 top-0 h-full bg-[#F5F2F9]`}
                style={{ width: "65%" }} // Meta ratio mark
              />
              <div
                className={`h-full rounded-full ${isMetaAchieved ? "bg-ionizado" : "bg-mineral"}`}
                style={{ width: `${Math.min(100, (summary.productividadMes / 2) * 100)}%` }}
              />
              {/* White tick marker for meta ratio limit */}
              <div className="absolute h-full w-[2px] bg-rose-500/80 top-0 left-[65%]" title="Meta de 1.3" />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
