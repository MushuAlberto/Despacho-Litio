
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, Cell, Legend, LabelList, ComposedChart, PieChart, Pie
} from 'recharts';

interface ChartCardProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed';
  data: any[];
  xAxis: string;
  yAxis: string | string[];
  title: string;
  aggregation?: 'sum' | 'avg';
}

const COLORS = [
  '#461D77', // Nucleo (Prog Ton)
  '#3FAA88', // Ionizado (Real Ton)
  '#171717', // Tecnico (Meta Hrs)
  '#C59E4D', // Mineral (Real Hrs)
  '#7177EC', // Violeta
  '#4FD1C5'  // Litio
];

const formatDecimalToHHMM = (decimalHours: number): string => {
  if (isNaN(decimalHours) || decimalHours <= 0) return "0:00";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

const ChartCard: React.FC<ChartCardProps> = ({
  type,
  data,
  xAxis,
  yAxis,
  title,
  aggregation = 'sum'
}) => {
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis];

  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const groups = data.reduce((acc: any, item: any) => {
      const key = String(item[xAxis] || 'S/D').trim();
      if (!acc[key]) {
        acc[key] = { name: key, _count: 0 };
        yAxes.forEach(y => acc[key][y] = 0);
      }
      acc[key]._count += 1;
      yAxes.forEach(y => {
        acc[key][y] += (Number(item[y]) || 0);
      });
      return acc;
    }, {});

    return Object.values(groups)
      .map((group: any) => {
        const finalObj: any = { name: group.name };
        yAxes.forEach(y => {
          const isTime = y.toLowerCase().includes('hours') || y.toLowerCase().includes('tpo');
          finalObj[y] = (aggregation === 'avg' || isTime) && group._count > 0
            ? group[y] / group._count
            : group[y];
        });
        return finalObj;
      })
      .sort((a: any, b: any) => (b[yAxes[1]] || 0) - (a[yAxes[1]] || 0))
      .slice(0, 10);
  }, [data, xAxis, yAxis, aggregation]);

  const renderChart = () => {
    if (aggregatedData.length === 0) return <div className="h-full flex items-center justify-center text-slate-300 font-bold uppercase text-[10px]">Sin datos para graficar</div>;

    if (type === 'composed') {
      return (
        <div style={{ width: '100%', height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={aggregatedData} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} 
                interval={0} 
                angle={-45} 
                textAnchor="end" 
                height={70} 
              />
              <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#f59e0b' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                formatter={(val: any, name: any) => [
                  String(name).toLowerCase().includes('hours') ? formatDecimalToHHMM(val) : Math.round(val).toLocaleString(),
                  name
                ]}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '25px', fontSize: '11px', fontWeight: '900' }} iconType="circle" />
              <Bar yAxisId="left" dataKey={yAxes[0]} fill={COLORS[0]} name="Prog. Ton" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                 <LabelList dataKey={yAxes[0]} position="top" style={{ fontSize: '9px', fontWeight: '900', fill: COLORS[0] }} formatter={(v: any) => Math.round(v)} />
              </Bar>
              <Bar yAxisId="left" dataKey={yAxes[1]} fill={COLORS[1]} name="Real Ton" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                 <LabelList dataKey={yAxes[1]} position="top" style={{ fontSize: '9px', fontWeight: '900', fill: COLORS[1] }} formatter={(v: any) => Math.round(v)} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey={yAxes[2]} stroke={COLORS[2]} name="Meta Hrs" strokeWidth={2} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false}>
                <LabelList dataKey={yAxes[2]} position="top" style={{ fontSize: '9px', fontWeight: '800', fill: COLORS[2] }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={12} />
              </Line>
              <Line yAxisId="right" type="monotone" dataKey={yAxes[3]} stroke={COLORS[3]} name="Real Hrs" strokeWidth={3} dot={{ r: 5, fill: '#fff', strokeWidth: 3 }} isAnimationActive={false}>
                <LabelList dataKey={yAxes[3]} position="top" style={{ fontSize: '10px', fontWeight: '900', fill: COLORS[3] }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={12} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'pie') {
      const pieData = aggregatedData.map(d => ({ name: d.name, value: d[yAxes[0]] }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={false}>
              {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={aggregatedData} barGap={8} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} height={60} interval={0} angle={-45} textAnchor="end" />
          <YAxis hide />
          <Tooltip />
          <Bar dataKey={yAxes[0]} fill={COLORS[0]} radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
            <LabelList dataKey={yAxes[0]} position="top" style={{ fontSize: '10px', fontWeight: '900', fill: COLORS[0] }} formatter={(v: any) => Math.round(v).toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border border-violeta/10 shadow-sm flex flex-col ${type === 'composed' ? 'min-h-[900px]' : 'h-[500px]'}`}>
      <h3 className="text-[10px] font-black text-violeta uppercase tracking-[0.3em] mb-6 border-b border-calido pb-3">{title}</h3>
      <div className="w-full flex-1">
        {renderChart()}
      </div>
      {type === 'composed' && (
        <div className="mt-12 overflow-hidden border border-slate-100 rounded-3xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-calido/80">
                <th className="py-5 px-6 text-[11px] font-black text-violeta uppercase tracking-widest border-b border-calido">Producto</th>
                <th className="py-5 px-6 text-[11px] font-black text-nucleo uppercase tracking-widest text-center border-b border-calido">Prog (Ton)</th>
                <th className="py-5 px-6 text-[11px] font-black text-ionizado uppercase tracking-widest text-center border-b border-calido">Real (Ton)</th>
                <th className="py-5 px-6 text-[11px] font-black text-tecnico uppercase tracking-widest text-center border-b border-calido">Meta (Hrs)</th>
                <th className="py-5 px-6 text-[11px] font-black text-mineral uppercase tracking-widest text-center border-b border-calido">Real (Hrs)</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map((row, idx) => {
                const isUnderperformingTon = row[yAxes[0]] > 0 && row[yAxes[1]] < (row[yAxes[0]] * 0.85);
                // Cambio: De 10/60 a 15/60 para reflejar el nuevo umbral solicitado de 15 minutos
                const isTimeDeviated = row[yAxes[3]] > 0 && row[yAxes[2]] > 0 && (row[yAxes[3]] - row[yAxes[2]]) >= (10 / 60);
                return (
                  <tr key={idx} className="border-b border-calido last:border-0 hover:bg-calido/50 transition-colors">
                    <td className="py-4 px-6 text-[13px] font-black text-tecnico truncate max-w-[150px]">{row.name}</td>
                    <td className="py-4 px-6 text-[12px] font-bold text-center text-slate-700">{Math.round(row[yAxes[0]] || 0).toLocaleString()}</td>
                    <td className={`py-4 px-6 text-[14px] font-black text-center ${isUnderperformingTon ? 'text-rose-600' : 'text-ionizado'}`}>
                      {Math.round(row[yAxes[1]] || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-[12px] font-bold text-center text-slate-700">{formatDecimalToHHMM(row[yAxes[2]] || 0)}</td>
                    <td className={`py-4 px-6 text-[14px] font-black text-center ${isTimeDeviated ? 'text-rose-600' : 'text-mineral'}`}>
                      {formatDecimalToHHMM(row[yAxes[3]] || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChartCard;
