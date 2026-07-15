import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SiteLocationCard } from '@/components/projects/SiteLocationCard';
import { ProjectTotalSftEditor } from '@/components/projects/ProjectTotalSftEditor';
import { ProjectInfoEditor } from '@/components/projects/ProjectInfoEditor';

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      address: true,
      area: true,
      budget: true,
      photoUrl: true,
      totalSft: true,
      siteLatitude: true,
      siteLongitude: true,
      siteRadiusMeters: true,
    },
  });
  if (!project) notFound();

  return (
    <div className="space-y-5">
      <div>
        <nav className="flex items-center gap-1.5 mb-1">
          <Link href="/projects" className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Projects</Link>
          <span className="text-gray-300 text-[11px]">/</span>
          <Link href={`/projects/${project.id}`} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">{project.name}</Link>
          <span className="text-gray-300 text-[11px]">/</span>
          <span className="text-[11px] text-gray-400">Settings</span>
        </nav>
        <h1 className="text-[20px] font-bold tracking-tight text-gray-900">Project Settings</h1>
      </div>

      <ProjectInfoEditor
        projectId={project.id}
        initialName={project.name}
        initialAddress={project.address}
        initialArea={project.area}
        initialBudget={project.budget}
        initialPhotoUrl={project.photoUrl}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ProjectTotalSftEditor
          projectId={project.id}
          initialTotalSft={project.totalSft != null ? Number(project.totalSft) : null}
        />

        <div>
          <p className="text-[12px] text-gray-400 mb-2 px-1">
            This is the location the mobile app&apos;s GPS attendance check-in/out distance
            calculation is measured against — keeping it accurate matters for attendance flags.
          </p>
          <SiteLocationCard
            projectId={project.id}
            initialLat={project.siteLatitude != null ? Number(project.siteLatitude) : null}
            initialLng={project.siteLongitude != null ? Number(project.siteLongitude) : null}
            initialRadiusMeters={project.siteRadiusMeters}
          />
        </div>
      </div>
    </div>
  );
}
