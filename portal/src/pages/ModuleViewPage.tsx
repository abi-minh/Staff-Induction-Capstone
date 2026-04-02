import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useModule, useMarkComplete }  from '../hooks/useModules';
import { useModuleProgress }           from '../hooks/useProgress';
import { upsertProgress }              from '../api/progress';
import { usePortalStore }              from '../store/portalStore';

export default function ModuleViewPage() {
  const { id }     = useParams<{ id: string }>();
  const moduleId   = Number(id);
  const navigate   = useNavigate();
  const userId     = usePortalStore((s) => s.user.id);

  const { data: module, isLoading, error } = useModule(moduleId);
  const progress    = useModuleProgress(moduleId);
  const markComplete = useMarkComplete();

  const startTime   = useRef(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Mark as in_progress when the module is opened
  useEffect(() => {
    if (!moduleId || !userId) return;
    if (!progress || progress.status === 'not_started') {
      upsertProgress(userId, moduleId, 'in_progress', 0).catch(() => {});
    }
  }, [moduleId, userId, progress?.status]);

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;
  if (!module)   return null;

  const isCompleted = progress?.status === 'completed';

  async function handleMarkComplete() {
    setSaving(true);
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    try {
      await markComplete.mutateAsync({ moduleId, timeSpent });
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb — wire to your UI */}
      <p>
        <Link to="/training">← Back to training</Link>
      </p>

      {/* Module header — wire to your UI */}
      <h1 dangerouslySetInnerHTML={{ __html: module.title }} />
      <p>
        {module.meta.module_estimated_minutes > 0 && `${module.meta.module_estimated_minutes} min · `}
        Status: {progress?.status ?? 'not_started'}
      </p>

      {/* Module body — WordPress HTML content */}
      <article dangerouslySetInnerHTML={{ __html: module.content }} />

      {/* Completion controls — wire to your UI */}
      {isCompleted ? (
        <p>
          ✓ Completed
          {progress?.completedAt && ` on ${new Date(progress.completedAt).toLocaleDateString()}`}
        </p>
      ) : confirming ? (
        <div>
          <p>Mark this module as complete?</p>
          <button onClick={handleMarkComplete} disabled={saving}>
            {saving ? 'Saving…' : 'Yes, mark complete'}
          </button>
          <button onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)}>Mark as complete</button>
      )}

      <br />
      <button onClick={() => navigate('/training')}>Back to training</button>
    </div>
  );
}
