import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search, CheckSquare, Square } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (newValues: string[]) => void;
  badgeColor?: string;
  className?: string;
  alignRight?: boolean;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  placeholder = 'Todos',
  options,
  selectedValues,
  onChange,
  badgeColor = 'bg-[#461D77]',
  className = '',
  alignRight = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q));
  }, [options, search]);

  const countSelected = selectedValues.length;

  const toggleOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedValues.includes(id)) {
      const next = selectedValues.filter(val => val !== id);
      onChange(next);
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Setting to empty array means "All / Todos" (no filter restriction)
    onChange([]);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const buttonSummary = useMemo(() => {
    if (selectedValues.length === 0) {
      return `${placeholder} (${options.length})`;
    }
    if (selectedValues.length === 1) {
      const found = options.find(o => o.id === selectedValues[0]);
      return found ? found.label : selectedValues[0];
    }
    return `${selectedValues.length} seleccionados`;
  }, [selectedValues, options, placeholder]);

  return (
    <div className={`relative space-y-1 ${isOpen ? 'z-50' : 'z-10'} ${className}`} ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
          {label}:
        </label>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[9.5px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
          >
            Limpiar ({selectedValues.length})
          </button>
        )}
      </div>

      {/* Main trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-50 border rounded-xl text-slate-700 font-medium text-[11px] transition-all cursor-pointer text-left shadow-xs ${
          isOpen 
            ? 'border-[#461D77] ring-2 ring-[#461D77]/20 bg-white' 
            : selectedValues.length > 0
              ? 'border-[#461D77] bg-purple-50/60 text-[#461D77] font-semibold'
              : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="truncate flex-1">
          {buttonSummary}
        </span>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedValues.length > 0 && (
            <span className={`${badgeColor} text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center`}>
              {selectedValues.length}
            </span>
          )}
          <ChevronDown 
            size={13} 
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#461D77]' : ''}`} 
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          className={`absolute ${alignRight ? 'right-0 left-auto' : 'left-0'} mt-1.5 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden min-w-[240px] max-w-xs w-full ring-1 ring-black/10`}
          style={{ minWidth: '240px' }}
        >
          {/* Search box if options > 3 */}
          {options.length > 3 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en la lista..."
                  className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 focus:border-[#461D77]"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick selection bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-600">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#461D77] hover:underline cursor-pointer"
            >
              Todos ({options.length})
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-500 hover:text-red-600 cursor-pointer"
            >
              Deseleccionar
            </button>
          </div>

          {/* Option list */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-[11px]">
                Sin coincidencias para "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => toggleOption(opt.id, e)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl cursor-pointer text-[11.5px] transition-colors ${
                      isSelected 
                        ? 'bg-purple-50 text-[#461D77] font-bold' 
                        : 'hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-[#461D77] border-[#461D77] text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className="truncate" title={opt.label}>
                        {opt.label}
                      </span>
                    </div>

                    {opt.count !== undefined && (
                      <span className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                        isSelected 
                          ? 'bg-[#461D77]/15 text-[#461D77] font-black' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {opt.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer summary */}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500">
            <span className="font-medium">
              {selectedValues.length === 0 
                ? 'Todos activos' 
                : `${selectedValues.length} de ${options.length} seleccionados`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-[#461D77] text-white px-3 py-1 rounded-lg text-[10.5px] font-black uppercase hover:bg-[#381660] cursor-pointer shadow-xs"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
