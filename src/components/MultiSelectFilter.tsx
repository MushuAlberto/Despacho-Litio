import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

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
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
          >
            Limpiar ({selectedValues.length})
          </button>
        )}
      </div>

      {/* Main trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer text-left ${
          isOpen 
            ? 'border-[#461D77] bg-white text-slate-800' 
            : selectedValues.length > 0
              ? 'border-[#461D77] bg-purple-50 text-[#461D77] font-semibold'
              : 'border-slate-200 text-slate-800'
        }`}
      >
        <span className="truncate flex-1">
          {buttonSummary}
        </span>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedValues.length > 0 && (
            <span className={`${badgeColor} text-white text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center`}>
              {selectedValues.length}
            </span>
          )}
          <ChevronDown 
            size={13} 
            className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#461D77]' : ''}`} 
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          className={`absolute ${alignRight ? 'right-0 left-auto' : 'left-0'} mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden min-w-[240px] max-w-xs w-full`}
          style={{ minWidth: '240px' }}
        >
          {/* Search box if options > 3 */}
          {options.length > 3 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en la lista..."
                  className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#461D77]"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick selection bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#461D77] hover:underline cursor-pointer"
            >
              Todos ({options.length})
            </button>
            <span className="text-slate-200">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-500 hover:text-rose-600 cursor-pointer"
            >
              Deseleccionar
            </button>
          </div>

          {/* Option list */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-xs">
                Sin coincidencias para "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => toggleOption(opt.id, e)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl cursor-pointer text-xs transition-colors duration-150 ${
                      isSelected 
                        ? 'bg-purple-50 text-[#461D77] font-semibold' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-150 ${
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono tabular-nums shrink-0 ${
                        isSelected 
                          ? 'bg-[#461D77]/15 text-[#461D77] font-bold' 
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
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono tabular-nums">
              {selectedValues.length === 0 
                ? 'Todos activos' 
                : `${selectedValues.length} de ${options.length}`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-[#461D77] text-white px-3 py-1 rounded-lg text-[11px] font-bold uppercase hover:bg-[#36155E] transition-colors duration-150 cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
