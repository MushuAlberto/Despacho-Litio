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
        <div className="bg-[#FFFFFF] border border-[#E2DFD7] rounded-md p-3 shadow-md font-sans select-none">
          <p className="text-xs text-[#1C1917] font-bold font-mono tabular-nums mb-1.5">{label}</p>
          <div className="space-y-1">
            {payload.map((item: any) => (
              <div key={item.name} className="flex justify-between items-center gap-6">
                <span className="text-[11px] text-[#57534E] font-medium flex items-center gap-1.5">
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
      <CartesianGrid stroke="#EFECE6" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="name"
        stroke="#57534E"
        fontSize={10}
        tickLine={false}
        dy={8}
        axisLine={false}
        tickFormatter={(val) => val.split("-")[0]} // Just show day numbers to de-clutter
      />
      <YAxis
        stroke="#57534E"
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
        wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#1C1917" }}
      />

      {/* Realized trips / Vueltas Desp. Bar */}
      <Bar
        dataKey="Viajes Realizados (Vueltas Desp.)"
        fill="#461D77"
        name="Vueltas Desp."
        radius={[3, 3, 0, 0]}
        label={renderBar1Label}
        isAnimationActive={!isCapturing}
      />

      {/* Programmed trips Target Line */}
      <Line
        type="monotone"
        dataKey="Viajes Programados (Vueltas Prog.)"
        stroke="#1C1917"
        strokeWidth={1.5}
        dot={{ r: 1.5, fill: "#1C1917", strokeWidth: 1 }}
        activeDot={{ r: 3.5 }}
        name="Vueltas Prog."
        strokeDasharray="3 3"
        isAnimationActive={!isCapturing}
      />
    </>
  );

  const chart2Content = (
    <>
      <CartesianGrid stroke="#EFECE6" strokeDasharray="3 3" vertical={false} />
      
      <XAxis
        dataKey="day"
        stroke="#57534E"
        fontSize={10}
        tickLine={false}
        dy={8}
        axisLine={false}
      />
      <YAxis
        stroke="#57534E"
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
        wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#1C1917" }}
      />

      {/* LCE actual bar */}
      <Bar
        dataKey="LCE Actual (SdA)"
        fill="#15803D"
        name="LCE (SdA)"
        radius={[3, 3, 0, 0]}
        label={renderBar2Label}
        isAnimationActive={!isCapturing}
      />
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-5 select-none">
      {/* CHART 1: Viajes Programados vs Viajes Realizados (Diario) */}
      <div className="bg-[#FFFFFF] rounded-lg p-5 border border-[#E2DFD7] flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#E2DFD7] mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#1C1917] tracking-[-0.01em]">
              Viajes Programados vs. Viajes Realizados (Diario)
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5 font-mono tabular-nums">
              Control diario de {activeMonthLabel} {activeYear} · {activeLogs.length}{" "}
              {activeLogs.length === 1 ? "día cargado" : "días cargados"}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#461D77] bg-[#F3EEF8] border border-[#461D77]/20 px-2.5 py-0.5 rounded-md">
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
      <div className="bg-[#FFFFFF] rounded-lg p-5 border border-[#E2DFD7] flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#E2DFD7] mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#1C1917] tracking-[-0.01em]">
              LCE SdA (Diario)
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Toneladas equivalentes de carbonato de litio diarias
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-md">
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
        <p className="text-[11px] font-mono text-[#78716C]">
          PWA diseñada por Cristian Tapia Espinoza
        </p>
      </div>
    </div>
  );
}
