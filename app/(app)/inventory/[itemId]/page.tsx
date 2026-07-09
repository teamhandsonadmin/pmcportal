import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { RecordTransactionDialog } from '@/components/inventory/RecordTransactionDialog';
import { getSignedInvoiceUrl } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ itemId: string }>;
}

const TYPE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  IN:         { label: 'IN',         bg: '#f0fdf4', color: '#15803d' },
  OUT:        { label: 'OUT',        bg: '#fef2f2', color: '#b91c1c' },
  ADJUSTMENT: { label: 'ADJUSTMENT', bg: '#f3f4f6', color: '#4b5563' },
};

function stockLevel(quantityOnHand: number, reorderLevel: number | null) {
  if (quantityOnHand <= 0) return { label: 'Out of Stock', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' };
  if (reorderLevel != null && quantityOnHand <= reorderLevel) return { label: 'Low Stock', bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' };
  return { label: 'OK', bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' };
}

export default async function InventoryItemDetailPage({ params }: Props) {
  const { itemId } = await params;

  const [item, transactions] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { project: { select: { name: true } } },
    }),
    prisma.inventoryTransaction.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!item) notFound();

  const quantityOnHand = Number(item.quantityOnHand);
  const reorderLevel = item.reorderLevel != null ? Number(item.reorderLevel) : null;
  const unitCost = item.unitCost != null ? Number(item.unitCost) : null;
  const level = stockLevel(quantityOnHand, reorderLevel);

  const transactionRows = await Promise.all(
    transactions.map(async (t) => ({
      id: t.id,
      type: t.type,
      quantity: Number(t.quantity),
      note: t.note,
      createdAt: t.createdAt,
      sourceUrl: t.sourceDocPath ? await getSignedInvoiceUrl(t.sourceDocPath).catch(() => null) : null,
    }))
  );

  const canDelete = transactions.length === 0;

  return (
    <div className="space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Inventory
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">{item.name}</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{item.sku ?? 'No SKU'} {item.category ? `· ${item.category}` : ''}</p>
        </div>
        <RecordTransactionDialog itemId={item.id} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">On Hand</div>
          <div className="text-[30px] font-bold leading-none text-gray-900">{quantityOnHand} <span className="text-[14px] text-gray-400 font-normal">{item.unit}</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</div>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: level.bg, color: level.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: level.dot }} />
            {level.label}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Total Value</div>
          <div className="text-[30px] font-bold leading-none text-gray-900">
            {unitCost != null ? `₹${(quantityOnHand * unitCost).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-[13px] font-semibold text-gray-900 mb-4">Details</h2>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-[12px] text-gray-400">Reorder Level</dt>
              <dd className="text-[12.5px] font-medium text-gray-800">{reorderLevel ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[12px] text-gray-400">Unit Cost</dt>
              <dd className="text-[12.5px] font-medium text-gray-800">{unitCost != null ? `₹${unitCost}` : '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[12px] text-gray-400">Supplier</dt>
              <dd className="text-[12.5px] font-medium text-gray-800">{item.supplier ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[12px] text-gray-400">Project</dt>
              <dd className="text-[12.5px] font-medium text-gray-800">{item.project?.name ?? 'Unassigned'}</dd>
            </div>
            {item.notes && (
              <div>
                <dt className="text-[12px] text-gray-400 mb-1">Notes</dt>
                <dd className="text-[12.5px] text-gray-600 leading-relaxed">{item.notes}</dd>
              </div>
            )}
          </dl>
          {!canDelete && (
            <p className="text-[11px] text-gray-400 mt-5 pt-4 border-t border-gray-100">
              This item cannot be deleted — it has transaction history.
            </p>
          )}
        </div>

        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-[13px] font-semibold text-gray-900">Transaction History</h2>
          </div>
          {transactionRows.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 px-5 py-8 text-center">No transactions recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactionRows.map((t) => {
                const cfg = TYPE_CFG[t.type];
                return (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10.5px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold text-gray-800 tabular-nums">{t.quantity}</div>
                        {t.note && <div className="text-[11.5px] text-gray-400">{t.note}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11.5px] text-gray-400 font-mono">{formatDateTime(t.createdAt)}</div>
                      {t.sourceUrl && (
                        <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-gray-600 hover:text-gray-900 underline">
                          View source
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
