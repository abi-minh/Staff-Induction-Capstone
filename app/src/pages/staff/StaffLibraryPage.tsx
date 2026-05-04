import { useState } from 'react';
import {
  Box, Typography, TextField, CircularProgress, Alert, Card, CardContent,
  Button, Divider, InputAdornment,
} from '@mui/material';
import SearchIcon        from '@mui/icons-material/Search';
import DownloadOutlined  from '@mui/icons-material/DownloadOutlined';
import MenuBookOutlined  from '@mui/icons-material/MenuBookOutlined';
import { usePortalDocuments } from '../../hooks/usePortal';

export default function StaffLibraryPage() {
  const [search, setSearch] = useState('');
  const { data: documents, isLoading, isFetching, error } = usePortalDocuments(search);

  const categories = documents
    ? [...new Set(documents.map((d) => d.meta.document_category || 'General'))]
    : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">Reference Library</Typography>

      <TextField
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ maxWidth: 400 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!!error && (
        <Alert severity="error">{(error as Error).message}</Alert>
      )}

      {!isLoading && documents?.length === 0 && (
        <Typography color="text.secondary">
          {search ? `No results for "${search}".` : 'No documents available.'}
        </Typography>
      )}

      {categories.map((cat) => {
        const docs = documents!.filter(
          (d) => (d.meta.document_category || 'General') === cat
        );
        return (
          <Box key={cat}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MenuBookOutlined sx={{ color: 'primary.main' }} />
              <Typography variant="h3">{cat}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {docs.map((d) => (
                <Card key={d.id}>
                  <CardContent
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.5,
                      '&:last-child': { pb: 1.5 },
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 500 }}
                      dangerouslySetInnerHTML={{ __html: d.title }}
                    />
                    {d.fileUrl && (
                      <Button
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        size="small"
                        variant="outlined"
                        endIcon={<DownloadOutlined />}
                      >
                        Download
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
            <Divider sx={{ mt: 3 }} />
          </Box>
        );
      })}

      {isFetching && !isLoading && (
        <Typography variant="caption" color="text.secondary">Searching…</Typography>
      )}
    </Box>
  );
}
