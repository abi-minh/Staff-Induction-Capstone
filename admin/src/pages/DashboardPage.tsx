import { Link }        from 'react-router-dom';
import { currentUser } from '../api/client';
import { useModules }  from '../hooks/useModules';
import { useStaff }    from '../hooks/useStaff';
import { useReports }  from '../hooks/useReports';

export default function DashboardPage() {
  const { data: modules }             = useModules();
  const { data: staff }               = useStaff();
  const { data: reports, isLoading }  = useReports();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Signed in as {currentUser?.name}</p>

      {/* Stats — wire to your UI */}
      <ul>
        <li>Modules: {modules?.length ?? '…'}</li>
        <li>Staff: {staff?.length ?? '…'}</li>
        <li>Overall completion: {isLoading ? '…' : `${reports?.overallCompletionPct ?? 0}%`}</li>
      </ul>

      {/* Module completion summary — wire to your UI */}
      {reports?.moduleReports.map((r) => (
        <div key={r.moduleId}>
          <span>{r.moduleTitle}</span>
          {' — '}
          <span>{r.totalCompleted}/{r.totalAssigned} ({r.completionPct}%)</span>
        </div>
      ))}

      {/* Quick links — wire to your UI */}
      <p>
        <Link to="/modules/new">+ New module</Link>
        {' | '}
        <Link to="/documents">Upload document</Link>
        {' | '}
        <Link to="/staff">Manage staff</Link>
      </p>
    </div>
  );
}
