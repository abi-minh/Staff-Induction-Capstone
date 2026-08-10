import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { useOverdue } from '../hooks/useReports';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OverduePage() {
  const { data: overdue = [], isLoading, error } = useOverdue();

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">Error: {(error as Error).message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RouterLink to="/" style={{ color: '#3f51b5', textDecoration: 'none', fontSize: '1.5rem', lineHeight: 1 }}>←</RouterLink>
        <Typography variant="h1" sx={{ fontSize: '1.9rem' }}>Overdue Trainings</Typography>
      </Box>

      {overdue.length === 0 ? (
        <Typography color="text.secondary">No overdue trainings.</Typography>
      ) : (
        <Paper
          sx={{
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
            maxWidth: 820,
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>Staff</TableCell>
                <TableCell sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>Module</TableCell>
                <TableCell sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>Due date</TableCell>
                <TableCell sx={{ py: 2.25, fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>Not completed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overdue.map((o) => (
                <TableRow
                  key={`${o.userId}-${o.moduleId}`}
                  hover
                  sx={{ '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' } }}
                >
                  <TableCell>
                    <Link component={RouterLink} to={`/staff/${o.userId}`} sx={{ fontWeight: 500 }}>
                      {o.userName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/modules/${o.moduleId}`}>
                      {o.moduleTitle}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ color: 'error.main', fontWeight: 500 }}>
                    {formatDate(o.dueDate)}
                  </TableCell>
                  <TableCell>{o.notCompletedCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
