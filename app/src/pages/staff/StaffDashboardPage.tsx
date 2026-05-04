import { useState } from 'react';
import {
  Box, Typography, ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ScheduleOutlined    from '@mui/icons-material/ScheduleOutlined';
import { useAssignedModules, useUserProgress } from '../../hooks/usePortal';
import { useAuthStore }  from '../../store/authStore';
import ModuleCard        from '../../components/ModuleCard';

type View = 'all' | 'completed' | 'todo';

export default function StaffDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<View>('all');

  const { data: modules, isLoading, error } = useAssignedModules();
  const { data: progress = [] }             = useUserProgress();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Typography color="error">Error: {(error as Error).message}</Typography>;
  }

  const filtered = (modules ?? []).filter((m) => {
    const status = progress.find((r) => r.moduleId === m.id)?.status ?? 'not_started';
    if (view === 'all')       return true;
    if (view === 'completed') return status === 'completed';
    return status !== 'completed';
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">Welcome Back, {user?.name}</Typography>

      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, next) => next && setView(next)}
        sx={{
          gap: 1.5,
          '&& .MuiToggleButtonGroup-grouped': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 999,
            marginLeft: 0,
            px: 2.5,
            py: 0.75,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 14,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover' },
          },
        }}
      >
        <ToggleButton
          value="all"
          sx={{
            '&&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'white',
              borderColor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
          All Modules
        </ToggleButton>
        <ToggleButton
          value="completed"
          sx={{
            '& .MuiSvgIcon-root': { color: 'success.main' },
            '&&.Mui-selected': {
              bgcolor: 'success.main',
              color: 'white',
              borderColor: 'success.main',
              '& .MuiSvgIcon-root': { color: 'white' },
              '&:hover': { bgcolor: 'success.dark' },
            },
          }}
        >
          <CheckCircleOutlined fontSize="small" sx={{ mr: 0.75 }} />
          Completed
        </ToggleButton>
        <ToggleButton
          value="todo"
          sx={{
            '& .MuiSvgIcon-root': { color: 'warning.main' },
            '&&.Mui-selected': {
              bgcolor: 'warning.main',
              color: 'white',
              borderColor: 'warning.main',
              '& .MuiSvgIcon-root': { color: 'white' },
              '&:hover': { bgcolor: 'warning.dark' },
            },
          }}
        >
          <ScheduleOutlined fontSize="small" sx={{ mr: 0.75 }} />
          To Complete
        </ToggleButton>
      </ToggleButtonGroup>

      {filtered.length === 0 ? (
        <Typography color="text.secondary">
          {view === 'completed'
            ? "You haven't completed any modules yet."
            : view === 'todo'
            ? 'All caught up. Nothing to do.'
            : 'No modules assigned.'}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 4,
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            maxWidth: 1400,
            mx: 'auto',
            width: '100%',
          }}
        >
          {filtered.map((m) => {
            const p = progress.find((r) => r.moduleId === m.id);
            return <ModuleCard key={m.id} module={m} progress={p} dueDate="27/06/26" />;
          })}
        </Box>
      )}
    </Box>
  );
}
