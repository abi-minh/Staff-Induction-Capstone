import { useParams, Link }           from 'react-router-dom';
import { useStaffMember, useStaffProgress } from '../hooks/useStaff';
import { useModules }                from '../hooks/useModules';

export default function StaffDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const userId   = Number(id);

  const { data: staff,    isLoading: l1 } = useStaffMember(userId);
  const { data: progress, isLoading: l2 } = useStaffProgress(userId);
  const { data: modules,  isLoading: l3 } = useModules();

  if (l1 || l2 || l3) return <p>Loading…</p>;
  if (!staff)          return <p>Staff member not found.</p>;

  const progressMap    = new Map((progress ?? []).map((p) => [p.moduleId, p]));
  const completedCount = (progress ?? []).filter((p) => p.status === 'completed').length;
  const totalModules   = modules?.length ?? 0;
  const pct            = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <div>
      <p><Link to="/staff">← Staff</Link></p>
      <h1>{staff.name}</h1>
      {staff.email && <p>{staff.email}</p>}

      <p>{completedCount}/{totalModules} modules completed ({pct}%)</p>

      <table>
        <thead>
          <tr>
            <th>Module</th>
            <th>Status</th>
            <th>Completed</th>
            <th>Time spent</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {(modules ?? []).map((m) => {
            const p = progressMap.get(m.id);
            return (
              <tr key={m.id}>
                <td><Link to={`/modules/${m.id}`}>{m.title || '(Untitled)'}</Link></td>
                <td>{p?.status ?? 'not_started'}</td>
                <td>{p?.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}</td>
                <td>{p?.timeSpent ? `${Math.round(p.timeSpent / 60)} min` : '—'}</td>
                <td>
                  {p?.score != null
                    ? `${p.score}% ${p.passed ? '(Pass)' : '(Fail)'}`
                    : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
