import { Suspense } from 'react';
import { ProjectorReceiver } from '@/features/trace/ProjectorReceiver';

export const metadata = { title: 'LeaLand – projektor' };

export default function ProjectorPage() {
  return (
    <Suspense>
      <ProjectorReceiver />
    </Suspense>
  );
}
