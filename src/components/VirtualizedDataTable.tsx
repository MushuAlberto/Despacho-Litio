import React, { useRef, useState } from 'react';
import {
  ColumnDef,
  columnSizingFeature,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export const virtualizedTableFeatures = tableFeatures({
  rowSortingFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

export type VirtualizedTableFeatures = typeof virtualizedTableFeatures;
export type VirtualizedColumnDef<TData extends Record<string, any>> = ColumnDef<
  VirtualizedTableFeatures,
  TData,
  any
>;

interface VirtualizedDataTableProps<TData extends Record<string, any>> {
  data: TData[];
  columns: VirtualizedColumnDef<TData>[];
  estimateRowHeight?: number;
  maxHeightPx?: number;
  emptyMessage?: string;
  minTableWidthPx?: number;
}

/**
 * Tabla empresarial virtualizada con @tanstack/react-table v9 y @tanstack/react-virtual.
 * Renderiza únicamente las filas visibles en el viewport manteniendo 60 fps
 * incluso con miles de registros de guías Stokes o movimientos de flota.
 */
function VirtualizedDataTableInner<TData extends Record<string, any>>({
  data,
  columns,
  estimateRowHeight = 42,
  maxHeightPx = 560,
  emptyMessage = 'No hay registros que coincidan con los filtros actuales.',
  minTableWidthPx = 1040,
}: VirtualizedDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const table = useTable(
    {
      features: virtualizedTableFeatures,
      data,
      columns,
      state: { sorting },
      onSortingChange: setSorting,
    },
    (state) => ({ sorting: state.sorting })
  );

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? Math.max(0, totalHeight - virtualRows[virtualRows.length - 1].end) : 0;

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-sm font-medium text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      style={{ maxHeight: `${maxHeightPx}px` }}
      className="overflow-auto w-full relative"
    >
      <table
        style={{ minWidth: `${minTableWidthPx}px` }}
        className="w-full text-xs text-left border-collapse tabular-nums"
      >
        <thead className="sticky top-0 z-10 bg-[#461D77] text-white">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 hover:text-emerald-200 transition-colors cursor-pointer"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : sorted === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={11} className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {paddingTop > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: `${paddingTop}px`, padding: 0 }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                style={{ height: `${estimateRowHeight}px` }}
                className="hover:bg-purple-50/70 transition-colors"
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: `${paddingBottom}px`, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const VirtualizedDataTable = React.memo(VirtualizedDataTableInner) as typeof VirtualizedDataTableInner;
