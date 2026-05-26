
import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, LabelList
} from 'recharts';
import {
  Package, Truck, Target, MapPin, TrendingDown, TrendingUp,
  ClipboardEdit, AlertCircle, Save, Loader2
} from 'lucide-react';

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
            {isPositive ? '+' : ''}{isPerc ? diff.toFixed(1) : Math.round(diff).toLocaleString()} {isPerc ? '%' : unit}
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

  useEffect(() => {
    localStorage.setItem(storageKey, justification);
  }, [justification, storageKey]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJustification(e.target.value);
  };

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const tonProg = Math.round(data.reduce((a, b) => a + (Number(b.Ton_Prog) || 0), 0));
    const tonReal = Math.round(data.reduce((a, b) => a + (Number(b.Ton_Real) || 0), 0));
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

      <div className="flex flex-col items-center space-y-2 pt-1">
        <div className={`px-8 py-1.5 rounded-full ${stats.compliance < 85 ? 'bg-nucleo text-white' : 'bg-ionizado/10 text-ionizado'} text-[9px] font-black tracking-[0.2em] shadow-sm uppercase`}>
          {stats.compliance < 85 ? 'Requiere Justificación Técnica' : 'Cumplimiento Operativo Exitoso'}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard icon={<Package className="w-4 h-4" />} label="Carga Real" value={`${stats.tonReal.toLocaleString()} Ton`} diff={stats.tonDiff} unit="vs Prog" />
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
                  <LabelList dataKey="Programado" position="top" formatter={(v: any) => v.toLocaleString()} style={{ fill: '#461D77', fontSize: '10px', fontWeight: '900' }} offset={8} />
                </Bar>
                <Bar isAnimationActive={false} dataKey="Real" fill="#3FAA88" radius={[6, 6, 6, 6]} barSize={40}>
                  <LabelList dataKey="Real" position="top" formatter={(v: any) => v.toLocaleString()} style={{ fill: '#3FAA88', fontSize: '10px', fontWeight: '900' }} offset={8} />
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

      {hasAnyDeviation && (
        <div className="mt-6 bg-slate-50/50 p-8 rounded-[1.8rem] space-y-6 transition-all duration-300">
        <div className="flex justify-between items-start border-b border-calido pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-violeta/70 shadow-sm">
              <ClipboardEdit className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-black text-violeta/70 uppercase tracking-widest leading-none mb-1">Registro Operativo</p>
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-black text-nucleo tracking-tighter uppercase leading-none">Justificación de Desempeño</h4>
                <div className="flex gap-1.5 ml-2">
                  {isTimeDeviation && (
                    <span className="bg-nucleo/10 text-nucleo border border-nucleo/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Desviación Tpo.</span>
                  )}
                  {isTonDeviation && (
                    <span className="bg-mineral/10 text-mineral border border-mineral/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Desviación Ton.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={justification}
            onChange={handleTextChange}
            placeholder="Escriba aquí la justificación técnica manual..."
            className="w-full h-32 bg-white border-2 border-slate-100 rounded-2xl p-5 text-sm font-medium transition-all shadow-inner resize-none no-pdf mb-2 text-slate-700 placeholder:text-slate-300 focus:ring-0"
          />

          <div className="hidden pdf-only-block bg-white border border-slate-100 rounded-2xl p-6 text-sm font-medium text-tecnico h-auto min-h-[6rem] leading-relaxed whitespace-pre-wrap">
            {justification || "No se registraron observaciones para este ítem."}
          </div>
        </div>
      </div>
    )}

      <div className="flex justify-end items-center no-print no-pdf">
        <div className="text-[8px] font-black text-violeta/60 uppercase tracking-widest">Persistencia Local: {date} • {product}</div>
      </div>
    </div>
  );
};

export default ProductDetailSection;
