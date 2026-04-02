import { useState } from 'react';
import { useDocuments } from '../hooks/useDocuments';

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const { data: documents, isLoading, isFetching, error } = useDocuments(search);

  // Documents are grouped by category for you to render
  const categories = documents
    ? [...new Set(documents.map((d) => d.meta.document_category || 'General'))]
    : [];

  return (
    <div>
      <h1>Reference Library</h1>

      {/* Search input — wire to your UI */}
      <input
        type="search"
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isFetching && <span> Searching…</span>}

      {isLoading && <p>Loading…</p>}
      {!!error   && <p>Error: {(error as Error).message}</p>}

      {/* Document list grouped by category — wire to your UI */}
      {categories.map((cat) => {
        const docs = documents!.filter(
          (d) => (d.meta.document_category || 'General') === cat
        );
        return (
          <section key={cat}>
            <h2>{cat}</h2>
            <ul>
              {docs.map((d) => (
                <li key={d.id}>
                  <span dangerouslySetInnerHTML={{ __html: d.title }} />
                  {' '}
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">Download</a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!isLoading && documents?.length === 0 && (
        <p>{search ? `No results for "${search}".` : 'No documents available.'}</p>
      )}
    </div>
  );
}
