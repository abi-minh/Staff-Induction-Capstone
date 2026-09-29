import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, CardMedia, Box, Chip, Typography, Button,
  LinearProgress,
} from '@mui/material';
import CalendarTodayIcon  from '@mui/icons-material/CalendarTodayOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import ArrowForwardIcon   from '@mui/icons-material/ArrowForward';
import type { Module, ProgressRecord } from '../types';
import { getModuleHero, getModuleIcon } from './moduleVisuals';
import { stripHtml }                     from '../util/strings';

interface Props {
  module:    Module;
  progress?: ProgressRecord;
  dueDate?:  string;
  /**
   * How far through the module this person is, 0-100. Passed in rather than
   * derived from `status`, which only knows "started": this card used to report
   * a flat 60% for every in-progress module, so three sections done out of ten
   * and nine out of ten looked identical.
   */
  percentComplete?: number;
}

export default function ModuleCard({ module, progress, dueDate, percentComplete = 0 }: Props) {
  const navigate    = useNavigate();
  const status      = progress?.status ?? 'not_started';
  const completed   = status === 'completed';
  const Icon        = getModuleIcon(module);
  const heroUrl     = getModuleHero(module);
  const excerpt = stripHtml(module.excerpt);

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {heroUrl && (
        <CardMedia
          component="img"
          image={heroUrl}
          alt=""
          sx={{ height: 185, objectFit: 'cover', flexShrink: 0 }}
        />
      )}

      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Icon sx={{ fontSize: 28, color: 'primary.main', mt: 0.25 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h2"
              sx={{ lineHeight: 1.2 }}
              dangerouslySetInnerHTML={{ __html: module.title }}
            />
            {excerpt && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {excerpt}
              </Typography>
            )}
          </Box>
        </Box>


      </CardContent>

      <Box sx={{ flexGrow: 1 }} />

      <CardContent sx={{ pt: 0, pb: 2 }}>
        {dueDate && (
          <Chip
            icon={<CalendarTodayIcon sx={{ fontSize: 18 }} />}
            label={`Due: ${dueDate}`}
            variant="outlined"
            sx={{
              bgcolor: 'transparent',
              color: 'chipDue.fg',
              borderColor: 'chipDue.fg',
              borderRadius: 999,
              fontWeight: 500,
              fontSize: 14,
              height: 32,
              mb: 1.5,
              px: 1,
              '& .MuiChip-icon': { color: 'chipDue.fg' },
            }}
          />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
            {percentComplete}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentComplete}
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: 'divider',
            '& .MuiLinearProgress-bar': { bgcolor: 'success.main' },
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            endIcon={<VisibilityOutlined />}
            onClick={() => navigate(`/portal/training/${module.id}`)}
            sx={{ borderColor: 'divider', flexGrow: 1, color: 'text.primary' }}
          >
            Review
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate(`/portal/training/${module.id}`)}
            sx={{ flexGrow: 1 }}
          >
            {completed ? 'Revisit' : 'Attempt Now'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
