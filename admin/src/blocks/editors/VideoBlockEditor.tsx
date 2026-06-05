import { useUploadMedia } from '../../hooks/useDocuments';
import type { VideoBlock } from '../../types';

interface Props {
  block: VideoBlock;
  onChange: (data: VideoBlock['data']) => void;
}

export default function VideoBlockEditor({ block, onChange }: Props) {
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
          <video src={block.data.url} controls style={{ maxWidth: '100%', maxHeight: 300 }} />
          <br />
          <button type="button" onClick={() => onChange({ ...block.data, mediaId: 0, url: '' })}>
            Remove video
          </button>
        </div>
      ) : (
        <div>
          <input type="file" accept="video/*" onChange={handleFileSelected} />
          {uploadMedia.isLoading && <span> Uploading…</span>}
        </div>
      )}
      <input
        type="text"
        value={block.data.caption}
        onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
        placeholder="Caption (optional)"
      />
    </div>
  );
}
