
import React from 'react';
// Fixed: Changed import to local ./types to correctly resolve the DataRow interface available in the components folder
import type { DataRow } from './types';

interface StatsGridProps {
  data: DataRow[];
}

const StatsGrid: React.FC<StatsGridProps> = ({ data }) => {
  if (data.length === 0) return null;

  const numericCols = Object.keys(data[0]).filter(key => 
    typeof data[0][key] === 'number' || (!isNaN(Number(data[0][key])) && data[0][key] !== '')
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {numericCols.slice(0, 6).map(col => {
        const values = data.map(d => Number(d[col])).filter(v => !isNaN(v));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        return (
          <div key={col} className="bg-white p-4 rounded-xl border border-calido shadow-sm">
            <h4 className="text-xs font-bold text-violeta/40 uppercase mb-3 truncate" title={col}>{col}</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-violeta/30 uppercase">Promedio</p>
                <p className="font-bold text-nucleo">{avg.toLocaleString(undefined, {maximumFractionDigits: 1})}</p>
              </div>
              <div>
                <p className="text-[10px] text-violeta/30 uppercase">Máx</p>
                <p className="font-bold text-ionizado">{max.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-violeta/30 uppercase">Mín</p>
                <p className="font-bold text-mineral">{min.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
