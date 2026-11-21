/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Upload, RefreshCw, Calendar, FileSpreadsheet, CheckCircle2, AlertCircle, ShieldCheck, Download, Check, Loader2 } from "lucide-react";
import { formatFullDateSpanish } from "../data";

interface DashboardHeaderProps {
  selectedDate: string;
  allDates: string[];
  onDateChange: (date: string) => void;
  onFileUpload: (file: File) => Promise<void> | void;
  onDownloadImage: () => void;
  onResetData: () => void;
  isCustomFileLoaded: boolean;
  fileName: string | null;
  isCapturing?: boolean;
  isEditingLce: boolean;
  onToggleEditingLce: () => void;
}

export function DashboardHeader({
  selectedDate,
  allDates,
  onDateChange,
  onFileUpload,
  onDownloadImage,
  onResetData,
  isCustomFileLoaded,
  fileName,
  isCapturing = false,
  isEditingLce,
  onToggleEditingLce,
}: DashboardHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const prevCapturing = useRef(isCapturing);

  // Trigger brief celebration / success animation when capture finishes
  useEffect(() => {
    if (prevCapturing.current && !isCapturing) {
      setDownloadSuccess(true);
      const timer = setTimeout(() => {
        setDownloadSuccess(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
    prevCapturing.current = isCapturing;
  }, [isCapturing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls" && ext !== "xlsm" && ext !== "csv") {
      setUploadStatus("error");
      setStatusMessage("Formato inválido. Cargue un archivo Excel (.xlsx, .xls, .xlsm) o CSV.");
      return;
    }

    try {
      setUploadStatus("idle");
      setStatusMessage("Procesando planilla...");
      await onFileUpload(file);
      setUploadStatus("success");
      setStatusMessage(`"${file.name}" cargado correctamente.`);
      setTimeout(() => {
        setUploadStatus("idle");
      }, 5000);
    } catch (err: any) {
      setUploadStatus("error");
      setStatusMessage(err?.message || "No se pudo procesar el archivo.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <header className="w-full bg-white/90 backdrop-blur-md text-slate-800 rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/40">
      {/* Top Bar: Brand Logo & Information */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-100">
        {/* NOVANDINO Mark & Slogan */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          <div className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-[#461D77] to-[#7177EC] rounded-2xl shrink-0 shadow-md shadow-[#461D77]/20">
            <svg
              viewBox="0 0 100 100"
              className="w-6 h-6 fill-none stroke-current text-white"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M25 80 V20 L75 80 V20" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-slate-800">
                Novandino
              </span>
              <span className="text-xs font-bold text-[#461D77] bg-[#461D77]/10 px-2 py-0.5 rounded-full">
                Litio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Somos litio, somos futuro
            </p>
          </div>
        </div>

        {/* Corporate Titles */}
        <div className="text-center lg:text-right select-none">
          <h1 className="text-base lg:text-lg font-black tracking-tight text-slate-800">
            <span className="text-[#461D77]">Despacho Diario</span>
            <span className="text-slate-300 mx-2 font-normal">|</span>
            <span>Cloruro de Litio</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Subgerencia Logística Litio · Salar de Atacama
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 text-xs font-mono tabular-nums text-slate-400 mt-1">
            <span>Turno Día 07:00–19:00</span>
            <span aria-hidden="true">·</span>
            <span>Turno Noche 19:00–07:00</span>
          </div>
        </div>
      </div>

      {/* Control Area: Date Pickers & Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 pt-5">
        {/* Date Selection Control */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#461D77]" />
            <span>Fecha de Reporte (Día de Control)</span>
          </label>
          <select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-800 focus:outline-none focus:border-[#461D77] focus:bg-white transition-colors cursor-pointer"
            id="date-select-picker"
          >
            {allDates.map((date) => {
              const dObj = new Date(date + "T00:00:00");
              const day = dObj.getDate();
              const month = dObj.toLocaleString("es-ES", { month: "short" });
              return (
                <option key={date} value={date}>
                  {date} — {day} de {month}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            Visualizando: {formatFullDateSpanish(selectedDate)}
          </p>
        </div>

        {/* Excel File Upload Area */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#461D77]" />
            <span>Matriz de Datos (Excel / XLSM / CSV)</span>
          </label>

          <div className="flex gap-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex-1 flex items-center justify-center gap-2 border border-dashed rounded-xl px-3 py-2 cursor-pointer transition-colors duration-150 h-10 ${
                isDragOver
                  ? "border-[#461D77] bg-[#461D77]/5 text-[#461D77]"
                  : isCustomFileLoaded
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600"
              }`}
              id="excel-drop-zone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.xlsm,.csv"
                className="hidden"
              />

              <Upload
                className={`w-4 h-4 ${
                  isCustomFileLoaded ? "text-emerald-600" : "text-[#461D77]"
                } shrink-0`}
              />
              <span className="text-xs truncate max-w-[140px] font-semibold">
                {isCustomFileLoaded ? fileName : "Cargar Excel / CSV"}
              </span>

              {isCustomFileLoaded && (
                <span className="text-[11px] font-mono font-semibold text-emerald-600 shrink-0">
                  · Activo
                </span>
              )}
            </div>

            <button
              onClick={onToggleEditingLce}
              className={`h-10 px-4 text-xs font-bold rounded-xl transition-colors duration-150 flex items-center justify-center gap-1.5 border shrink-0 cursor-pointer ${
                isEditingLce
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                  : "bg-white text-[#461D77] border-slate-200 hover:bg-[#461D77]/5 hover:border-[#461D77]/30"
              }`}
              title={
                isEditingLce
                  ? "Guardar cambios de reprogramaciones LCE"
                  : "Habilitar reprogramaciones y edición LCE"
              }
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isEditingLce ? "Guardar" : "Editar LCE"}</span>
            </button>
          </div>

          {/* Feedback message */}
          {uploadStatus !== "idle" && (
            <div
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium ${
                uploadStatus === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {uploadStatus === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Operational Actions */}
        <div className="flex flex-col gap-1.5 justify-start">
          <label className="text-xs font-bold text-slate-600">
            Acciones Ejecutivas
          </label>
          <div className="grid grid-cols-2 gap-2.5 h-10">
            <button
              onClick={onDownloadImage}
              disabled={isCapturing}
              className={`flex items-center justify-center gap-2 transition-all duration-150 rounded-xl text-xs font-bold cursor-pointer shadow-sm ${
                downloadSuccess
                  ? "bg-emerald-600 text-white"
                  : isCapturing
                  ? "bg-[#311042] text-white opacity-85 cursor-wait"
                  : "bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white"
              }`}
              title="Descargar reporte como imagen PNG de alta resolución"
              id="btn-download-dashboard-image"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Descargado</span>
                </>
              ) : isCapturing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Capturando...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PNG</span>
                </>
              )}
            </button>
            <button
              onClick={onResetData}
              disabled={!isCustomFileLoaded}
              className={`flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-colors duration-150 border ${
                isCustomFileLoaded
                  ? "bg-white hover:bg-rose-50 text-rose-700 border-rose-200 cursor-pointer"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
              }`}
              title="Restaurar base de datos histórica de demostración"
              id="btn-reset-excel-data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restaurar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
