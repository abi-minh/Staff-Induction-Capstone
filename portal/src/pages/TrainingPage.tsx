import { useState } from 'react';
import { Link }      from 'react-router-dom';
import { useAssignedModules } from '../hooks/useModules';
import { useProgress }        from '../hooks/useProgress';
import type { ProgressStatus } from '../types';

type Filter = 'all' | ProgressStatus;

export default function TrainingPage() {
  const [filter, setFilter]                  = useState<Filter>('all');
  const { data: modules, isLoading, error }  = useAssignedModules();
  const { data: progress = [] }              = useProgress();

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;

  const filtered = modules?.filter((m) => {
    if (filter === 'all') return true;
    const p = progress.find((r) => r.moduleId === m.id);
    return (p?.status ?? 'not_started') === filter;
  });

  return (
    <div>
      <h1>My Training</h1>
      <p>{modules?.length ?? 0} modules assigned</p>

      {/* Filter controls — wire to your UI */}
      <div>
        {(['all', 'not_started', 'in_progress', 'completed'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} disabled={filter === f}>
            {f}
          </button>
        ))}
      </div>

      {/* Module list — wire to your UI */}
      <ul>
        {filtered?.map((m) => {
          const p = progress.find((r) => r.moduleId === m.id);
          return (
            <li key={m.id}>
              <Link to={`/training/${m.id}`}>{m.title}</Link>
              {' — '}
              {m.meta.module_estimated_minutes > 0 && `${m.meta.module_estimated_minutes} min — `}
              {p?.status ?? 'not_started'}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
