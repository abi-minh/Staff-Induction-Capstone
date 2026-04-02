import { useEffect, useState }              from 'react';
import { useParams, useNavigate, Link }     from 'react-router-dom';
import { useModule, useCreateModule, useUpdateModule } from '../hooks/useModules';
import type { ModuleFormValues }            from '../types';

const ROLES = ['staff', 'manager', 'casual', 'all'];

const empty: ModuleFormValues = {
  title: '', content: '', excerpt: '', status: 'draft',
  module_role_targets: [], module_estimated_minutes: 0, module_order: 0,
};

export default function ModuleEditPage() {
  const { id }     = useParams<{ id: string }>();
  const isNew      = id === 'new';
  const moduleId   = isNew ? 0 : Number(id);
  const navigate   = useNavigate();

  const { data: existing, isLoading } = useModule(moduleId);
  const createModule = useCreateModule();
  const updateModule = useUpdateModule(moduleId);

  const [form, setForm] = useState<ModuleFormValues>(empty);

  useEffect(() => {
    if (existing) {
      setForm({
        title:                      existing.title,
        content:                    existing.content,
        excerpt:                    existing.excerpt,
        status:                     existing.status,
        module_role_targets:        existing.meta.module_role_targets,
        module_estimated_minutes:   existing.meta.module_estimated_minutes,
        module_order:               existing.meta.module_order,
      });
    }
  }, [existing]);

  if (!isNew && isLoading) return <p>Loading…</p>;

  function set<K extends keyof ModuleFormValues>(key: K, value: ModuleFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleRole(role: string) {
    set('module_role_targets',
      form.module_role_targets.includes(role)
        ? form.module_role_targets.filter((r) => r !== role)
        : [...form.module_role_targets, role]
    );
  }

  async function handleSave() {
    if (isNew) {
      const created = await createModule.mutateAsync(form);
      navigate(`/modules/${created.id}`, { replace: true });
    } else {
      await updateModule.mutateAsync(form);
    }
  }

  const saving = createModule.isLoading || updateModule.isLoading;

  return (
    <div>
      <p><Link to="/modules">← Modules</Link></p>
      <h1>{isNew ? 'New module' : 'Edit module'}</h1>

      {/* Module form — wire to your UI / add your rich text editor here */}
      <div>
        <label>Title</label>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div>
        <label>Content (HTML)</label>
        {/* Replace this textarea with your rich text editor */}
        <textarea
          rows={12}
          value={form.content}
          onChange={(e) => set('content', e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </div>

      <div>
        <label>Excerpt</label>
        <textarea
          rows={3}
          value={form.excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <label>Status </label>
        <select value={form.status} onChange={(e) => set('status', e.target.value as 'publish' | 'draft')}>
          <option value="draft">Draft</option>
          <option value="publish">Published</option>
        </select>
      </div>

      <div>
        <label>Display order </label>
        <input
          type="number" min={0} value={form.module_order}
          onChange={(e) => set('module_order', Number(e.target.value))}
        />
      </div>

      <div>
        <label>Estimated time (minutes) </label>
        <input
          type="number" min={0} value={form.module_estimated_minutes}
          onChange={(e) => set('module_estimated_minutes', Number(e.target.value))}
        />
      </div>

      <div>
        <label>Assign to roles</label>
        {ROLES.map((role) => (
          <label key={role} style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={form.module_role_targets.includes(role)}
              onChange={() => toggleRole(role)}
            />
            {' '}{role}
          </label>
        ))}
      </div>

      <br />
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isNew ? 'Create module' : 'Save changes'}
      </button>
      {' '}
      <button onClick={() => navigate('/modules')}>Cancel</button>
    </div>
  );
}
