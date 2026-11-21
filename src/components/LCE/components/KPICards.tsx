/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrendingUp, Route, CalendarCheck, Percent, Layers, Award } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { DailyLog, MonthSummary } from "../types";
import { formatShortDateSpanish, getProductividadDaily } from "../data";

function CircularProgress({
  percentage,
  color,
  trackColor = "#f1f5f9",
  size = 64,
}: {
  percentage: number;
  color: string;
  trackColor?: string;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xs font-bold font-mono tabular-nums tracking-tight"
          style={{ color }}
        >
          {new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(percentage)}%
        </span>
      </div>
    </div>
  );
}

interface KPICardsProps {
  currentLog: DailyLog;
  summary: MonthSummary;
  lceConfig: {
    inicioMes: number;
    reprogramaciones: Array<{ fecha: string; tonelaje: number }>;
  };
  onUpdateLceConfig: (config: {
    inicioMes: number;
    reprogramaciones: Array<{ fecha: string; tonelaje: number }>;
  }) => void;
  selectedDate: string;
  isEditingLce: boolean;
}

export function KPICards({
  currentLog,
  summary,
  lceConfig,
  onUpdateLceConfig,
  selectedDate,
  isEditingLce,
}: KPICardsProps) {
  const tonCompliance =
    currentLog.toneladasProgramadas > 0
      ? (currentLog.toneladasDespachadas / currentLog.toneladasProgramadas) * 100
      : 0;

  const tripsCompliance =
    currentLog.viajesProgramados > 0
      ? (currentLog.viajesRealizados / currentLog.viajesProgramados) * 100
      : 0;

  const numFmt = (val: number, precision = 2) =>
    new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(val);

  const intFmt = (val: number) =>
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(val);

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (percent >= 90) return "text-[#461D77] bg-[#461D77]/5 border-[#461D77]/20";
    if (percent >= 75) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-rose-700 bg-rose-50 border-rose-200";
  };

  const getProgressBarColor = (percent: number) => {
    if (percent >= 100) return "bg-emerald-500";
    if (percent >= 90) return "bg-[#461D77]";
    if (percent >= 75) return "bg-amber-500";
    return "bg-rose-500";
  };

  const handleInicioMesChange = (val: number) => {
    onUpdateLceConfig({
      ...lceConfig,
      inicioMes: val,
    });
  };

  const handleReproChange = (index: number, key: "fecha" | "tonelaje", val: any) => {
    const updatedRepro = [...lceConfig.reprogramaciones];
    if (!updatedRepro[index]) {
      updatedRepro[index] = { fecha: "", tonelaje: 0 };
    }
    updatedRepro[index] = {
      ...updatedRepro[index],
      [key]: val,
    };
    onUpdateLceConfig({
      ...lceConfig,
      reprogramaciones: updatedRepro,
    });
  };

  const handleRemoveRepro = (index: number) => {
    const updatedRepro = [...lceConfig.reprogramaciones];
    updatedRepro.splice(index, 1);
    onUpdateLceConfig({
      ...lceConfig,
      reprogramaciones: updatedRepro,
    });
  };

  const prodData = getProductividadDaily(currentLog);

  const dateObj = new Date(selectedDate + "T00:00:00");
  const months = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];
  const currentMonthName = months[dateObj.getMonth()];

  function formatDateDMY(dateStr: string): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
  }

  function formatMesLabel(mesStr: string): string {
    if (!mesStr) return "";
    const parts = mesStr.split("-");
    const m = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "";
    const a = parts[1] || "";
    return a ? `${m} ${a}` : m;
  }

  return (
    <div className="space-y-6">
      {/* Top Row: 3-column KPI Strip */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 select-none overflow-hidden">
        {/* PANEL 1: Programa Despacho (Toneladas) */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-baseline gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Prog. Despacho (Toneladas)
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatShortDateSpanish(currentLog.fecha)}
              </span>
            </div>

            <div className="my-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Programadas</p>
                <div className="flex items-baseline gap-1 mt-0.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-slate-800">
                    {numFmt(currentLog.toneladasProgramadas, 0)}
                  </span>
                  <span className="text-xs text-slate-400">t</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Despachadas</p>
                <div className="flex items-baseline gap-1 mt-0.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-emerald-600">
                    {numFmt(currentLog.toneladasDespachadas, 2)}
                  </span>
                  <span className="text-xs text-emerald-600">t</span>
                </div>
              </div>
            </div>

            {/* Tanker SVG Graphic */}
            <div className="w-full h-24 my-2.5 bg-slate-50 rounded-2xl relative flex items-center justify-center p-1 overflow-hidden border border-slate-200/80">
              <svg viewBox="0 0 160 70" className="w-full max-w-[200px] h-20 relative z-10">
                <line
                  x1="5"
                  y1="58"
                  x2="155"
                  y2="58"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <path
                  d="M120 30 H138 Q145 30 145 38 V54 H120 Z"
                  fill="#1e293b"
                  stroke="#461D77"
                  strokeOpacity="0.25"
                  strokeWidth="1.2"
                />
                <path
                  d="M125 35 H135 Q138 35 138 40 V45 H125 Z"
                  fill="#3FAA88"
                  opacity="0.7"
                />
                <rect x="141" y="48" width="6" height="6" rx="1" fill="#461D77" />
                <circle cx="143" cy="51" r="1.5" fill="#f8fafc" />

                <rect
                  x="15"
                  y="20"
                  width="102"
                  height="30"
                  rx="4"
                  fill="#1e293b"
                  stroke="#461D77"
                  strokeOpacity="0.25"
                  strokeWidth="1.2"
                />

                <mask id="tank-mask">
                  <rect x="16.5" y="21.5" width="99" height="27" rx="3" fill="white" />
                </mask>
                <g mask="url(#tank-mask)">
                  <rect
                    x="16.5"
                    y={`${50 - Math.min(27, Math.max(1, 27 * (tonCompliance / 100)))}`}
                    width="100"
                    height="30"
                    fill="#461D77"
                    opacity="0.85"
                  />
                  <path
                    d="M16 35 Q 40 33, 64 35 T 112 35 V 50 H 16 Z"
                    fill="#4FD1C5"
                    opacity="0.55"
                  />
                </g>

                <text
                  x="65"
                  y="38.5"
                  fill="#FFFFFF"
                  fontSize="11.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {numFmt(currentLog.toneladasDespachadas, 1)} t
                </text>

                <circle cx="32" cy="56" r="8" fill="#1e293b" />
                <circle cx="32" cy="56" r="3" fill="#e2e8f0" />
                <circle cx="50" cy="56" r="8" fill="#1e293b" />
                <circle cx="50" cy="56" r="3" fill="#e2e8f0" />
                <circle cx="95" cy="56" r="8" fill="#1e293b" />
                <circle cx="95" cy="56" r="3" fill="#e2e8f0" />
                <circle cx="132" cy="56" r="8" fill="#1e293b" />
                <circle cx="132" cy="56" r="3" fill="#e2e8f0" />
              </svg>
            </div>
          </div>

          <div>
            <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#461D77]" />
                <span>Cumplimiento Diario</span>
              </span>
              <span
                className={`text-xs font-bold font-mono tabular-nums px-2.5 py-0.5 rounded-full border ${getStatusColor(
                  tonCompliance
                )}`}
              >
                {numFmt(tonCompliance, 1)}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                  tonCompliance
                )}`}
                style={{ width: `${Math.min(100, tonCompliance)}%` }}
              />
            </div>
          </div>
        </div>

        {/* PANEL 2: Programa Despacho (Viajes) */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-baseline gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Prog. Despacho (Viajes)
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatShortDateSpanish(currentLog.fecha)} · Diario
              </span>
            </div>

            <div className="my-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Programados</p>
                <div className="flex items-baseline gap-1 mt-0.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-slate-800">
                    {intFmt(currentLog.viajesProgramados)}
                  </span>
                  <span className="text-xs text-slate-400 font-sans">viajes</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Realizados</p>
                <div className="flex items-baseline gap-1 mt-0.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-emerald-600">
                    {intFmt(currentLog.viajesRealizados)}
                  </span>
                  <span className="text-xs text-emerald-600 font-sans">viajes</span>
                </div>
              </div>
            </div>

            {/* Compact Comparative Bar Chart */}
            <div className="w-full h-24 my-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 p-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Programado", viajes: currentLog.viajesProgramados },
                    { name: "Realizado", viajes: currentLog.viajesRealizados },
                  ]}
                  margin={{ top: 8, right: 10, left: 10, bottom: 5 }}
                >
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    fontWeight="600"
                    tickLine={false}
                    axisLine={false}
                    stroke="#64748b"
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(70, 29, 119, 0.04)", radius: 4 }}
                    formatter={(value: any) => [intFmt(value) + " viajes", ""]}
                    labelStyle={{ display: "none" }}
                    contentStyle={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "4px 8px",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <Bar dataKey="viajes" radius={[4, 4, 0, 0]} barSize={32}>
                    <Cell fill="#461D77" />
                    <Cell fill="#3FAA88" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-[#461D77]" />
                <span>Vueltas Diarias</span>
              </span>
              <span
                className={`text-xs font-bold font-mono tabular-nums px-2.5 py-0.5 rounded-full border ${getStatusColor(
                  tripsCompliance
                )}`}
              >
                {numFmt(tripsCompliance, 1)}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                  tripsCompliance
                )}`}
                style={{ width: `${Math.min(100, tripsCompliance)}%` }}
              />
            </div>
          </div>
        </div>

        {/* PANEL 3: Productividad Prog. vs Real */}
        <div className="p-6 flex flex-col justify-between md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex justify-between items-baseline gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Productividad Prog. vs. Real
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatShortDateSpanish(currentLog.fecha)} · Diario
              </span>
            </div>

            <div className="my-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Productividad Prog.</p>
                <div className="flex items-baseline gap-1.5 mt-0.5 font-mono tabular-nums">
                  <span className="text-xl font-black text-slate-800">
                    {numFmt(prodData.prog, 2)}
                  </span>
                  <span className="text-xs text-slate-400 font-sans">meta</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Productividad Real</p>
                <div className="flex items-baseline gap-1.5 mt-0.5 font-mono tabular-nums">
                  <span
                    className={`text-xl font-black ${
                      prodData.real >= prodData.prog ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {numFmt(prodData.real, 2)}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      prodData.real >= prodData.prog
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {prodData.real >= prodData.prog ? "Superada" : "Bajo meta"}
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Comparative Bar Chart */}
            <div className="w-full h-24 my-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 p-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Programada", valor: prodData.prog },
                    { name: "Real", valor: prodData.real },
                  ]}
                  margin={{ top: 8, right: 10, left: 10, bottom: 5 }}
                >
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    fontWeight="600"
                    tickLine={false}
                    axisLine={false}
                    stroke="#64748b"
                  />
                  <YAxis
                    hide
                    domain={[
                      0,
                      Math.max(2, Math.ceil(Math.max(prodData.prog, prodData.real) * 1.25)),
                    ]}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(70, 29, 119, 0.04)", radius: 4 }}
                    formatter={(value: any) => [numFmt(value, 2), "Productividad"]}
                    labelStyle={{ display: "none" }}
                    contentStyle={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "4px 8px",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={32}>
                    <Cell fill="#461D77" />
                    <Cell fill={prodData.real >= prodData.prog ? "#3FAA88" : "#D97706"} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#461D77]" />
                <span>Cumplimiento Productividad</span>
              </span>
              <span
                className={`text-xs font-bold font-mono tabular-nums px-2.5 py-0.5 rounded-full border ${getStatusColor(
                  prodData.compliance
                )}`}
              >
                {numFmt(prodData.compliance, 1)}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                  prodData.compliance
                )}`}
                style={{ width: `${Math.min(100, prodData.compliance)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Cumplimiento MTD & LCE - Salar de Atacama */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL A: Cumplimiento Mes en Curso (MTD Accums) */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Cumplimiento MTD ({formatMesLabel(summary.mes)})
              </span>
              <span className="text-xs font-mono text-[#461D77] font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Acumulado</span>
              </span>
            </div>

            <div className="divide-y divide-slate-100 my-2">
              {/* Tonelaje Row */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-slate-800 font-black block">
                    Tonelaje Acumulado
                  </span>
                  <div className="space-y-0.5 font-mono tabular-nums">
                    <div className="text-xs text-slate-400">
                      Prog:{" "}
                      <span className="font-bold text-slate-700">
                        {numFmt(summary.tonelajeProgramadoAcumulado, 0)} t
                      </span>
                    </div>
                    <div className="text-sm font-black text-[#461D77]">
                      Real: {numFmt(summary.tonelajeDespachadoAcumulado, 2)} t
                    </div>
                  </div>
                </div>
                <CircularProgress percentage={summary.cumplimientoTonelaje} color="#461D77" />
              </div>

              {/* Viajes Row */}
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-slate-800 font-black block">
                    Viajes Acumulados
                  </span>
                  <div className="space-y-0.5 font-mono tabular-nums">
                    <div className="text-xs text-slate-400">
                      Prog:{" "}
                      <span className="font-bold text-slate-700">
                        {intFmt(summary.viajesProgramadosAcumulados)} viajes
                      </span>
                    </div>
                    <div className="text-sm font-black text-emerald-600">
                      Real: {intFmt(summary.viajesDespachadosAcumulados)} viajes
                    </div>
                  </div>
                </div>
                <CircularProgress percentage={summary.cumplimientoViajes} color="#3FAA88" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-[#461D77]" />
              <span>Estado Meso-Mensual</span>
            </span>
            <span
              className={`text-xs font-bold font-mono tabular-nums px-3 py-0.5 rounded-full border ${getStatusColor(
                summary.cumplimientoTonelaje
              )}`}
            >
              {numFmt(summary.cumplimientoTonelaje, 1)}% MTD
            </span>
          </div>
        </div>

        {/* PANEL B: LCE - Salar de Atacama */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
          {/* Header */}
          <div className="flex justify-between items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <span className="text-xs font-black text-slate-800 tracking-tight">
              LCE - Salar de Atacama
            </span>
            <span className="text-xs font-mono font-bold text-[#461D77]">
              Acumulado mes
            </span>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-center flex-1">
            {/* Left Column: Hairline Metrics or Edit Mode */}
            <div className="lg:col-span-3">
              {isEditingLce ? (
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Producción {currentMonthName} LCE: Inicio Mes (t)
                    </label>
                    <input
                      type="number"
                      value={lceConfig.inicioMes}
                      onChange={(e) => handleInicioMesChange(Number(e.target.value))}
                      className="w-full bg-white text-sm font-bold text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#461D77] font-mono tabular-nums"
                      placeholder="Ej. 18500"
                    />
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-600 block">
                      Reprogramaciones Manuales (Máx. 3)
                    </span>

                    {[0, 1, 2].map((index) => {
                      const repro = lceConfig.reprogramaciones[index] || {
                        fecha: "",
                        tonelaje: 0,
                      };
                      return (
                        <div
                          key={index}
                          className="flex gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200"
                        >
                          <div className="flex-1">
                            <span className="block text-[11px] font-medium text-slate-400 mb-0.5">
                              Fecha
                            </span>
                            <input
                              type="date"
                              value={repro.fecha}
                              onChange={(e) =>
                                handleReproChange(index, "fecha", e.target.value)
                              }
                              className="w-full text-xs font-bold text-slate-800 p-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:border-[#461D77] font-mono tabular-nums"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="block text-[11px] font-medium text-slate-400 mb-0.5">
                              Toneladas (t)
                            </span>
                            <input
                              type="number"
                              value={repro.tonelaje || ""}
                              onChange={(e) =>
                                handleReproChange(index, "tonelaje", Number(e.target.value))
                              }
                              className="w-full text-xs font-bold text-slate-800 p-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:border-[#461D77] font-mono tabular-nums"
                              placeholder="Ej. 20500"
                            />
                          </div>
                          {repro.fecha || repro.tonelaje > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveRepro(index)}
                              className="mt-4 text-rose-600 hover:bg-rose-50 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border-y border-slate-100">
                  {/* 1. Inicio Mes */}
                  <div className="py-2.5 flex justify-between items-baseline gap-4">
                    <span className="text-xs text-slate-500 font-medium">
                      Producción {currentMonthName} LCE · Inicio mes
                    </span>
                    <span className="text-base font-black text-slate-800 font-mono tabular-nums shrink-0">
                      {numFmt(lceConfig.inicioMes, 0)}{" "}
                      <span className="text-xs text-slate-400 font-sans font-normal">t</span>
                    </span>
                  </div>

                  {/* 2. Reprogramaciones list */}
                  {lceConfig.reprogramaciones &&
                    lceConfig.reprogramaciones
                      .filter((r) => r.fecha && r.tonelaje > 0)
                      .map((repro, idx) => (
                        <div
                          key={idx}
                          className="py-2.5 flex justify-between items-baseline gap-4"
                        >
                          <span className="text-xs text-slate-500 font-medium">
                            Reprogramación {currentMonthName} ·{" "}
                            <span className="font-mono tabular-nums">
                              {formatDateDMY(repro.fecha)}
                            </span>
                          </span>
                          <span className="text-base font-black text-slate-800 font-mono tabular-nums shrink-0">
                            {numFmt(repro.tonelaje, 0)}{" "}
                            <span className="text-xs text-slate-400 font-sans font-normal">t</span>
                          </span>
                        </div>
                      ))}

                  {/* 3. Actual SDA */}
                  <div className="py-2.5 flex justify-between items-baseline gap-4">
                    <span className="text-xs font-bold text-[#461D77]">
                      Actual SdA
                    </span>
                    <span className="text-base font-black text-[#461D77] font-mono tabular-nums shrink-0">
                      {numFmt(summary.lceActualTotal, 2)}{" "}
                      <span className="text-xs text-slate-400 font-sans font-normal">t</span>
                    </span>
                  </div>

                  {/* 4. Programado */}
                  <div className="py-2.5 flex justify-between items-baseline gap-4">
                    <span className="text-xs text-slate-500 font-medium">
                      Programado Vigente
                    </span>
                    <span className="text-base font-black text-slate-800 font-mono tabular-nums shrink-0">
                      {numFmt(summary.lceProgramadoTotal, 0)}{" "}
                      <span className="text-xs text-slate-400 font-sans font-normal">t</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Donut Chart Gauge */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center p-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full rotate-270">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#461D77"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 40 * (1 - Math.min(100, summary.lceCumplimiento) / 100)
                    }`}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col justify-center items-center">
                  <span className="text-2xl font-black font-mono tabular-nums text-slate-800 leading-none select-none tracking-tight">
                    {numFmt(summary.lceCumplimiento, 0)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                    Meta LCE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* POZAS MONITOR & FOOTER STATUS */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#461D77]" />
              <span>Nivel Pozas PQLC</span>
            </span>
            <span
              className={`text-xs font-bold font-mono tabular-nums px-3 py-0.5 rounded-full border ${
                currentLog.nivelPozasPqlc === "S/D"
                  ? "bg-slate-50 text-slate-500 border-slate-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {currentLog.nivelPozasPqlc}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
