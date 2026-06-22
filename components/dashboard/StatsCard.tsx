interface StatsCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
}

export function StatsCard({ label, value, icon, description }: StatsCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border card-shadow p-5">
      <div className="flex items-start justify-between mb-4">
        <span className="text-[12px] font-medium text-muted-foreground leading-tight">{label}</span>
        <span className="flex-shrink-0 text-gray-400">{icon}</span>
      </div>
      <div className="text-[30px] font-bold tracking-tight leading-none text-gray-900">{value}</div>
      {description && (
        <div className="text-[11px] text-muted-foreground mt-2 leading-tight">{description}</div>
      )}
    </div>
  );
}
