import { useState } from 'react';
import {
  Box, ButtonBase, Dialog, IconButton, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SxProps, Theme } from '@mui/material';

interface Props {
  src: string;
  alt: string;
  /**
   * Responsive variants for the inline image. The viewer deliberately ignores
   * these and loads `src`: full size is the whole reason someone opened it.
   */
  srcSet?: string;
  sizes?: string;
  caption?: string;
  /**
   * Sizing and flow for the image's box. Lives on the wrapper rather than the
   * image so that layout is identical whether or not the zoom affordance is
   * active — a percentage width on an image inside a shrink-to-fit button
   * resolves against the button, which is sized by the image, and browsers
   * disagree about what that means.
   */
  wrapperSx?: SxProps<Theme>;
  imgSx?: SxProps<Theme>;
  /**
   * Opt-in. The block renderer is shared with the module editor, where a tap
   * has to select the block rather than open a viewer, so this defaults off.
   */
  enabled?: boolean;
}

/**
 * An image that opens full size when tapped on a phone.
 *
 * Mobile only, by request, and the breakpoint matches the one the layouts
 * already switch on. On a desktop the image renders exactly as it did before —
 * no wrapper button, no handler, nothing to tab through.
 *
 * The viewer shows the image at its natural size inside a scrollable box. That
 * is the whole point: a dialog that constrains the image to the viewport is the
 * same size as the page it was opened from, which solves nothing on a 375px
 * screen. Panning a full-size image is what lets someone actually read a
 * diagram.
 */
export default function ZoomableImage({
  src, alt, srcSet, sizes, caption, wrapperSx, imgSx, enabled = false,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);

  const image = (
    <Box
      component="img"
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      sx={{ display: 'block', width: '100%', height: 'auto', ...imgSx }}
    />
  );

  if (!enabled || !isMobile) {
    return <Box sx={wrapperSx}>{image}</Box>;
  }

  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        // The image's own alt would be read twice otherwise; an empty alt
        // (quiz images carry one) still needs the control to announce itself.
        aria-label={alt ? `View ${alt} at full size` : 'View image at full size'}
        sx={{ ...wrapperSx, cursor: 'zoom-in', textAlign: 'inherit' }}
      >
        {image}
      </ButtonBase>

      <Dialog open={open} onClose={() => setOpen(false)} fullScreen>
        <Box sx={{ position: 'relative', height: '100%', bgcolor: 'common.black' }}>
          <IconButton
            onClick={() => setOpen(false)}
            aria-label="Close image"
            sx={{
              position: 'absolute', top: 8, right: 8, zIndex: 1,
              color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          {/*
            Centred with `margin: auto` rather than flex centring: a flex-centred
            child that overflows its container has its top and left edges
            clipped and unreachable by scrolling, which would hide exactly the
            part of a large image someone opened this to see.
          */}
          <Box sx={{ height: '100%', overflow: 'auto', display: 'flex' }}>
            <Box
              component="img"
              src={src}
              alt={alt}
              sx={{ m: 'auto', display: 'block', maxWidth: 'none' }}
            />
          </Box>

          {caption && (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                p: 1.5, color: 'common.white', bgcolor: 'rgba(0, 0, 0, 0.55)',
              }}
            >
              {caption}
            </Typography>
          )}
        </Box>
      </Dialog>
    </>
  );
}
