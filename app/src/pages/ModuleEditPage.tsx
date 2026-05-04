import { useEffect, useRef, useState }       from 'react';
import { useParams, useNavigate, Link }     from 'react-router-dom';
import { useModule, useCreateModule, useUpdateModule } from '../hooks/useModules';
import { useUploadMedia }                   from '../hooks/useDocuments';
import BlockEditor                          from '../blocks/BlockEditor';
import { blocksToHtml }                     from '../blocks/utils';
import { ICON_OPTIONS, getIconByKey }       from '../components/iconLibrary';
import type { ModuleFormValues, Block }     from '../types';

const ROLES = ['staff', 'manager', 'casual', 'all'];

const empty: ModuleFormValues = {
  title: '', content: '', excerpt: '', status: 'draft',
  module_role_targets: [], module_estimated_minutes: 0, module_order: 0,
  module_icon: '', module_hero_image: 0,
};

export default function ModuleEditPage() {
  const { id }     = useParams<{ id: string }>();
  const isNew      = id === 'new';
  const moduleId   = isNew ? 0 : Number(id);
  const navigate   = useNavigate();

  const { data: existing, isLoading } = useModule(moduleId);
  const createModule = useCreateModule();
  const updateModule = useUpdateModule(moduleId);
  const uploadMedia  = useUploadMedia();

  const [form, setForm]       = useState<ModuleFormValues>(empty);
  const [blocks, setBlocks]   = useState<Block[]>([]);
  const [heroPreview, setHeroPreview] = useState<string>('');
  const heroFileRef = useRef<HTMLInputElement>(null);

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
        module_icon:                existing.meta.module_icon,
        module_hero_image:          existing.meta.module_hero_image,
      });

      try {
        const parsed = JSON.parse(existing.meta.module_blocks);
        if (Array.isArray(parsed)) setBlocks(parsed);
      } catch {
        setBlocks([]);
      }
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

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    set('module_hero_image', media.id);
    setHeroPreview(media.sourceUrl);
  }

  async function handleSave() {
    const values = {
      ...form,
      content: blocksToHtml(blocks),
      module_blocks: JSON.stringify(blocks),
    };

    if (isNew) {
      const created = await createModule.mutateAsync(values);
      navigate(`/modules/${created.id}`, { replace: true });
    } else {
      await updateModule.mutateAsync(values);
    }
  }

  const saving = createModule.isLoading || updateModule.isLoading;
  const SelectedIcon = getIconByKey(form.module_icon);

  return (
    <div>
      <p><Link to="/modules">← Modules</Link></p>
      <h1>{isNew ? 'New module' : 'Edit module'}</h1>

      <div>
        <label>Title</label>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Content</label>
        <BlockEditor blocks={blocks} onChange={setBlocks} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Excerpt</label>
        <textarea
          rows={3}
          value={form.excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Module icon </label>
        <select value={form.module_icon} onChange={(e) => set('module_icon', e.target.value)}>
          <option value="">Default (book)</option>
          {Object.entries(ICON_OPTIONS).map(([key, opt]) => (
            <option key={key} value={key}>{opt.label}</option>
          ))}
        </select>
        <span style={{ marginLeft: '0.75rem', verticalAlign: 'middle' }}>
          <SelectedIcon style={{ fontSize: 24, verticalAlign: 'middle' }} />
        </span>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Hero image </label>
        <button type="button" onClick={() => heroFileRef.current?.click()}>
          {form.module_hero_image ? 'Replace image' : 'Choose image'}
        </button>
        <input
          ref={heroFileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handleHeroUpload}
        />
        {uploadMedia.isLoading && <span> Uploading…</span>}
        {(heroPreview || form.module_hero_image > 0) && (
          <div style={{ marginTop: '0.5rem' }}>
            {heroPreview ? (
              <img src={heroPreview} alt="" style={{ maxWidth: 240, maxHeight: 120 }} />
            ) : (
              <span style={{ color: '#666' }}>Image #{form.module_hero_image} attached</span>
            )}
            {' '}
            <button type="button" onClick={() => { set('module_hero_image', 0); setHeroPreview(''); }}>
              Remove
            </button>
          </div>
        )}
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
