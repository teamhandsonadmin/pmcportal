import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InvoiceUploadFlow } from '@/components/inventory/InvoiceUploadFlow';

// OCR can take several seconds; raises the allowed execution time for this
// route (still bounded by whatever the hosting plan permits — e.g. Vercel
// Hobby caps function duration at 10s by default regardless of this value).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export default async function InventoryUploadPage() {
  const existingItems = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-3xl">
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
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Upload Invoice (OCR)</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Upload a photo of an invoice or delivery note to prefill inventory stock updates.
        </p>
      </div>

      <div className="mt-6">
        <InvoiceUploadFlow existingItems={existingItems} />
      </div>
    </div>
  );
}
