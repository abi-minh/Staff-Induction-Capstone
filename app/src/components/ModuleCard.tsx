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
  /**
   * The first section this person has not finished, or null when there is
   * nothing left to do. Passed in rather than worked out here: the dashboard
   * already parses the module's sections to produce `percentComplete`, and
   * doing it twice invites the two answers to drift apart.
   */
  nextSectionId?: string | null;
}

export default function ModuleCard({
  module, progress, dueDate, percentComplete = 0, nextSectionId = null,
}: Props) {
  const navigate    = useNavigate();
  const status      = progress?.status ?? 'not_started';
  const completed   = status === 'completed';
  // Opening a module records it as in_progress, so someone who looked at the
  // overview and backed out is "started" as far as the database is concerned.
  // There is nothing to continue to in that case, and offering Continue over
  // Start Module would be the same journey under a word that promises you are
  // picking something back up. Presentation only — the stored status, and so
  // everything reporting says, is untouched.
  const started     = !completed
    && status !== 'not_started'
    && (progress?.completedSections?.length ?? 0) > 0;
  const Icon        = getModuleIcon(module);
  const heroUrl     = getModuleHero(module);
  const excerpt = stripHtml(module.excerpt);

  const openPath = `/portal/training/${module.id}`;
  // Nothing unfinished means nothing to resume to — someone who has read every
  // section but not yet pressed "Mark as complete" belongs on the overview,
  // which is where that button is.
  const resumePath = nextSectionId
    ? `${openPath}?section=${encodeURIComponent(nextSectionId)}`
    : openPath;

  const primaryPath  = started ? resumePath : openPath;
  const primaryLabel = completed ? 'Revisit' : started ? 'Continue' : 'Start Module';

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

        {/* One button unless there is somewhere else worth going. Review and
            Attempt Now both opened the module overview, so the card offered a
            choice between two identical destinations.

            A module in progress is the exception: Continue skips the overview
            and resumes at the first unfinished section, which is only
            knowable now that section completion lives on the progress record
            rather than in one browser's localStorage. A first attempt still
            lands on the overview, where the description, the section list and
            the due date are — the context you want exactly once. */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          {started && (
            <Button
              variant="outlined"
              color="inherit"
              endIcon={<VisibilityOutlined />}
              onClick={() => navigate(openPath)}
              sx={{ borderColor: 'divider', flexGrow: 1, color: 'text.primary' }}
            >
              Overview
            </Button>
          )}
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate(primaryPath)}
            sx={{ flexGrow: 1 }}
          >
            {primaryLabel}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
