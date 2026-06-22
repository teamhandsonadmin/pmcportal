import { Topbar } from '@/components/layout/Topbar';
import { ProjectForm } from '@/components/projects/ProjectForm';

export default function NewProjectPage() {
  return (
    <div>
      <Topbar
        title="New Project"
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: 'New Project' },
        ]}
      />
      <div className="bg-card rounded-xl border border-border card-shadow p-7">
        <h2 className="text-[15px] font-semibold mb-1">Project details</h2>
        <p className="text-[13px] text-muted-foreground mb-6">Fill in the details to create a new project. Works can be added after.</p>
        <ProjectForm />
      </div>
    </div>
  );
}
