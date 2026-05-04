import { Box, Typography, Chip } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarTodayOutlined';
import AccessTimeIcon    from '@mui/icons-material/AccessTimeOutlined';
import { getModuleHero } from './moduleVisuals';
import { stripHtml }     from '../util/strings';
import type { Module }   from '../types';

interface Props {
  module:    Module;
  subtitle?: string;
  dueDate?:  string;
  minutes?:  number;
}

export default function HeroBanner({ module, subtitle, dueDate, minutes }: Props) {
  const plainTitle    = stripHtml(module.title);
  const plainSubtitle = stripHtml(subtitle ?? '');
  const heroUrl       = getModuleHero(module);

  const background = heroUrl
    ? { backgroundImage: `url(${heroUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { bgcolor: 'primary.main' };

  return (
    <Box
      sx={{
        position: 'relative',
        height: 240,
        borderRadius: 3,
        overflow: 'hidden',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        p: { xs: 3, md: 4 },
        ...background,
      }}
    >
      {heroUrl && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="h1" sx={{ color: 'white' }}>
          {plainTitle}
        </Typography>
        {plainSubtitle && (
          <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
            {plainSubtitle}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
          {dueDate && (
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 16 }} />}
              label={`Due by ${dueDate}`}
              sx={{ bgcolor: 'chipDue.bg', color: 'chipDue.fg', fontWeight: 500 }}
            />
          )}
          {minutes && minutes > 0 && (
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
              label={`About ${minutes} minutes to complete`}
              sx={{ bgcolor: 'chipInfo.bg', color: 'chipInfo.fg', fontWeight: 500 }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
