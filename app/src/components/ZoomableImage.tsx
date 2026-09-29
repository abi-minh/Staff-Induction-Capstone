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
 * The viewer opens with the whole image visible, scaled to fit, and the
 * browser'''s pinch-zoom takes it from there. It loads the full-size file rather
 * than the responsive variant shown inline, so zooming in stays sharp.
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
            Opens showing the whole image, scaled to fit. An earlier version
            rendered it at natural size, reasoning that a fit-to-viewport dialog
            is no bigger than the page behind it — which was wrong twice over:
            the viewer is edge-to-edge and full-height where the inline image is
            boxed in by column padding and card width, and the browser's own
            pinch-zoom magnifies whatever is on screen. Starting at natural size
            meant opening part-way into a large image with no way to get back
            out to the whole thing.

            `src` is still the full-size file, not the responsive variant used
            inline, so pinching in stays sharp.

            Centred with `margin: auto` rather than flex centring: once zoomed,
            a flex-centred child that overflows has its top and left edges
            clipped and unreachable by scrolling.
          */}
          <Box sx={{ height: '100%', overflow: 'auto', display: 'flex' }}>
            <Box
              component="img"
              src={src}
              alt={alt}
              sx={{
                m: 'auto',
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
              }}
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
