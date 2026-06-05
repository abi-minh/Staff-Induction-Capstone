import { useState, useRef }                                       from 'react';
import { useDocuments, useCreateDocument, useDeleteDocument, useUploadMedia } from '../hooks/useDocuments';
import type { DocumentFormValues }                                from '../types';

const ROLES = ['staff', 'manager', 'casual', 'all'];

const emptyForm: DocumentFormValues = {
  title: '', status: 'publish', document_category: '',
  document_role_targets: [], document_file_id: 0,
};

export default function DocumentsPage() {
  const { data: documents = [], isLoading, error } = useDocuments();
  const createDoc   = useCreateDocument();
  const deleteDoc   = useDeleteDocument();
  const uploadMedia = useUploadMedia();

  const [form,          setForm]          = useState<DocumentFormValues>(emptyForm);
  const [uploadedName,  setUploadedName]  = useState('');
  const [showForm,      setShowForm]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleRole(role: string) {
    set('document_role_targets',
      form.document_role_targets.includes(role)
        ? form.document_role_targets.filter((r) => r !== role)
        : [...form.document_role_targets, role]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    setUploadedName(file.name);
    setForm((f) => ({ ...f, document_file_id: media.id, title: f.title || media.title }));
  }

  async function handleCreate() {
    await createDoc.mutateAsync(form);
    setForm(emptyForm);
    setUploadedName('');
    setShowForm(false);
  }

  if (isLoading) return <p>Loading…</p>;
  if (error)     return <p>Error: {(error as Error).message}</p>;

  return (
    <div>
      <h1>Reference Documents</h1>
      <button onClick={() => setShowForm((v) => !v)}>
        {showForm ? 'Cancel' : '+ Upload document'}
      </button>

      {/* Upload form — wire to your UI */}
      {showForm && (
        <div>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()}>
              {uploadedName ? uploadedName : 'Choose file'}
            </button>
            <input ref={fileRef} type="file" hidden onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg" />
            {uploadMedia.isLoading && <span> Uploading…</span>}
          </div>

          <div>
            <label>Title </label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div>
            <label>Category </label>
            <input
              placeholder="e.g. HR, Safety, Policies"
              value={form.document_category}
              onChange={(e) => set('document_category', e.target.value)}
            />
          </div>

          <div>
            <label>Visible to roles: </label>
            {ROLES.map((role) => (
              <label key={role} style={{ marginRight: '1rem' }}>
                <input
                  type="checkbox"
                  checked={form.document_role_targets.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {' '}{role}
              </label>
            ))}
          </div>

          <button onClick={handleCreate} disabled={createDoc.isLoading || !form.title}>
            {createDoc.isLoading ? 'Saving…' : 'Save document'}
          </button>
        </div>
      )}

      {/* Document list — wire to your UI */}
      <ul>
        {documents.map((d) => (
          <li key={d.id}>
            <span dangerouslySetInnerHTML={{ __html: d.title }} />
            {' — '}
            {d.meta.document_category || 'No category'}
            {' — '}
            {d.status}
            {' '}
            {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer">View</a>}
            {' '}
            {confirmDelete === d.id ? (
              <>
                <button onClick={() => deleteDoc.mutateAsync(d.id).then(() => setConfirmDelete(null))}>
                  Confirm delete
                </button>
                <button onClick={() => setConfirmDelete(null)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(d.id)}>Delete</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
