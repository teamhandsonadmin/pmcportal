'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const selectCls =
  'text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none cursor-pointer hover:border-gray-400 transition-colors';
const dateCls =
  'text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-gray-400 transition-colors';

export function DprFilterBar({
  projects,
  users,
}: {
  projects: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const projectF = searchParams.get('project') ?? '';
  const userF = searchParams.get('user') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const hasFilter = !!(projectF || userF || from || to);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2.5 flex-wrap"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <select value={projectF} onChange={(e) => update({ project: e.target.value || null })} className={selectCls}>
        <option value="">All Projects</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <select value={userF} onChange={(e) => update({ user: e.target.value || null })} className={selectCls}>
        <option value="">All Users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
      </select>

      <div className="flex items-center gap-1.5">
        <input type="date" value={from} onChange={(e) => update({ from: e.target.value || null })} className={dateCls} />
        <span className="text-[11.5px] text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => update({ to: e.target.value || null })} className={dateCls} />
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
