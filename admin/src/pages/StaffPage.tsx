import { useState }               from 'react';
import { Link }                   from 'react-router-dom';
import { useStaff, useBulkAssign } from '../hooks/useStaff';
import { useModules }             from '../hooks/useModules';

export default function StaffPage() {
  const { data: staff = [],   isLoading: staffLoading }   = useStaff();
  const { data: modules = [], isLoading: modulesLoading } = useModules();
  const bulkAssign = useBulkAssign();

  // Simple assignment state: which user we're assigning to, which modules selected
  const [assigningUserId, setAssigningUserId]   = useState<number | null>(null);
  const [selectedModules, setSelectedModules]   = useState<number[]>([]);
  const [dueDate,         setDueDate]           = useState('');

  function toggleModule(id: number) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleAssign() {
    if (!assigningUserId) return;
    await Promise.all(
      selectedModules.map((mid) =>
        bulkAssign.mutateAsync({ moduleId: mid, userIds: [assigningUserId], dueDate: dueDate || undefined })
      )
    );
    setAssigningUserId(null);
    setSelectedModules([]);
    setDueDate('');
  }

  if (staffLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Staff</h1>
      <p>{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>

      {/* Staff list — wire to your UI */}
      <ul>
        {staff.map((s) => (
          <li key={s.id}>
            <Link to={`/staff/${s.id}`}>{s.name}</Link>
            {s.email && ` — ${s.email}`}
            {' '}
            <button onClick={() => { setAssigningUserId(s.id); setSelectedModules([]); }}>
              Assign modules
            </button>
          </li>
        ))}
      </ul>

      {/* Assignment panel — wire to your UI */}
      {assigningUserId !== null && (
        <div>
          <h2>
            Assign modules to {staff.find((s) => s.id === assigningUserId)?.name}
          </h2>
          {modulesLoading ? <p>Loading modules…</p> : (
            <ul>
              {modules.map((m) => (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />
                    {' '}{m.title || '(Untitled)'}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div>
            <label>Due date (optional) </label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <button
            onClick={handleAssign}
            disabled={selectedModules.length === 0 || bulkAssign.isLoading}
          >
            {bulkAssign.isLoading ? 'Assigning…' : `Assign (${selectedModules.length})`}
          </button>
          {' '}
          <button onClick={() => setAssigningUserId(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
