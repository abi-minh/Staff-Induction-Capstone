import { useState }                           from 'react';
import { Link, useNavigate }                  from 'react-router-dom';
import { useModules, useDeleteModule }        from '../hooks/useModules';

export default function ModulesPage() {
  const navigate                                   = useNavigate();
  const { data: modules = [], isLoading, error }   = useModules();
  const deleteModule                               = useDeleteModule();
  const [confirmDelete, setConfirmDelete]          = useState<number | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;

  return (
    <div>
      <h1>Training Modules</h1>
      <button onClick={() => navigate('/modules/new')}>+ New module</button>

      {/* Module list — wire to your UI */}
      <ul>
        {modules.map((m) => (
          <li key={m.id}>
            <Link to={`/modules/${m.id}`}>{m.title || '(Untitled)'}</Link>
            {' — '}
            {m.status}
            {' — '}
            Order: {m.meta.module_order}
            {' '}
            {confirmDelete === m.id ? (
              <>
                <button
                  onClick={() => deleteModule.mutateAsync(m.id).then(() => setConfirmDelete(null))}
                  disabled={deleteModule.isLoading}
                >
                  Confirm delete
                </button>
                <button onClick={() => setConfirmDelete(null)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(m.id)}>Delete</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
