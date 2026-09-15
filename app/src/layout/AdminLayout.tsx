import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Avatar, Badge, Box, ButtonBase, Drawer, IconButton, Toolbar, Typography, Button,
} from '@mui/material';
import MenuIcon               from '@mui/icons-material/Menu';
import DashboardOutlinedIcon   from '@mui/icons-material/DashboardOutlined';
import SchoolOutlinedIcon      from '@mui/icons-material/SchoolOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PeopleOutlinedIcon      from '@mui/icons-material/PeopleOutlined';
import BadgeOutlinedIcon       from '@mui/icons-material/BadgeOutlined';
import PlaceOutlinedIcon       from '@mui/icons-material/PlaceOutlined';
import BackupOutlinedIcon      from '@mui/icons-material/BackupOutlined';
import BarChartOutlinedIcon    from '@mui/icons-material/BarChartOutlined';
import RateReviewOutlinedIcon  from '@mui/icons-material/RateReviewOutlined';
import VisibilityOutlinedIcon  from '@mui/icons-material/VisibilityOutlined';
import LogoutOutlinedIcon      from '@mui/icons-material/LogoutOutlined';
import { useAuthStore }        from '../store/authStore';
import { usePendingQuizReviews } from '../hooks/useQuizReviews';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/',             Icon: DashboardOutlinedIcon },
  { label: 'Modules',       path: '/modules',      Icon: SchoolOutlinedIcon },
  { label: 'Documents',     path: '/documents',    Icon: DescriptionOutlinedIcon },
  { label: 'Staff',         path: '/staff',        Icon: PeopleOutlinedIcon },
  { label: 'Staff Roles',   path: '/staff-roles',  Icon: BadgeOutlinedIcon },
  { label: 'Locations',     path: '/locations',    Icon: PlaceOutlinedIcon },
  { label: 'Backup',        path: '/backup',       Icon: BackupOutlinedIcon },
  { label: 'Quiz Reviews',  path: '/quiz-reviews', Icon: RateReviewOutlinedIcon },
  { label: 'Reports',       path: '/reports',      Icon: BarChartOutlinedIcon },
];

export default function AdminLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingReviews } = usePendingQuizReviews();
  const pendingCount = pendingReviews?.length ?? 0;

  const initials = (user?.name ?? 'A')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function go(path: string) {
    navigate(path);
    setMobileOpen(false);
  }

  const navContent = (
    <>
      <Box sx={{ px: 2.5, mb: 3 }}>
        {/*REPLACE WITH LOGO*/}
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
          2 BENT RODS
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Admin Panel
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1.5, flexGrow: 1 }}>
        {NAV_ITEMS.map(({ label, path, Icon }) => {
          // Match the exact path or a real sub-route (path + "/...") only —
          // a plain startsWith would also match "/staff-roles" for the
          // "/staff" item, since one path string literally starts with
          // the other despite being unrelated routes.
          const active = path === '/'
            ? location.pathname === '/'
            : location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <ButtonBase
              key={path}
              onClick={() => go(path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.75,
                py: 1.25,
                borderRadius: '10px',
                justifyContent: 'flex-start',
                textAlign: 'left',
                width: '100%',
                bgcolor: active ? 'primary.main' : 'transparent',
                color: active ? 'white' : 'text.primary',
                fontWeight: active ? 600 : 500,
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover' },
              }}
            >
              <Badge
                badgeContent={label === 'Quiz Reviews' ? pendingCount : 0}
                color="warning"
                invisible={label !== 'Quiz Reviews' || pendingCount === 0}
              >
                <Icon sx={{ fontSize: 22, color: 'inherit' }} />
              </Badge>
              <Typography
                variant="body2"
                sx={{ color: 'inherit', fontWeight: 'inherit', fontSize: 14 }}
              >
                {label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          py: 2,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {navContent}
      </Box>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            py: 2,
            pt: 'calc(16px + env(safe-area-inset-top, 0px))',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {navContent}
        <Box sx={{ px: 1.5, pb: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
          <ButtonBase
            onClick={() => go('/portal')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.75,
              py: 1.25,
              borderRadius: '10px',
              justifyContent: 'flex-start',
              width: '100%',
              color: 'text.primary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <VisibilityOutlinedIcon sx={{ fontSize: 22 }} />
            <Typography variant="body2" sx={{ fontSize: 14, fontWeight: 500 }}>
              Staff View
            </Typography>
          </ButtonBase>
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky" sx={{ pt: 'env(safe-area-inset-top, 0px)' }}>
          <Toolbar>
            <IconButton
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              edge="start"
              sx={{ display: { xs: 'inline-flex', md: 'none' }, mr: 1, color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<VisibilityOutlinedIcon />}
                onClick={() => navigate('/portal')}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Staff View
              </Button>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13 }}>
                {initials}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
                {user?.name}
              </Typography>
              <Button
                size="small"
                color="inherit"
                startIcon={<LogoutOutlinedIcon />}
                onClick={clearAuth}
                sx={{ color: 'text.secondary' }}
              >
                Sign out
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
