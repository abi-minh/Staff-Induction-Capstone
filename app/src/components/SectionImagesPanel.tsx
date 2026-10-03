import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, LinearProgress, Paper, Typography } from '@mui/material';
import { copyLinkedSectionImages, countLinkedSectionImages } from '../api/documents';
import type { SectionImageFailure } from '../api/documents';

export default function SectionImagesPanel() {
  const queryClient = useQueryClient();
  const { data: count = 0 } = useQuery({ queryKey: ['section-images-linked'], queryFn: countLinkedSectionImages });
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ copied: number; failed: SectionImageFailure[] } | null>(null);
  const [error, setError] = useState('');

  async function handleCopy() {
    setTotal(count);
    setDone(0);
    setRunning(true);
    setResult(null);
    setError('');
    try {
      setResult(await copyLinkedSectionImages(setDone));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copying stopped part way. Run it again to carry on.');
    } finally {
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: ['section-images-linked'] });
      void queryClient.invalidateQueries({ queryKey: ['modules'] });
      void queryClient.invalidateQueries({ queryKey: ['module'] });
    }
  }

  if (count === 0 && !result && !error) return null;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3, maxWidth: 820 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>Section images on other websites</Typography>
      {count > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {count} section header image{count === 1 ? ' is' : 's are'} linked from another website
            rather than stored here, so exports can&apos;t include {count === 1 ? 'it' : 'them'} and{' '}
            {count === 1 ? 'it disappears' : 'they disappear'} if that website changes. Copying puts each one
            in the media library and points the section at the copy.
          </Typography>
          {running ? (
            <Box>
              <LinearProgress variant="determinate" value={total ? (done / total) * 100 : 0} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Copying… {done} of {total}
              </Typography>
            </Box>
          ) : (
            <Button variant="contained" onClick={handleCopy} sx={{ borderRadius: 999 }}>
              Copy into media library
            </Button>
          )}
        </>
      )}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {result && (
        <Alert severity={result.failed.length ? 'warning' : 'success'} sx={{ mt: 2 }}>
          Copied {result.copied} image{result.copied === 1 ? '' : 's'} into the media library.
          {result.failed.length > 0 && (
            <>
              {' '}{result.failed.length} could not be copied and still link to the other website:
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                {result.failed.map((f) => (
                  <li key={`${f.module}-${f.url}`}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {f.module}: {f.url} ({f.error})
                    </Typography>
                  </li>
                ))}
              </Box>
            </>
          )}
        </Alert>
      )}
    </Paper>
  );
}
