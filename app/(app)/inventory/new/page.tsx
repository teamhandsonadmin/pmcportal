import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InventoryItemForm } from '@/components/inventory/InventoryItemForm';

export const dynamic = 'force-dynamic';

export default async function NewInventoryItemPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-xl">
      <div className="mb-1">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Inventory
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">New Inventory Item</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Stock quantity starts at 0 — record an IN transaction after creating the item.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mt-6 card-shadow">
        <InventoryItemForm projects={projects} />
      </div>
    </div>
  );
}
