
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, LabelList
} from 'recharts';
import {
  Package, Truck, Target, MapPin, TrendingDown, TrendingUp,
  ClipboardEdit, AlertCircle, Save, Loader2, Sparkles
} from 'lucide-react';
import { formatDateToCL, formatNumberWithDecimals } from '../utils/dataProcessor';
import { db } from '../services/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

interface ProductDetailSectionProps {
  product: string;
  data: any[];
  index: number;
  total: number;
  date: string;
}

const MetricCard = ({ icon, label, value, diff, unit = '', isPerc = false }: any) => {
  const isPositive = diff > 0;
  const colorClass = isPerc 
    ? (value === '100.0%' ? 'text-ionizado' : 'text-nucleo')
    : (isPositive ? 'text-tecnico' : 'text-nucleo');

  return (
    <div className="bg-white p-5 rounded-[1.2rem] shadow-sm flex flex-col space-y-3 relative overflow-hidden group transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-slate-50 rounded-lg text-violeta/70 group-hover:text-ionizado transition-colors">{icon}</div>
        {diff !== undefined && (
          <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-tecnico/10 text-tecnico' : 'bg-nucleo/10 text-nucleo'} uppercase tracking-tighter`}>
            {isPositive ? '+' : ''}{isPerc ? diff.toFixed(1) : formatNumberWithDecimals(diff, 2)} {isPerc ? '%' : unit}
          </div>
        )}
      </div>
      <div>
        <p className="text-[9px] font-black text-violeta/50 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${colorClass} tracking-tighter leading-none`}>{value}</p>
      </div>
    </div>
  );
};

const IndicatorRow = ({ label, value, color = 'text-nucleo' }: any) => (
  <div className="flex justify-between items-center py-2 border-b border-calido/50 last:border-0 hover:bg-slate-50/50 px-1 rounded-md transition-colors">
    <span className="text-[10px] font-black text-violeta/60 uppercase tracking-widest">{label}</span>
    <span className={`text-xs font-black ${color} tracking-tight uppercase`}>{value}</span>
  </div>
);

export const ProductDetailSection: React.FC<ProductDetailSectionProps> = ({ 
  product, data, index, total, date 
}) => {
  const storageKey = `sqm_justification_${date}_${product}`;
  const [justification, setJustification] = useState(() => localStorage.getItem(storageKey) || "");

  const initialJustificationRef = useRef(justification);

  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const [globalAiSettings, setGlobalAiSettings] = useState({
    activeAi: 'gemini' as 'gemini' | 'glm',
    enableGemini: true,
    enableGlm: true,
    enableJustificationRefinement: true
  });
  const [userAiEnabled, setUserAiEnabled] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        return parsedUser.enableAi !== false;
      }
    } catch (e) {
      console.error('Error parsing sqm_current_user for AI state:', e);
    }
    return true; // Safe fallback
  });

  useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        const docRef = doc(db, 'system_config', 'ai_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGlobalAiSettings({
            activeAi: data.activeAi || 'gemini',
            enableGemini: data.enableGemini !== false,
            enableGlm: data.enableGlm !== false,
            enableJustificationRefinement: data.enableJustificationRefinement !== false
          });
        }

        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const userDocRef = doc(db, 'users', parsedUser.userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserAiEnabled(userData.enableAi !== false);
          }
        }
      } catch (err) {
        console.error('Error fetching AI settings in ProductDetail:', err);
      }
    };
    fetchAiSettings();
  }, []);

  const handleRefineWithAI = async (textToRefine?: string) => {
    const targetText = textToRefine !== undefined ? textToRefine : justification;
    if (!targetText.trim()) return;

    try {
      // 1. Fetch latest global AI config from Firestore
      const docRef = doc(db, 'system_config', 'ai_settings');
      const docSnap = await getDoc(docRef);
      let isGlobalRefinementEnabled = globalAiSettings.enableJustificationRefinement;
      let activeModel = globalAiSettings.activeAi;

      if (docSnap.exists()) {
        const data = docSnap.data();
        isGlobalRefinementEnabled = data.enableJustificationRefinement !== false;
        activeModel = data.activeAi || 'gemini';
        
        // Sync local React state
        setGlobalAiSettings({
          activeAi: activeModel,
          enableGemini: data.enableGemini !== false,
          enableGlm: data.enableGlm !== false,
          enableJustificationRefinement: isGlobalRefinementEnabled
        });
      }

      // 2. Fetch latest user config from Firestore
      let isUserEnabled = userAiEnabled;
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const userDocRef = doc(db, 'users', parsedUser.userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          isUserEnabled = userData.enableAi !== false;
          
          // Sync local React state
          setUserAiEnabled(isUserEnabled);
        }
      }

      // 3. Enforce permission check before showing loading status or calling API
      if (!isGlobalRefinementEnabled || !isUserEnabled) {
        console.log("AI refinement bypassed because it is disabled globally or for this user.");
        return;
      }

      // If both are enabled, proceed with refining status and API call
      setIsRefining(true);
      setRefineError(null);

      const response = await fetch("/api/refine-justification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: targetText,
          product,
          stats,
          model: activeModel
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.refined) {
          const refinedVal = result.refined;
          setJustification(refinedVal);
          initialJustificationRef.current = refinedVal;
          localStorage.setItem(storageKey, refinedVal);
          await deleteStaleImage();
          
          // Log activity if current user is saved
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            const { logActivity } = await import('../services/firebase');
            await logActivity(
              parsedUser,
              'Refinó Justificación con IA',
              `Utilizó la IA (${activeModel.toUpperCase()}) para optimizar la justificación técnica de ${product} en la jornada ${formatDateToCL(date)}.`
            );
          }
        } else {
          setRefineError("No se obtuvo una respuesta válida del motor de IA.");
        }
      } else {
        const errData = await response.json();
        setRefineError(errData.error || "Error al procesar la reescritura con IA.");
      }
    } catch (err) {
      console.error(err);
      setRefineError("Error de conexión al intentar optimizar.");
    } finally {
      setIsRefining(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(storageKey, justification);
    // Dispatch custom event to notify other instances of ProductDetailSection
    window.dispatchEvent(new CustomEvent('sqm-justification-updated', {
      detail: { date, product, value: justification }
    }));
  }, [justification, storageKey, date, product]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ date: string; product: string; value: string }>;
      if (customEvent.detail && customEvent.detail.date === date && customEvent.detail.product === product) {
        if (customEvent.detail.value !== justification) {
          setJustification(customEvent.detail.value);
          initialJustificationRef.current = customEvent.detail.value;
        }
      }
    };
    window.addEventListener('sqm-justification-updated', handleUpdate);
    return () => window.removeEventListener('sqm-justification-updated', handleUpdate);
  }, [date, product, justification]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || "";
    setJustification(saved);
    initialJustificationRef.current = saved;
  }, [storageKey]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJustification(e.target.value);
  };

  const deleteStaleImage = async () => {
    try {
      const prodId = `auto_prod_${product.replace(/\s+/g, '_')}_${date}`;
      const imgDocRef = doc(db, 'gallery_images', prodId);
      await deleteDoc(imgDocRef);
    } catch (err) {
      console.error('Error deleting stale image:', err);
    }
  };

  const handleBlur = async () => {
    const textToRefine = justification;
    if (textToRefine !== initialJustificationRef.current) {
      initialJustificationRef.current = textToRefine;
      await deleteStaleImage();
      try {
        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const { logActivity } = await import('../services/firebase');
          await logActivity(
            parsedUser,
            'Editó Justificación',
            `Modificó la justificación de desempeño del producto ${product} para la jornada ${formatDateToCL(date)}.`
          );
        }
      } catch (err) {
        console.error('Error logging justification edit:', err);
      }

      // Automatically trigger AI refinement if text is not empty (permissions are enforced in handleRefineWithAI)
      if (textToRefine.trim()) {
        await handleRefineWithAI(textToRefine);
      }
    }
  };

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const tonProg = data.reduce((a, b) => a + (Number(b.Ton_Prog) || 0), 0);
    const tonReal = data.reduce((a, b) => a + (Number(b.Ton_Real) || 0), 0);
    const eqProg = data.reduce((a, b) => a + (Number(b.Eq_Prog) || 0), 0);
    const eqReal = data.reduce((a, b) => a + (Number(b.Eq_Real) || 0), 0);
    const compliance = tonProg > 0 ? (tonReal / tonProg) * 100 : 0;
    const isTonDeviation = compliance < 85;
    const regAvg = data.length > 0 ? data.reduce((a, b) => a + (Number(b.Regulacion_Real) || 0), 0) / data.length : 0;

    const faenaRealHoursList = data.map(d => Number(d.faenaRealHours) || 0).filter(v => v > 0);
    const faenaMetaHoursList = data.map(d => Number(d.faenaMetaHours) || 0).filter(v => v > 0);

    const avgFaenaReal = faenaRealHoursList.length > 0 ? (faenaRealHoursList.reduce((a, b) => a + b, 0) / faenaRealHoursList.length) : 0;
    const avgFaenaMeta = faenaMetaHoursList.length > 0 ? (faenaMetaHoursList.reduce((a, b) => a + b, 0) / faenaMetaHoursList.length) : 0;
    const isTimeDeviation = avgFaenaReal > 0 && avgFaenaMeta > 0 && (avgFaenaReal - avgFaenaMeta) >= (10 / 60);

    const hasAnyDeviation = isTonDeviation || isTimeDeviation;

    const destinations: Record<string, number> = {};
    data.forEach(d => {
      const dest = String(d.Destino || 'S/D');
      destinations[dest] = (destinations[dest] || 0) + 1;
    });
    const mainDestEntry = Object.entries(destinations).sort((a, b) => b[1] - a[1])[0];

    return {
      tonProg, tonReal, tonDiff: tonReal - tonProg,
      eqProg, eqReal, eqDiff: eqReal - eqProg,
      compliance,
      hasAnyDeviation,
      isTonDeviation,
      isTimeDeviation,
      totalReg: regAvg,
      avgLoad: eqReal > 0 ? tonReal / eqReal : 0,
      avgFaenaReal,
      avgFaenaMeta,
      mainDest: mainDestEntry ? mainDestEntry[0] : 'S/D'
    };
  }, [data]);

  const formatHoursToTime = (hours: number): string => {
    if (isNaN(hours) || hours <= 0) return "0:00";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  if (!stats) return null;
  const { isTimeDeviation, isTonDeviation, hasAnyDeviation } = stats;

  const chartData = [
    { name: 'Tonelaje', Programado: stats.tonProg, Real: stats.tonReal },
    { name: 'Equipos', Programado: stats.eqProg, Real: stats.eqReal }
  ];

  return (
    <div className="w-full bg-white pb-8 print:block">
      <div className="flex justify-between items-end border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <p className="text-[8px] font-black text-ionizado uppercase tracking-[0.3em]">Auditoría de Desempeño</p>
          <h2 className="text-4xl font-[900] text-nucleo tracking-tighter leading-tight uppercase">{product}</h2>
        </div>
        <div className="bg-black text-white px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase mb-1 no-print">Ítem {index} / {total}</div>
      </div>


      {/* Centered compliance status pill removed as per user request */}


      <div className="grid grid-cols-4 gap-3">
        <MetricCard icon={<Package className="w-4 h-4" />} label="Carga Real" value={`${formatNumberWithDecimals(stats.tonReal, 2)} Ton`} diff={stats.tonDiff} unit="vs Prog" />
        <MetricCard icon={<Truck className="w-4 h-4" />} label="Flota Real" value={`${stats.eqReal} EQ`} diff={stats.eqDiff} unit="vs Prog" />
        <MetricCard icon={<Target className="w-4 h-4" />} label="Cumplimiento" value={`${stats.compliance.toFixed(1)}%`} diff={stats.compliance - 100} isPerc />
        <div className="bg-white p-5 rounded-[1.2rem] shadow-sm flex flex-col space-y-3">
          <div className="flex items-center gap-2 text-violeta/70"><MapPin className="w-4 h-4" /><span className="text-[9px] font-black uppercase tracking-wider">Destino Crítico</span></div>
          <p className="text-lg font-black text-nucleo leading-tight truncate uppercase">{stats.mainDest}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 pt-2">
        <div className="col-span-2 bg-white p-6 rounded-[1.5rem] shadow-sm flex flex-col space-y-4">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={15} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} />
                <YAxis hide />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '13px', fontWeight: '900' }} iconType="square" iconSize={8} />
                <Bar isAnimationActive={false} dataKey="Programado" fill="#461D77" radius={[6, 6, 6, 6]} barSize={40}>
                  <LabelList dataKey="Programado" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#461D77', fontSize: '10px', fontWeight: '900' }} offset={8} />
                </Bar>
                <Bar isAnimationActive={false} dataKey="Real" fill="#3FAA88" radius={[6, 6, 6, 6]} barSize={40}>
                  <LabelList dataKey="Real" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#3FAA88', fontSize: '10px', fontWeight: '900' }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm flex flex-col justify-center space-y-4">
          <IndicatorRow label="Regulaciones" value={`${Math.round(stats.totalReg)}%`} />
          <IndicatorRow label="Factor Carga" value={`${stats.avgLoad.toFixed(1)} T/EQ`} />
          <div className="h-px bg-calido w-full" />
          <IndicatorRow label="Tpo. Real" value={formatHoursToTime(stats.avgFaenaReal)} color={isTimeDeviation ? 'text-rose-600' : 'text-tecnico'} />
          <IndicatorRow label="Tpo. Meta" value={formatHoursToTime(stats.avgFaenaMeta)} />
        </div>
      </div>

      {/* Sección de Justificación y Observaciones Técnicas */}
      {hasAnyDeviation && (
        <div className="mt-6 bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100/80 flex flex-col space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-4 h-4 text-violeta/80" />
              <span className="text-[11px] font-black text-violeta/80 uppercase tracking-widest">
                Justificación de Desempeño
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isTonDeviation && (
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 uppercase tracking-tight">
                  ⚠️ Desviación Tonelaje
                </span>
              )}
              {isTimeDeviation && (
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 uppercase tracking-tight">
                  ⚠️ Desviación Tiempo
                </span>
              )}
              {!hasAnyDeviation && (
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-tight">
                  ✓ Operación en Rango Meta (Sin Desviaciones)
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <textarea
              value={justification}
              onChange={handleTextChange}
              onBlur={handleBlur}
              className="w-full h-[110px] p-4 text-xs font-semibold text-slate-800 bg-white rounded-xl border border-slate-200/80 shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-violeta/20 focus:border-violeta transition-all leading-relaxed"
              placeholder={
                hasAnyDeviation
                  ? "Escriba aquí la justificación técnica de la desviación de tonelaje/tiempo detectada..."
                  : "Escriba observaciones técnicas adicionales opcionales de la jornada o deje en blanco..."
              }
            />
            {isRefining && (
              <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-violeta font-black text-[10px] uppercase tracking-wider">
                  <Loader2 className="w-4 h-4 animate-spin text-violeta" />
                  Refinando redacción con IA...
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
            {refineError && (
              <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-black">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{refineError}</span>
              </div>
            )}
            {!refineError && (
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                * El texto se guarda automáticamente al hacer clic fuera del cuadro.
              </div>
            )}
            
            {globalAiSettings.enableJustificationRefinement && userAiEnabled && (
              <button
                onClick={() => handleRefineWithAI()}
                disabled={isRefining || !justification.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-violeta hover:bg-violeta/90 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimizar con IA</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Versión imprimible estática de la justificación */}
      {justification.trim() && (
        <div className="hidden print:block mt-6 p-5 border border-slate-200 rounded-xl bg-slate-50">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Justificación Técnica Registrada:</p>
          <p className="text-xs text-slate-800 leading-relaxed font-semibold italic">"{justification}"</p>
        </div>
      )}

      <div className="flex justify-end items-center no-print no-pdf pt-4">
        <div className="text-[8px] font-black text-violeta/60 uppercase tracking-widest">Persistencia Local: {date} • {product}</div>
      </div>
    </div>
  );
};

export default ProductDetailSection;
