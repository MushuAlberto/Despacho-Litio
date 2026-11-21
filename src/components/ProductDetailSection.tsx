
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, LabelList, LineChart, Line, Tooltip
} from 'recharts';
import {
  Package, Truck, Target, MapPin,
  ClipboardEdit, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { formatDateToCL, formatNumberWithDecimals } from '../utils/dataProcessor';
import { db, isQuotaExceededError } from '../services/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { authenticatedFetch } from '../auth/authenticatedFetch';

// Shared module-level cache to prevent redundant Firestore reads across 15+ product sections
let cachedGlobalAiSettings: {
  activeAi: 'gemini' | 'glm';
  enableGemini: boolean;
  enableGlm: boolean;
  enableJustificationRefinement: boolean;
} | null = null;
let cachedUserAiEnabledMap: Record<string, boolean> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

interface ProductDetailSectionProps {
  product: string;
  data: any[];
  index: number;
  total: number;
  date: string;
  allData?: any[];
}

const MetricCard = ({ icon, label, value, diff, unit = '', isPerc = false }: any) => {
  const isPositive = diff > 0;
  const colorClass = isPerc
    ? (value === '100.0%' ? 'text-[#15803D]' : 'text-[#461D77]')
    : 'text-[#1C1917]';

  return (
    <div className="p-4 md:p-5 flex flex-col justify-between space-y-2.5 bg-[#FFFFFF]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#78716C]">
          {icon}
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</p>
        </div>
        {diff !== undefined && (
          <span
            className={`text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md border ${
              isPositive
                ? 'bg-[#F0FDF4] text-[#15803D] border-[#15803D]/25'
                : 'bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/25'
            }`}
          >
            {isPositive ? '+' : ''}{isPerc ? diff.toFixed(1) : formatNumberWithDecimals(diff, 2)} {isPerc ? '%' : unit}
          </span>
        )}
      </div>
      <p className={`text-2xl font-mono font-bold tabular-nums ${colorClass} tracking-tight leading-none`}>{value}</p>
    </div>
  );
};

const IndicatorRow = ({ label, value, color = 'text-[#1C1917]' }: any) => (
  <div className="flex justify-between items-center py-2.5 border-b border-[#E2DFD7] last:border-0">
    <span className="text-[11px] font-mono font-semibold text-[#78716C] uppercase tracking-wider">{label}</span>
    <span className={`text-sm font-mono font-bold tabular-nums ${color} uppercase`}>{value}</span>
  </div>
);

const ProductTrendChart = ({ product, date, allData }: { product: string; date: string; allData: any[] }) => {
  const trendData = useMemo(() => {
    if (!allData || allData.length === 0 || !date) return [];

    const uniqueDates = [...new Set(allData.map((r: any) => r.Fecha as string))]
      .filter(Boolean)
      .sort();

    const currentIndex = uniqueDates.indexOf(date);
    if (currentIndex === -1) return [];

    const last7Dates = uniqueDates.slice(Math.max(0, currentIndex - 6), currentIndex + 1);

    const getComplianceForDate = (d: string) => {
      const dayRows = allData.filter((r: any) => r.Fecha === d && r.Producto === product);
      const tonProg = dayRows.reduce((sum: number, r: any) => sum + (Number(r.Ton_Prog) || 0), 0);
      const tonReal = dayRows.reduce((sum: number, r: any) => sum + (Number(r.Ton_Real) || 0), 0);
      return tonProg > 0 ? (tonReal / tonProg) * 100 : 0;
    };

    return last7Dates.map(d => {
      const compliance = getComplianceForDate(d);
      let shortLabel = d;
      try {
        const parts = d.split('-');
        if (parts.length === 3) {
          shortLabel = `${parts[2]}/${parts[1]}`;
        }
      } catch (e) {}

      return {
        date: d,
        label: shortLabel,
        'Cumplimiento': Number(compliance.toFixed(1))
      };
    });
  }, [product, date, allData]);

  if (trendData.length === 0) return null;

  return (
    <div className="mt-5 p-4 bg-[#F7F6F2] border border-[#E2DFD7] rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono font-semibold text-[#78716C] uppercase tracking-wider">Tendencia · Últimas 7 Jornadas</p>
          <h4 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">Evolución de Cumplimiento</h4>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-[#461D77] uppercase tracking-wider">
          <span className="w-2 h-2 rounded-sm bg-[#461D77]" />
          Cumplimiento
        </span>
      </div>

      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 5, right: 15, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DFD7" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 700, fill: '#78716C' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 700, fill: '#78716C' }}
              domain={[0, 110]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2DFD7', fontSize: '11px', fontWeight: '600' }}
              formatter={(value: any, name: string) => [`${value}%`, name]}
            />
            <Line
              type="monotone"
              dataKey="Cumplimiento"
              stroke="#461D77"
              strokeWidth={2}
              dot={{ r: 3, fill: '#461D77', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ProductDetailSection: React.FC<ProductDetailSectionProps> = ({ 
  product, data, index, total, date, allData = []
}) => {
  const storageKey = `sqm_justification_${date}_${product}`;
  const [justification, setJustification] = useState(() => localStorage.getItem(storageKey) || "");

  const initialJustificationRef = useRef(justification);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantStep, setAssistantStep] = useState<1 | 2>(1);
  const [causeText, setCauseText] = useState("");
  const [actionText, setActionText] = useState("");
  const [skipAssistantOnce, setSkipAssistantOnce] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // 1. If recently cached, use cached values immediately without hitting Firestore
      const now = Date.now();
      const savedUser = localStorage.getItem('sqm_current_user');
      const userId = savedUser ? (JSON.parse(savedUser)?.userId || '') : '';

      if (cachedGlobalAiSettings && (now - lastFetchTime < CACHE_TTL_MS)) {
        setGlobalAiSettings(cachedGlobalAiSettings);
        if (userId && cachedUserAiEnabledMap[userId] !== undefined) {
          setUserAiEnabled(cachedUserAiEnabledMap[userId]);
        }
        return;
      }

      try {
        const docRef = doc(db, 'system_config', 'ai_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const newSettings = {
            activeAi: (data.activeAi || 'gemini') as 'gemini' | 'glm',
            enableGemini: data.enableGemini !== false,
            enableGlm: data.enableGlm !== false,
            enableJustificationRefinement: data.enableJustificationRefinement !== false
          };
          cachedGlobalAiSettings = newSettings;
          lastFetchTime = now;
          setGlobalAiSettings(newSettings);
        }

        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const enabled = userData.enableAi !== false;
            cachedUserAiEnabledMap[userId] = enabled;
            setUserAiEnabled(enabled);
          }
        }
      } catch (err) {
        if (isQuotaExceededError(err)) {
          // If Firestore quota is reached, keep default enabled state and prevent further calls
          lastFetchTime = now; // Prevent repeating calls on error
          return;
        }
        console.error('Error fetching AI settings in ProductDetail:', err);
      }
    };
    fetchAiSettings();
  }, []);

  const handleRefineWithAI = async (textToRefine?: string) => {
    const targetText = textToRefine !== undefined ? textToRefine : justification;
    if (!targetText.trim()) return;

    try {
      let isGlobalRefinementEnabled = globalAiSettings.enableJustificationRefinement;
      let activeModel = globalAiSettings.activeAi;

      // Try fetching latest global AI config if not throttled
      try {
        const docRef = doc(db, 'system_config', 'ai_settings');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          isGlobalRefinementEnabled = data.enableJustificationRefinement !== false;
          activeModel = data.activeAi || 'gemini';
          
          setGlobalAiSettings({
            activeAi: activeModel,
            enableGemini: data.enableGemini !== false,
            enableGlm: data.enableGlm !== false,
            enableJustificationRefinement: isGlobalRefinementEnabled
          });
        }
      } catch (quotaErr) {
        if (!isQuotaExceededError(quotaErr)) {
          console.warn('Could not refresh AI settings from cloud; using current settings:', quotaErr);
        }
      }

      // Check user setting
      let isUserEnabled = userAiEnabled;
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          isUserEnabled = parsedUser.enableAi !== false;
        } catch {
          // keep current
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

      const response = await authenticatedFetch("/api/refine-justification", {
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

  // Auto-resize justification textarea to fit its content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 4}px`; // Add small padding/offset to prevent minor scrollbars
    }
  }, [justification]);

  const saveAndRefineJustification = async (newVal: string) => {
    setJustification(newVal);
    localStorage.setItem(storageKey, newVal);
    window.dispatchEvent(new CustomEvent('sqm-justification-updated', {
      detail: { date, product, value: newVal }
    }));
    
    if (newVal !== initialJustificationRef.current) {
      initialJustificationRef.current = newVal;
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

      // Automatically trigger AI refinement if text is not empty
      if (newVal.trim()) {
        await handleRefineWithAI(newVal);
      }
    }
  };

  const handleTextareaClick = () => {
    const currentText = justification.trim();
    let initialCause = "";
    let initialAction = "";
    
    if (currentText) {
      const causeRegex = /Causa:\s*([\s\S]*?)(?=\.?\s*Acción requerida:|$)/i;
      const actionRegex = /Acción requerida:\s*([\s\S]*?)(?=\.?\s*$)/i;
      
      const causeMatch = currentText.match(causeRegex);
      const actionMatch = currentText.match(actionRegex);
      
      if (causeMatch) {
        initialCause = causeMatch[1].trim();
      }
      if (actionMatch) {
        initialAction = actionMatch[1].trim();
      }
      
      if (!causeMatch && !actionMatch) {
        initialCause = currentText;
      }
    }
    
    setCauseText(initialCause);
    setActionText(initialAction);
    setAssistantStep(1);
    setIsAssistantOpen(true);
  };

  const closeAssistantAndFocus = () => {
    setIsAssistantOpen(false);
    setSkipAssistantOnce(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJustification(e.target.value);
  };

  const deleteStaleImage = async () => {
    try {
      const prodId = `auto_prod_${product.replace(/[\s/]+/g, '_')}_${date}`;
      const imgDocRef = doc(db, 'gallery_images', prodId);
      await deleteDoc(imgDocRef);
    } catch (err) {
      console.error('Error deleting stale image:', err);
    }
  };

  const handleBlur = async () => {
    await saveAndRefineJustification(justification);
  };

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const tonProg = data.reduce((a, b) => a + (Number(b.Ton_Prog) || 0), 0);
    const tonReal = data.reduce((a, b) => a + (Number(b.Ton_Real) || 0), 0);
    const eqProg = data.reduce((a, b) => a + (Number(b.Eq_Prog) || 0), 0);
    const eqReal = data.reduce((a, b) => a + (Number(b.Eq_Real) || 0), 0);
    const compliance = tonProg > 0 ? (tonReal / tonProg) * 100 : 0;
    const isTonDeviation = compliance < 90;
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
    <div className="w-full bg-[#FFFFFF] pb-6 space-y-5 print:block">
      <div className="flex justify-between items-end border-b border-[#E2DFD7] pb-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono font-semibold text-[#78716C] uppercase tracking-wider">Auditoría de Desempeño</p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C1917] tracking-[-0.02em] leading-tight uppercase">{product}</h2>
        </div>
        <div className="bg-[#F7F6F2] border border-[#E2DFD7] text-[#57534E] px-3 py-1 rounded-md text-[10px] font-mono font-semibold tracking-wider uppercase mb-1 no-print tabular-nums">
          Ítem {index} / {total}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#E2DFD7] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-[#E2DFD7] overflow-hidden">
        <MetricCard icon={<Package className="w-4 h-4 text-[#461D77]" />} label="Carga Real" value={`${formatNumberWithDecimals(stats.tonReal, 2)} Ton`} diff={stats.tonDiff} unit="vs Prog" />
        <MetricCard icon={<Truck className="w-4 h-4 text-[#461D77]" />} label="Flota Real" value={`${stats.eqReal} EQ`} diff={stats.eqDiff} unit="vs Prog" />
        <MetricCard icon={<Target className="w-4 h-4 text-[#461D77]" />} label="Cumplimiento" value={`${stats.compliance.toFixed(1)}%`} diff={stats.compliance - 100} isPerc />
        <div className="p-4 md:p-5 flex flex-col justify-between space-y-2.5 bg-[#FFFFFF]">
          <div className="flex items-center gap-2 text-[#78716C]">
            <MapPin className="w-4 h-4 text-[#461D77]" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">Destino Crítico</span>
          </div>
          <p className="text-lg font-bold text-[#1C1917] leading-tight truncate uppercase">{stats.mainDest}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 border border-[#E2DFD7] rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-[#E2DFD7] bg-[#FFFFFF]">
        <div className="lg:col-span-2 p-5 flex flex-col">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={15} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFECE6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#57534E' }} />
                <YAxis hide />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '12px', fontWeight: '700' }} iconType="square" iconSize={8} />
                <Bar isAnimationActive={false} dataKey="Programado" fill="#461D77" radius={[4, 4, 0, 0]} barSize={40}>
                  <LabelList dataKey="Programado" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#461D77', fontSize: '10px', fontWeight: '700' }} offset={8} />
                </Bar>
                <Bar isAnimationActive={false} dataKey="Real" fill="#3FAA88" radius={[4, 4, 0, 0]} barSize={40}>
                  <LabelList dataKey="Real" position="top" formatter={(v: any) => typeof v === 'number' && v > 200 ? formatNumberWithDecimals(v, 2) : v.toLocaleString()} style={{ fill: '#15803D', fontSize: '10px', fontWeight: '700' }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-5 flex flex-col justify-center bg-[#F7F6F2]/50">
          <IndicatorRow label="Regulaciones" value={`${Math.round(stats.totalReg)}%`} />
          <IndicatorRow label="Factor Carga" value={`${stats.avgLoad.toFixed(1)} T/EQ`} />
          <IndicatorRow label="Tpo. Real" value={formatHoursToTime(stats.avgFaenaReal)} color={isTimeDeviation ? 'text-[#B91C1C]' : 'text-[#15803D]'} />
          <IndicatorRow label="Tpo. Meta" value={formatHoursToTime(stats.avgFaenaMeta)} />
        </div>
      </div>

      {/* Sección de Justificación y Observaciones Técnicas */}
      {hasAnyDeviation && (
        <div className="bg-[#F7F6F2] p-5 rounded-lg border border-[#E2DFD7] flex flex-col space-y-3.5 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-4 h-4 text-[#461D77]" />
              <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Justificación de Desempeño
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isTonDeviation && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FFFBEB] border border-[#B45309]/25 text-[#B45309] uppercase">
                  Desviación Tonelaje
                </span>
              )}
              {isTimeDeviation && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FEF2F2] border border-[#B91C1C]/25 text-[#B91C1C] uppercase">
                  Desviación Tiempo
                </span>
              )}
              {!hasAnyDeviation && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#15803D]/25 text-[#15803D] uppercase">
                  En Rango Meta
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={justification}
              onChange={handleTextChange}
              onClick={() => {
                if (!skipAssistantOnce) {
                  handleTextareaClick();
                }
              }}
              onFocus={() => {
                if (!skipAssistantOnce) {
                  handleTextareaClick();
                }
              }}
              onBlur={() => {
                handleBlur();
                setSkipAssistantOnce(false);
              }}
              style={{ overflow: 'hidden' }}
              className="w-full min-h-[110px] p-3.5 text-xs font-medium text-[#1C1917] bg-[#FFFFFF] rounded-md border border-[#E2DFD7] resize-none focus:outline-none focus:border-[#461D77] transition-colors duration-150 leading-relaxed cursor-pointer"
              placeholder={
                hasAnyDeviation
                  ? 'Escribe aquí la justificación técnica de la desviación detectada...'
                  : 'Escribe observaciones técnicas adicionales opcionales...'
              }
            />
            {isRefining && (
              <div className="absolute inset-0 bg-[#FFFFFF]/85 rounded-md flex items-center justify-center">
                <div className="flex items-center gap-2 text-[#461D77] font-semibold text-xs uppercase tracking-wider">
                  <Loader2 className="w-4 h-4 animate-spin text-[#461D77]" />
                  Refinando redacción...
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {refineError ? (
              <div className="flex items-center gap-1.5 text-[#B91C1C] text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{refineError}</span>
              </div>
            ) : (
              <div className="text-[11px] text-[#78716C]">
                El texto se guarda automáticamente al salir del cuadro.
              </div>
            )}

            {globalAiSettings.enableJustificationRefinement && userAiEnabled && (
              <button
                onClick={() => handleRefineWithAI()}
                disabled={isRefining || !justification.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#461D77] hover:bg-[#36155E] disabled:bg-[#EFECE6] text-white disabled:text-[#78716C] rounded-md text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
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
        <div className="hidden print:block mt-6 p-4 border border-[#E2DFD7] rounded-md bg-[#F7F6F2]">
          <p className="text-[10px] font-mono font-semibold text-[#57534E] uppercase tracking-wider mb-1.5">Justificación Técnica Registrada:</p>
          <p className="text-xs text-[#1C1917] leading-relaxed font-medium whitespace-pre-wrap break-words">"{justification}"</p>
        </div>
      )}

      {/* Mini-gráfico de tendencia - Siempre visible si hay datos históricos */}
      <ProductTrendChart product={product} date={date} allData={allData} />

      {/* Asistente guiado de Justificación */}
      {isAssistantOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[#1C1917]/60 no-print">
          <div className="bg-[#FFFFFF] w-full max-w-lg rounded-lg shadow-sm border border-[#E2DFD7] overflow-hidden flex flex-col">
            <div className="bg-[#F7F6F2] px-6 py-4 border-b border-[#E2DFD7] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-2">
                  <ClipboardEdit className="w-4 h-4 text-[#461D77]" />
                  Asistente de Justificación
                </h3>
                <p className="text-[11px] font-mono text-[#78716C] uppercase mt-0.5">{product}</p>
              </div>
              <button
                onClick={closeAssistantAndFocus}
                className="p-1.5 rounded-md hover:bg-[#EFECE6] text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
                title="Cerrar asistente"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-[#FFFFFF] px-6 py-2.5 border-b border-[#E2DFD7] flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase text-[#57534E] tracking-wider">
                Paso {assistantStep} de 2 · {assistantStep === 1 ? 'Causa' : 'Acción Correctiva'}
              </span>
              <div className="flex gap-1.5">
                <div className={`w-8 h-1 rounded-sm transition-colors ${assistantStep >= 1 ? 'bg-[#461D77]' : 'bg-[#E2DFD7]'}`} />
                <div className={`w-8 h-1 rounded-sm transition-colors ${assistantStep >= 2 ? 'bg-[#461D77]' : 'bg-[#E2DFD7]'}`} />
              </div>
            </div>

            <div className="p-6 space-y-4 flex-1">
              {assistantStep === 1 ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                    Causa
                  </label>
                  <textarea
                    className="w-full h-[120px] p-3.5 text-xs font-medium text-[#1C1917] bg-[#F7F6F2] border border-[#E2DFD7] rounded-md focus:outline-none focus:border-[#461D77] focus:bg-[#FFFFFF] transition-colors leading-relaxed placeholder:text-[#78716C]"
                    placeholder="Ej: Falla mecánica en tolva de SQM, lo que generó detención en la faena..."
                    value={causeText}
                    onChange={(e) => setCauseText(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[11px] text-[#78716C] leading-normal">
                    Explica brevemente qué originó la diferencia de tonelaje o tiempo en la jornada.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                    Acción requerida
                  </label>
                  <textarea
                    className="w-full h-[120px] p-3.5 text-xs font-medium text-[#1C1917] bg-[#F7F6F2] border border-[#E2DFD7] rounded-md focus:outline-none focus:border-[#461D77] focus:bg-[#FFFFFF] transition-colors leading-relaxed placeholder:text-[#78716C]"
                    placeholder="Ej: Se coordinó equipo de respaldo y se ajustaron los tiempos de tránsito del turno entrante..."
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[11px] text-[#78716C] leading-normal">
                    Define qué acción se tomó o se requiere implementar para mitigar el desvío.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-[#F7F6F2] px-6 py-3.5 border-t border-[#E2DFD7] flex items-center justify-between">
              <button
                onClick={closeAssistantAndFocus}
                className="text-xs font-medium text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
              >
                Editar directamente
              </button>

              <div className="flex gap-2">
                {assistantStep === 2 && (
                  <button
                    onClick={() => setAssistantStep(1)}
                    className="px-4 py-2 border border-[#E2DFD7] bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] rounded-md text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Atrás
                  </button>
                )}

                {assistantStep === 1 ? (
                  <button
                    onClick={() => setAssistantStep(2)}
                    disabled={!causeText.trim()}
                    className="px-4 py-2 bg-[#461D77] hover:bg-[#36155E] disabled:bg-[#EFECE6] disabled:text-[#78716C] text-white rounded-md text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const combined = `Causa: ${causeText.trim()}. Acción requerida: ${actionText.trim()}.`;
                      await saveAndRefineJustification(combined);
                      setIsAssistantOpen(false);
                    }}
                    disabled={!actionText.trim()}
                    className="px-4 py-2 bg-[#461D77] hover:bg-[#36155E] disabled:bg-[#EFECE6] disabled:text-[#78716C] text-white rounded-md text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Finalizar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end items-center no-print no-pdf pt-2">
        <div className="text-[10px] font-mono text-[#78716C] uppercase tracking-wider">Persistencia Local · {date} · {product}</div>
      </div>
    </div>
  );
};

export default ProductDetailSection;
