import Link from 'next/link';
import { WorkForm } from '@/components/works/WorkForm';

export default function NewWorkPage() {
  return (
    <div className="max-w-lg">
      <div className="mb-1">
        <Link
          href="/works"
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          All Works
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">New Work</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          A Work groups related tasks — e.g. HVAC, Electrical, Plumbing. Each task gets 5 dependency checklists with 5 items each.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mt-6 card-shadow">
        <WorkForm />
      </div>
    </div>
  );
}
