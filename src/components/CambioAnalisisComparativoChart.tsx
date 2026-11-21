import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';

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
  title: string;
}

const CambioAnalisisComparativoChart: React.FC<Props> = ({ data, title }) => {
  const handleDownload = () => {
    const element = document.getElementById(`chart-table-container-${title.replace(/\s+/g, '_')}`);
    if (!element) return;

    const width = element.scrollWidth + 64; // Compensar 32px de padding por lado
    const height = element.scrollHeight + 64; // Compensar 32px de padding arriba y abajo

    toPng(element, {
      width: width,
      height: height,
      backgroundColor: '#F7F6F2',
      style: {
        borderRadius: '0px',
        padding: '32px',
        margin: '0px',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible'
      },
      pixelRatio: 2
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        const cleanTitle = title.replace(/\s+/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `Grafico_y_Tabla_Comparativa_${cleanTitle}_${dateStr}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Error generating PNG:', err);
      });
  };

  return (
    <div id={`chart-container-${title.replace(/\s+/g, '_')}`} className="bg-[#FFFFFF] p-6 md:p-8 rounded-lg border border-[#E2DFD7] min-h-[600px] w-full">
      <div className="flex justify-between items-center mb-6 border-b border-[#E2DFD7] pb-3">
        <h3 className="text-xs font-mono font-semibold text-[#461D77] uppercase tracking-wider">
          Análisis Comparativo
        </h3>
        <button
          onClick={handleDownload}
          disabled={data.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#461D77] hover:text-white border border-[#E2DFD7] hover:border-[#461D77] hover:bg-[#461D77] rounded-md transition-colors duration-150 disabled:opacity-40 cursor-pointer uppercase tracking-wider"
          title="Descargar gráfico como imagen PNG"
        >
          <Download className="w-3.5 h-3.5" /> Descargar PNG
        </button>
      </div>

      <div style={{ width: '100%', height: '500px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFECE6" />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#57534E' }}
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
              tick={{ fontSize: 10, fill: '#78716C' }}
            />

            {/* Eje Derecho: Horas */}
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#B45309' }}
              tickFormatter={(v) => formatDecimalToHHMM(Number(v))}
            />

            <Tooltip
              cursor={{ fill: '#F7F6F2' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E2DFD7', boxShadow: '0 2px 6px rgba(28,25,23,0.06)', fontSize: '12px' }}
              formatter={(val: any, name: any) => [
                String(name).toLowerCase().includes('hrs') ? formatDecimalToHHMM(Number(val)) : Math.round(Number(val)).toLocaleString(),
                name
              ]}
            />

            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '25px', fontSize: '11px', fontWeight: '700' }} iconType="circle" />

            {/* Barras de Tonelaje */}
            <Bar yAxisId="left" dataKey="Ton_Prog" fill={COLORS.progTon} name="Prog. Ton" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
               <LabelList dataKey="Ton_Prog" position="top" style={{ fontSize: '9px', fontWeight: '900', fill: COLORS.progTon }} formatter={(v: any) => Math.round(v)} />
            </Bar>
            
            <Bar yAxisId="left" dataKey="Ton_Real" fill={COLORS.realTon} name="Real Ton" barSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
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
              isAnimationActive={false}
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
              isAnimationActive={false}
            >
              <LabelList dataKey="faenaRealHours" position="top" style={{ fontSize: '10px', fontWeight: '900', fill: COLORS.realHrs }} formatter={(v: any) => formatDecimalToHHMM(v)} offset={12} />
            </Line>

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default React.memo(CambioAnalisisComparativoChart);
