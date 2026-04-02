import { Link } from 'react-router-dom';
import { useAssignedModules } from '../hooks/useModules';
import { useProgress }        from '../hooks/useProgress';
import { usePortalStore }     from '../store/portalStore';

export default function DashboardPage() {
  const user                               = usePortalStore((s) => s.user);
  const { data: modules, isLoading, error } = useAssignedModules();
  const { data: progress = [] }            = useProgress();

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;

  const completed  = progress.filter((p) => p.status === 'completed').length;
  const total      = modules?.length ?? 0;
  const nextModule = modules?.find((m) => {
    const p = progress.find((r) => r.moduleId === m.id);
    return !p || p.status !== 'completed';
  });

  return (
    <div>
      <h1>Welcome, {user.name}</h1>

      {/* Progress summary — wire to your UI */}
      <p>{completed} of {total} modules completed</p>

      {/* Next up — wire to your UI */}
      {nextModule && (
        <div>
          <p>Up next:</p>
          <Link to={`/training/${nextModule.id}`}>
            {nextModule.title}
          </Link>
        </div>
      )}

      {/* All modules preview — wire to your UI */}
      <ul>
        {modules?.map((m) => {
          const p = progress.find((r) => r.moduleId === m.id);
          return (
            <li key={m.id}>
              <Link to={`/training/${m.id}`}>{m.title}</Link>
              {' — '}
              {p?.status ?? 'not_started'}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
