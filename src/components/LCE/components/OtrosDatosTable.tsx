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
    <div className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] flex flex-col lg:flex-row overflow-hidden select-none">
      {/* Month & Year Column */}
      <div className="bg-[#461D77] p-5 lg:w-40 flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-3 border-b lg:border-b-0 lg:border-r border-[#36155E] shrink-0">
        <div className="flex items-center gap-3 lg:flex-col lg:text-center w-full justify-between lg:justify-center">
          <div className="flex items-center gap-2.5 lg:flex-col">
            <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center border border-white/15 shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="text-left lg:text-center">
              <span className="text-[11px] font-medium text-[#E2DFD7] block">
                Período
              </span>
              <span className="text-base lg:text-lg font-bold text-white capitalize leading-tight block tracking-[-0.01em]">
                {displayMes}
              </span>
            </div>
          </div>

          {displayAnio && (
            <span className="text-xs font-mono tabular-nums font-semibold text-white px-2.5 py-1 bg-white/15 rounded-md border border-white/20">
              {displayAnio}
            </span>
          )}
        </div>
      </div>

      {/* Main Stats Data Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2DFD7]">
        {/* KPI Segment 1: Accumulated Volumes */}
        <div className="p-5 space-y-3">
          <h3 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5 pb-2 border-b border-[#E2DFD7]">
            <Scale className="w-3.5 h-3.5 text-[#461D77]" />
            <span>Volúmenes Acumulados</span>
          </h3>

          <div className="divide-y divide-[#E2DFD7]">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-[#57534E] font-medium">Tonelaje Acumulado</span>
              <div className="text-right font-mono tabular-nums">
                <span className="text-sm font-bold text-[#1C1917]">
                  {numFmt(summary.tonelajeDespachadoAcumulado, 2)}
                </span>
                <span className="text-xs text-[#78716C] ml-1">t</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-[#57534E] font-medium">m³ Acumulados</span>
              <div className="text-right font-mono tabular-nums">
                <span className="text-sm font-bold text-[#1C1917]">
                  {intFmt(summary.m3Acumulados)}
                </span>
                <span className="text-xs text-[#78716C] ml-1">m³</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Segment 2: Logistics & Fleets */}
        <div className="p-5 space-y-3">
          <h3 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5 pb-2 border-b border-[#E2DFD7]">
            <Compass className="w-3.5 h-3.5 text-[#461D77]" />
            <span>Rendimiento del Transporte</span>
          </h3>

          <div className="divide-y divide-[#E2DFD7]">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-[#57534E] font-medium">Promedio por Camión (Ton)</span>
              <div className="text-right font-mono tabular-nums">
                <span className="text-sm font-bold text-[#1C1917]">
                  {numFmt(summary.promedioCamionTon, 2)}
                </span>
                <span className="text-xs text-[#78716C] ml-1">t</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-[#57534E] font-medium">Promedio por Camión (Vol.)</span>
              <div className="text-right font-mono tabular-nums">
                <span className="text-sm font-bold text-[#1C1917]">
                  {numFmt(summary.promedioCamionM3, 2)}
                </span>
                <span className="text-xs text-[#78716C] ml-1">m³</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-[#57534E] font-medium">Cantidad de Camiones (Viajes)</span>
              <div className="text-right font-bold font-mono tabular-nums text-sm text-[#1C1917]">
                {intFmt(summary.cantidadCamiones)}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Segment 3: Productivity metrics */}
        <div className="p-5 space-y-3 md:col-span-2 lg:col-span-1">
          <h3 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5 pb-2 border-b border-[#E2DFD7]">
            <Award className="w-3.5 h-3.5 text-[#461D77]" />
            <span>Productividad Mensual</span>
          </h3>

          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-xs text-[#57534E] font-medium">Productividad Lograda</span>
                <div className="flex items-baseline gap-1.5 mt-0.5 font-mono tabular-nums">
                  <span
                    className={`text-xl font-bold ${
                      isMetaAchieved ? "text-[#15803D]" : "text-[#B45309]"
                    }`}
                  >
                    {numFmt(summary.productividadMes, 2)}
                  </span>
                  <span className="text-xs text-[#78716C]">
                    vs meta {numFmt(summary.productividadMeta, 1)}
                  </span>
                </div>
              </div>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                  isMetaAchieved
                    ? "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]"
                    : "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                }`}
              >
                {isMetaAchieved ? "Superada" : "Desviada"}
              </span>
            </div>

            {/* Progress gauge */}
            <div className="w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full ${
                  isMetaAchieved ? "bg-[#15803D]" : "bg-[#B45309]"
                }`}
                style={{ width: `${Math.min(100, (summary.productividadMes / 2) * 100)}%` }}
              />
              <div
                className="absolute h-full w-0.5 bg-[#1C1917]/60 top-0 left-[65%]"
                title="Meta de 1.3"
              />
            </div>

            {/* Turnos Operativos Schedule */}
            <div className="pt-2.5 border-t border-[#E2DFD7] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-[#57534E]">
              <span className="font-semibold text-[#1C1917]">Turnos:</span>
              <span>Día 07:00–19:00 · Noche 19:00–07:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
