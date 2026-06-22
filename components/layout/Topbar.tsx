import Link from 'next/link';

interface TopbarProps {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  action?: { label: string; href: string };
}

export function Topbar({ title, breadcrumb, action }: TopbarProps) {
  return (
    <div className="flex items-center justify-between mb-7">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 mb-1.5" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                )}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[11.5px] text-muted-foreground/60">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-semibold text-foreground tracking-[-0.02em]">{title}</h1>
      </div>

      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white bg-primary transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {action.label}
        </Link>
      )}
    </div>
  );
}
