
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {numericCols.slice(0, 6).map(col => {
        const values = data.map(d => Number(d[col])).filter(v => !isNaN(v));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        return (
          <div key={col} className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
              <h4 className="text-[11px] font-bold text-[#461D77] uppercase tracking-wider truncate" title={col}>{col}</h4>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
              <div className="py-4 px-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Promedio</p>
                <p className="font-black tabular-nums text-[#461D77] text-base mt-0.5">{avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
              </div>
              <div className="py-4 px-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Máx</p>
                <p className="font-black tabular-nums text-slate-800 text-base mt-0.5">{max.toLocaleString()}</p>
              </div>
              <div className="py-4 px-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mín</p>
                <p className="font-black tabular-nums text-slate-500 text-base mt-0.5">{min.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
