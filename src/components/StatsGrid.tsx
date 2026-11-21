
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
          <div key={col} className="surface-card rounded-lg overflow-hidden border-t-2 border-t-[#461D77]">
            <div className="px-4 py-2.5 bg-[#F2F0EA] border-b border-[#D8D4CA]">
              <h4 className="text-[11px] font-mono font-bold text-[#461D77] uppercase tracking-wider truncate" title={col}>{col}</h4>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#E5E2D9] text-center">
              <div className="py-3.5 px-2">
                <p className="text-[10px] font-mono text-[#57534E] uppercase tracking-wider">Promedio</p>
                <p className="font-mono font-extrabold tabular-nums text-[#461D77] text-base mt-0.5">{avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
              </div>
              <div className="py-3.5 px-2">
                <p className="text-[10px] font-mono text-[#57534E] uppercase tracking-wider">Máx</p>
                <p className="font-mono font-extrabold tabular-nums text-[#181615] text-base mt-0.5">{max.toLocaleString()}</p>
              </div>
              <div className="py-3.5 px-2">
                <p className="text-[10px] font-mono text-[#57534E] uppercase tracking-wider">Mín</p>
                <p className="font-mono font-extrabold tabular-nums text-[#57534E] text-base mt-0.5">{min.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
