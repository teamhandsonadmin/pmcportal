'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { DependencyCategory, DependencyItem } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';

const CATEGORY_LABEL: Record<DependencyCategory, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Vendor',
  procurement: 'Procurement',
};

interface BlockedDependencyModalProps {
  items: DependencyItem[];
  categories: DependencyCategory[];
}

export function BlockedDependencyModal({ items, categories }: BlockedDependencyModalProps) {
  const missing = categories
    .map((cat) => ({
      category: cat,
      items: items.filter((i) => i.category === cat && !isItemDone(i.completion?.status)),
    }))
    .filter((g) => g.items.length > 0);

  const missingCount = missing.reduce((s, g) => s + g.items.length, 0);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="w-full border-red-200 text-red-700 hover:bg-red-50">
            View Blockers ({missingCount})
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why this task is blocked</DialogTitle>
          <DialogDescription>
            {missingCount} checklist item{missingCount === 1 ? '' : 's'} across {missing.length} categor
            {missing.length === 1 ? 'y' : 'ies'} still need to be delivered before this task can move to Ready.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {missing.map((group) => (
            <div key={group.category}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                {CATEGORY_LABEL[group.category]}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-[13px] text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {item.itemLabel}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button size="sm">Got it</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
