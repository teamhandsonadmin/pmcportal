import { getPilotTaskIds, getChecklistManagementData } from '@/app/actions/checklist-management';
import { ChecklistManagementView } from '@/components/tasks/ChecklistManagementView';

export const dynamic = 'force-dynamic';

export default async function ChecklistManagementPage() {
  const pilotTaskIds = await getPilotTaskIds();
  const data = await getChecklistManagementData(pilotTaskIds);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Checklist Management</h1>
      </div>

      <ChecklistManagementView data={data} />
    </div>
  );
}
