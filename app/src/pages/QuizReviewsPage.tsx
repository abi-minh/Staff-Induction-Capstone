import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Link, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import { usePendingQuizReviews } from '../hooks/useQuizReviews';

export default function QuizReviewsPage() {
  const { data: reviews = [], isLoading, error } = usePendingQuizReviews();

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">Error: {(error as Error).message}</Alert>;

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 0.5 }}>Quiz Reviews</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Module-level quiz submissions awaiting grading.
      </Typography>

      <Paper
        sx={{
          overflow: 'hidden',
          boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              {['Staff', 'Module', 'Submitted', ''].map((label) => (
                <TableCell key={label} sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {reviews.map((r) => (
              <TableRow
                key={`${r.userId}-${r.moduleId}`}
                hover
                sx={{ '& td': { py: 1.5, fontSize: '1.02rem', borderBottom: '1px solid', borderColor: 'divider' } }}
              >
                <TableCell>
                  <Link component={RouterLink} to={`/staff/${r.userId}`} sx={{ fontWeight: 500 }}>
                    {r.userName}
                  </Link>
                </TableCell>
                <TableCell>{r.moduleTitle || '(Untitled)'}</TableCell>
                <TableCell>{new Date(r.quizSubmittedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Button
                    component={RouterLink}
                    to={`/quiz-reviews/${r.userId}/${r.moduleId}`}
                    size="small"
                    variant="contained"
                    startIcon={<RateReviewOutlinedIcon />}
                    sx={{ borderRadius: '10px' }}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {!reviews.length && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 6 }}>
                  <Typography color="text.secondary">Nothing awaiting review.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
