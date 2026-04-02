import { useReports } from '../hooks/useReports';

export default function ReportsPage() {
  const { data: reports, isLoading, error, refetch } = useReports();

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message} <button onClick={() => refetch()}>Retry</button></p>;
  if (!reports)  return null;

  function exportCsv() {
    const rows = [
      ['Module', 'Assigned', 'Completed', '% Complete'],
      ...(reports?.moduleReports ?? []).map((r) => [
        r.moduleTitle, r.totalAssigned, r.totalCompleted, `${r.completionPct}%`,
      ]),
    ];
    const csv  = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'induction-report.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1>Reports</h1>
      <button onClick={() => refetch()}>Refresh</button>
      {' '}
      <button onClick={exportCsv}>Export CSV</button>

      {/* Top stats — wire to your UI / charts */}
      <ul>
        <li>Total modules: {reports.totalModules}</li>
        <li>Total staff: {reports.totalStaff}</li>
        <li>Overall completion: {reports.overallCompletionPct}%</li>
      </ul>

      {/* completion_over_time is available for charting: reports.completionOverTime */}

      {/* Per-module breakdown — wire to your UI / charts */}
      {reports.moduleReports.map((r) => (
        <details key={r.moduleId}>
          <summary>
            {r.moduleTitle} — {r.totalCompleted}/{r.totalAssigned} ({r.completionPct}%)
          </summary>
          <table>
            <thead>
              <tr><th>Staff</th><th>Status</th><th>Completed</th></tr>
            </thead>
            <tbody>
              {r.staffBreakdown.map((s) => (
                <tr key={s.userId}>
                  <td>{s.name}</td>
                  <td>{s.status}</td>
                  <td>{s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
