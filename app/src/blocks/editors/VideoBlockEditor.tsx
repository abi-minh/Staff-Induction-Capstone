import { useEffect, useRef, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useUploadMedia } from '../../hooks/useDocuments';
import { MIN_BLOCK_WIDTH } from '../../types';
import type { BlockLayout, VideoBlock } from '../../types';

interface Props {
  block: VideoBlock;
  onChange: (data: VideoBlock['data']) => void;
  layout?: BlockLayout;
  onLayoutChange: (layout: BlockLayout) => void;
}

export default function VideoBlockEditor({ block, onChange, layout, onLayoutChange }: Props) {
  const uploadMedia = useUploadMedia();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [handleLeft, setHandleLeft] = useState(0);

  const width = layout?.width;

  function setWidth(pct: number) {
    onLayoutChange({ ...layout, width: Math.min(100, Math.max(MIN_BLOCK_WIDTH, pct)) });
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setHandleLeft(video.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(video);
    return () => ro.disconnect();
  }, [block.data.url]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadMedia.mutateAsync(file);
    onChange({ ...block.data, mediaId: media.id, url: media.sourceUrl });
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.round(((ev.clientX - rect.left) / rect.width) * 100));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {block.data.url ? (
        <Box>
          <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
            <Box
              component="video"
              ref={videoRef}
              src={block.data.url}
              controls
              sx={{
                display: 'block',
                borderRadius: 1,
                maxWidth: '100%',
                ...(width ? { width: `${width}%` } : null),
              }}
            />
            <Box
              onPointerDown={startResize}
              title="Drag to resize"
              sx={{
                position: 'absolute',
                top: 0,
                left: `${Math.max(0, handleLeft - 12)}px`,
                height: '100%',
                width: 24,
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 44,
                  borderRadius: 999,
                  bgcolor: 'primary.main',
                  color: '#fff',
                  border: '2px solid #fff',
                  boxShadow: 3,
                  transition: 'transform 0.1s',
                  '&:hover': { transform: 'scale(1.12)' },
                }}
              >
                <SwapHorizIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {width ?? 100}% width · drag the handle, or use the width buttons in the toolbar above
            </Typography>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => onChange({ ...block.data, mediaId: 0, url: '' })}
            >
              Remove video
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          <Button
            variant="outlined"
            startIcon={<OndemandVideoOutlinedIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={uploadMedia.isLoading}
            sx={{ borderRadius: '10px' }}
          >
            {uploadMedia.isLoading ? 'Uploading…' : 'Choose video'}
          </Button>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={handleFileSelected} />
        </Box>
      )}

      <TextField
        label="Caption (optional)"
        value={block.data.caption}
        onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
        size="small"
        fullWidth
      />
    </Box>
  );
}
