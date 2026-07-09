'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface InventoryListRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number | null;
  unitCost: number | null;
  supplier: string | null;
  projectName: string | null;
}

type StockLevel = 'out' | 'low' | 'ok';

function stockLevel(row: InventoryListRow): StockLevel {
  if (row.quantityOnHand <= 0) return 'out';
  if (row.reorderLevel != null && row.quantityOnHand <= row.reorderLevel) return 'low';
  return 'ok';
}

const STOCK_CFG: Record<StockLevel, { label: string; bg: string; color: string; dot: string }> = {
  ok:  { label: 'OK',          bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  low: { label: 'Low Stock',   bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' },
  out: { label: 'Out of Stock', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
};

function StockBadge({ level }: { level: StockLevel }) {
  const c = STOCK_CFG[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

const GRID = '2fr 1fr 90px 1fr 100px 100px';

interface Props {
  items: InventoryListRow[];
}

export function InventoryList({ items }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      const matchSearch = !q || i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || i.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [items, search, categoryFilter]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 flex-1 max-w-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search items or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 text-[12.5px] border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="text-[12px] text-gray-400 flex-shrink-0">
          {filtered.length} of {items.length} items
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10.5px] font-bold uppercase tracking-widest text-gray-400" style={{ gridTemplateColumns: GRID }}>
        <span>Item</span>
        <span>Category</span>
        <span>Unit</span>
        <span>On Hand</span>
        <span>Status</span>
        <span className="text-right">Value</span>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[14px] font-semibold text-gray-700 mb-1">
            {items.length === 0 ? 'No inventory items yet' : 'No items match your search'}
          </p>
          <p className="text-[12.5px] text-gray-400 mb-5 max-w-xs">
            {items.length === 0 ? 'Add your first item to start tracking stock.' : 'Try adjusting your search or filter.'}
          </p>
          {items.length === 0 && (
            <Link href="/inventory/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-[12.5px] font-medium rounded-lg hover:bg-black transition-colors">
              + New Item
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {filtered.map((item) => {
            const level = stockLevel(item);
            const value = item.quantityOnHand * (item.unitCost ?? 0);
            return (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className="grid items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-gray-900 truncate">{item.name}</div>
                  <div className="text-[11.5px] text-gray-400">{item.sku ?? '—'}</div>
                </div>
                <div className="text-[12.5px] text-gray-600 truncate">{item.category ?? '—'}</div>
                <div className="text-[12.5px] text-gray-500 font-mono">{item.unit}</div>
                <div className="text-[13px] font-semibold text-gray-800 tabular-nums">{item.quantityOnHand}</div>
                <div><StockBadge level={level} /></div>
                <div className="text-right text-[12.5px] text-gray-600 tabular-nums">
                  {item.unitCost != null ? `₹${value.toLocaleString('en-IN')}` : '—'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
