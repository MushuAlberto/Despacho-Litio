import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

// Colores corporativos definidos en el sistema
const COLORS = {
  progTon: '#461D77', // Púrpura (nucleo)
  realTon: '#3FAA88', // Verde (ionizado)
  metaHrs: '#171717', // Negro (tecnico)
  realHrs: '#C59E4D'  // Dorado/Ocre (mineral)
};

// Función para convertir horas decimales (1.5) a formato HH:MM (1:30)
export const formatDecimalToHHMM = (decimalHours: number): string => {
  if (isNaN(decimalHours) || decimalHours <= 0) return "0:00";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

interface ChartData {
  name: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
}

interface Props {
  data: ChartData[];
}

const CambioAnalisisComparativoChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-violeta/10 shadow-sm min-h-[600px] w-full">
      <h3 className="text-[10px] font-black text-violeta uppercase tracking-[0.3em] mb-6 border-b border-calido pb-3">
        ANÁLISIS COMPARATIVO
      </h3>
      
      <div style={{ width: '100%', height: '500px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
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

            {/* Eje Izquierdo: Tonelaje */}
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8' }} 
            />

            {/* Eje Derecho: Horas */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#C59E4D' }} 
              tickFormatter={(v) => formatDecimalToHHMM(Number(v))}
            />

            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
              formatter={(val: any, name: any) => [
                String(name).toLowerCase().includes('hrs') ? formatDecimalToHHMM(Number(val)) : Math.round(Number(val)).toLocaleString(),
                name
              ]}
            />

            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '25px', fontSize: '11px', fontWeight: '900' }} iconType="circle" />

            {/* Barras de Tonelaje */}
            <Bar yAxisId="left" dataKey="Ton_Prog" fill={COLORS.progTon} name="Prog. Ton" barSize={22} radius={[4, 4, 0, 0]}>
               <LabelList dataKey="Ton_Prog" position="top" style={{ fontSize: '9px', fontWeight: '900', fill: COLORS.progTon }} formatter={(v: any) => Math.round(v)} />
            </Bar>
            
            <Bar yAxisId="left" dataKey="Ton_Real" fill={COLORS.realTon} name="Real Ton" barSize={22} radius={[4, 4, 0, 0]}>
               <LabelList dataKey="Ton_Real" position="top" style={{ fontSize: '9px', fontWeight: '900', fill: COLORS.realTon }} formatter={(v: any) => Math.round(v)} />
            </Bar>

            {/* Líneas de Tiempo */}
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="faenaMetaHours" 
              stroke={COLORS.metaHrs} 
              name="Meta Hrs" 
              strokeWidth={2} 
              dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
            >
              <LabelList dataKey="faenaMetaHours" position="top" style={{ fontSize: '9px', fontWeight: '800', fill: COLORS.metaHrs }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={12} />
            </Line>

            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="faenaRealHours" 
              stroke={COLORS.realHrs} 
              name="Real Hrs" 
              strokeWidth={3} 
              dot={{ r: 5, fill: '#fff', strokeWidth: 3 }}
            >
              <LabelList dataKey="faenaRealHours" position="top" style={{ fontSize: '10px', fontWeight: '900', fill: COLORS.realHrs }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={12} />
            </Line>

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CambioAnalisisComparativoChart;
