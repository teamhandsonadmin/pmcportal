import { StatsCard } from './StatsCard';
import type { DashboardStats } from '@/lib/types/hvac';

function IconTotal() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>;
}
function IconReady() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>;
}
function IconProgress() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
}
function IconBlocked() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg>;
}
function IconDone() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>;
}

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-7">
      <StatsCard label="Total Tasks"  value={stats.totalCount}       icon={<IconTotal />} />
      <StatsCard label="Ready"        value={stats.readyCount}       icon={<IconReady />}    description="All deps complete" />
      <StatsCard label="In Progress"  value={stats.inProgressCount}  icon={<IconProgress />} description="Currently active" />
      <StatsCard label="Blocked"      value={stats.blockedCount}     icon={<IconBlocked />}  description="Awaiting deps" />
      <StatsCard label="Completed"    value={stats.completedCount}   icon={<IconDone />}     description="Locked & done" />
    </div>
  );
}
