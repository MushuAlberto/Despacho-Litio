/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DailyLog } from "../types";
import { formatShortDateSpanish } from "../data";

// Custom larger, rotated labels for the Trips chart
const renderBar1Label = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 7;
  return (
    <text
      x={cx}
      y={cy}
      fill="#461D77"
      fontSize={12.5}
      fontWeight="black"
      fontFamily="JetBrains Mono"
      textAnchor="start"
      transform={`rotate(-45, ${cx}, ${cy})`}
    >
      {value}
    </text>
  );
};

// Custom larger, rotated labels for the LCE chart
const renderBar2Label = (props: any) => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const cx = x + width / 2;
  const cy = y - 7;
  const formattedVal = typeof value === "number" ? value.toFixed(1) : value;
  return (
    <text
      x={cx}
      y={cy}
      fill="#3FAA88"
      fontSize={12.5}
      fontWeight="black"
      fontFamily="JetBrains Mono"
      textAnchor="start"
      transform={`rotate(-45, ${cx}, ${cy})`}
    >
      {formattedVal}
    </text>
  );
};

interface DashboardChartsProps {
  logs: DailyLog[];
  selectedDate: string;
  isCapturing?: boolean;
}

export function DashboardCharts({ logs, selectedDate, isCapturing }: DashboardChartsProps) {
  // Extract month year for labels
  const dObj = new Date(selectedDate + "T00:00:00");
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const activeMonthLabel = monthNames[dObj.getMonth()];
  const activeYear = dObj.getFullYear();

  // Filter logs specifically for the active month (e.g. October 2026)
  const [selYStr, selMStr] = (selectedDate || "").split("-");
  const targetYear = parseInt(selYStr, 10) || activeYear;
  const targetMonthNum = parseInt(selMStr, 10) || (dObj.getMonth() + 1);

  const monthLogs = logs.filter((log) => {
    if (!log.fecha) return false;
    const [y, m] = log.fecha.split("-").map(Number);
    return y === targetYear && m === targetMonthNum;
  });

  // Filter ONLY loaded days with operational data (non-zero dispatch / trips / LCE)
  const loadedLogs = (monthLogs.length > 0 ? monthLogs : logs).filter(
    (log) => log.viajesRealizados > 0 || log.toneladasDespachadas > 0 || log.lceActual > 0
  );

  const activeLogs = loadedLogs.length > 0 ? loadedLogs : (monthLogs.length > 0 ? monthLogs : logs);

  // Prepare data for Chart 1: Viajes Programados vs Realizados
  const chart1Data = activeLogs.map((log) => {
    const dayNum = parseInt(log.fecha.split("-")[2] || "1", 10);
    const dayLabel = String(dayNum).padStart(2, "0");
    return {
      name: dayLabel,
      fullName: formatShortDateSpanish(log.fecha),
      "Viajes Realizados (Vueltas Desp.)": log.viajesRealizados,
      "Viajes Programados (Vueltas Prog.)": log.viajesProgramados > 0 ? log.viajesProgramados : 110,
      isActive: log.fecha === selectedDate,
    };
  });

  // Prepare data for Chart 2: LCE SdA (Diario)
  const chart2Data = activeLogs.map((log) => {
    const dayNum = parseInt(log.fecha.split("-")[2] || "1", 10);
    return {
      day: dayNum,
      name: String(dayNum).padStart(2, "0"),
      fullName: formatShortDateSpanish(log.fecha),
      "LCE Actual (SdA)": log.lceActual,
      isActive: log.fecha === selectedDate,
    };
  });

  // Custom tooltips to present numbers with Chilean/Spanish locale format
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl font-sans select-none">
          <p className="text-xs text-slate-800 font-bold font-mono tabular-nums mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((item: any) => (
              <div key={item.name} className="flex justify-between items-center gap-6">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                  {item.name}
                </span>
                <span className="text-xs font-bold font-mono tabular-nums" style={{ color: item.color || item.fill }}>
                  {new Intl.NumberFormat("es-CL").format(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const chart1Content = (
    <>
      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="name"
        stroke="#64748b"
        fontSize={10}
        tickLine={false}
        dy={8}
        axisLine={false}
        tickFormatter={(val) => val.split("-")[0]} // Just show day numbers to de-clutter
      />
      <YAxis
        stroke="#64748b"
        fontSize={10}
        axisLine={false}
        tickLine={false}
        domain={[0, "auto"]}
      />
      
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(70, 29, 119, 0.04)" }} />
      
      <Legend
        verticalAlign="bottom"
        height={36}
        iconType="circle"
        fontSize={10}
        wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#334155" }}
      />

      {/* Realized trips / Vueltas Desp. Bar */}
      <Bar
        dataKey="Viajes Realizados (Vueltas Desp.)"
        fill="#461D77"
        name="Vueltas Desp."
        radius={[4, 4, 0, 0]}
        label={renderBar1Label}
        isAnimationActive={!isCapturing}
      />

      {/* Programmed trips Target Line */}
      <Line
        type="monotone"
        dataKey="Viajes Programados (Vueltas Prog.)"
        stroke="#1e293b"
        strokeWidth={1.5}
        dot={{ r: 1.5, fill: "#1e293b", strokeWidth: 1 }}
        activeDot={{ r: 3.5 }}
        name="Vueltas Prog."
        strokeDasharray="3 3"
        isAnimationActive={!isCapturing}
      />
    </>
  );

  const chart2Content = (
    <>
      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="day"
        stroke="#64748b"
        fontSize={10}
        tickLine={false}
        dy={8}
        axisLine={false}
      />
      <YAxis
        stroke="#64748b"
        fontSize={10}
        axisLine={false}
        tickLine={false}
        domain={[0, "auto"]}
      />
      
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(70, 29, 119, 0.04)" }} />
      
      <Legend
        verticalAlign="bottom"
        height={36}
        iconType="circle"
        fontSize={10}
        wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#334155" }}
      />

      {/* LCE actual bar */}
      <Bar
        dataKey="LCE Actual (SdA)"
        fill="#3FAA88"
        name="LCE (SdA)"
        radius={[4, 4, 0, 0]}
        label={renderBar2Label}
        isAnimationActive={!isCapturing}
      />
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-6 select-none">
      {/* CHART 1: Viajes Programados vs Viajes Realizados (Diario) */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">
              Viajes Programados vs. Viajes Realizados (Diario)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              Control diario de {activeMonthLabel} {activeYear} · {activeLogs.length}{" "}
              {activeLogs.length === 1 ? "día cargado" : "días cargados"}
            </p>
          </div>
          <span className="text-xs font-bold text-[#461D77] bg-[#461D77]/5 border border-[#461D77]/15 px-3 py-1 rounded-full">
            Vueltas Despachadas
          </span>
        </div>

        {/* Responsive / Fixed chart container */}
        <div className="w-full h-80 flex items-center justify-center overflow-hidden">
          {isCapturing ? (
            <ComposedChart width={1120} height={320} data={chart1Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
              {chart1Content}
            </ComposedChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart1Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
                {chart1Content}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CHART 2: LCE SdA (Diario) */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">
              LCE SdA (Diario)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Toneladas equivalentes de carbonato de litio diarias
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            LCE (SdA)
          </span>
        </div>

        {/* Responsive / Fixed chart container */}
        <div className="w-full h-80 flex items-center justify-center overflow-hidden">
          {isCapturing ? (
            <ComposedChart width={1120} height={320} data={chart2Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
              {chart2Content}
            </ComposedChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart2Data} margin={{ top: 35, right: 35, left: -20, bottom: 5 }}>
                {chart2Content}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="text-center pb-2">
        <p className="text-[11px] font-mono text-slate-400">
          PWA diseñada por Cristian Tapia Espinoza
        </p>
      </div>
    </div>
  );
}
