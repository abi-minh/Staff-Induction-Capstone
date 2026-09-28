import { useState } from 'react';
import {
  Box, Typography, ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ScheduleOutlined    from '@mui/icons-material/ScheduleOutlined';
import { useAssignedModules, useMyAssignments, useUserProgress } from '../../hooks/usePortal';
import { formatDueDate } from '../../util/dates';
import { useAuthStore }  from '../../store/authStore';
import ModuleCard        from '../../components/ModuleCard';

type View = 'all' | 'completed' | 'todo';

export default function StaffDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<View>('all');

  const { data: modules, isLoading, error } = useAssignedModules();
  const { data: progress = [] }             = useUserProgress();
  const { data: assignments = [] }          = useMyAssignments();

  // Due dates live on the assignment row, not the module: the module sets a
  // duration and the date is fixed per person when they are assigned, so the
  // same module can fall due on different days for different people.
  const dueDates = new Map(assignments.map((a) => [a.moduleId, a.dueDate]));

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
      {/* h1 is 700 by default; the greeting is dialled back so the name is the
          part that carries weight. */}
      <Typography variant="h1" sx={{ fontWeight: 400 }}>
        Welcome Back, <Box component="span" sx={{ fontWeight: 700 }}>{user?.name}</Box>
      </Typography>

      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, next) => next && setView(next)}
        sx={{
          gap: { xs: 1, sm: 1.5 },
          flexWrap: 'wrap',
          '&& .MuiToggleButtonGroup-grouped': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 999,
            marginLeft: 0,
            px: { xs: 1.5, sm: 2.5 },
            py: 0.75,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: { xs: 13, sm: 14 },
            whiteSpace: 'nowrap',
            // Scoped away from the selected pill. The group rule and each button's
            // '&&.Mui-selected' both land on three classes, so the winner came
            // down to emotion's insertion order — and the group won, painting
            // slate text onto a solid primary fill. Excluding the selected
            // state removes the race instead of out-specifying it.
            '&:not(.Mui-selected)': { color: 'text.secondary' },
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))',
            maxWidth: 1400,
            // Left-aligned, not centred: the cap only bites on a wide monitor,
            // and centring there pushed the grid away from the page heading and
            // the filter pills, which stay left.
            mr: 'auto',
            width: '100%',
          }}
        >
          {filtered.map((m) => {
            const p = progress.find((r) => r.moduleId === m.id);
            // Empty string when the module has no duration set, which
            // ModuleCard treats as "no deadline" and hides the chip.
            return (
              <ModuleCard
                key={m.id}
                module={m}
                progress={p}
                dueDate={formatDueDate(dueDates.get(m.id))}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}
