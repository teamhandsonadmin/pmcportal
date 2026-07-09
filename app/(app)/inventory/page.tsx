import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InventoryList } from '@/components/inventory/InventoryList';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const items = await prisma.inventoryItem.findMany({
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { name: true } } },
  });

  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    category: i.category,
    unit: i.unit,
    quantityOnHand: Number(i.quantityOnHand),
    reorderLevel: i.reorderLevel != null ? Number(i.reorderLevel) : null,
    unitCost: i.unitCost != null ? Number(i.unitCost) : null,
    supplier: i.supplier,
    projectName: i.project?.name ?? null,
  }));

  const totalItems = rows.length;
  const lowStockCount = rows.filter(
    (r) => r.reorderLevel != null && r.quantityOnHand <= r.reorderLevel
  ).length;
  const totalValue = rows.reduce((s, r) => s + r.quantityOnHand * (r.unitCost ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Inventory</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Track stock levels, transactions, and material usage.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-[13px] font-medium rounded-xl transition-colors"
          >
            Upload Invoice (OCR)
          </Link>
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            New Item
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Total Items</div>
          <div className="text-[30px] font-bold leading-none text-gray-900">{totalItems}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Low Stock</div>
          <div className="text-[30px] font-bold leading-none" style={{ color: lowStockCount > 0 ? '#d97706' : '#111111' }}>{lowStockCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Total Value</div>
          <div className="text-[30px] font-bold leading-none text-gray-900">₹{totalValue.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <InventoryList items={rows} />
    </div>
  );
}
