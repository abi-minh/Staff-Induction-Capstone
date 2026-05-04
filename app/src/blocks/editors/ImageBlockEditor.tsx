import { useUploadMedia } from '../../hooks/useDocuments';
import type { ImageBlock } from '../../types';

interface Props {
  block: ImageBlock;
  onChange: (data: ImageBlock['data']) => void;
}

export default function ImageBlockEditor({ block, onChange }: Props) {
  const uploadMedia = useUploadMedia();

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    onChange({ ...block.data, mediaId: media.id, url: media.sourceUrl });
  }

  return (
    <div>
      {block.data.url ? (
        <div>
          <img src={block.data.url} alt={block.data.alt} style={{ maxWidth: '100%', maxHeight: 300 }} />
          <br />
          <button type="button" onClick={() => onChange({ ...block.data, mediaId: 0, url: '' })}>
            Remove image
          </button>
        </div>
      ) : (
        <div>
          <input type="file" accept="image/*" onChange={handleFileSelected} />
          {uploadMedia.isLoading && <span> Uploading…</span>}
        </div>
      )}
      <input
        type="text"
        value={block.data.alt}
        onChange={(e) => onChange({ ...block.data, alt: e.target.value })}
        placeholder="Alt text"
      />
      <input
        type="text"
        value={block.data.caption}
        onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
        placeholder="Caption (optional)"
      />
    </div>
  );
}
