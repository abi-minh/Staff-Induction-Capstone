import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Toolbar, Typography, Avatar, ButtonBase, Alert, Button, Drawer, IconButton,
} from '@mui/material';
import MenuIcon                   from '@mui/icons-material/Menu';
import EditOutlinedIcon            from '@mui/icons-material/EditOutlined';
import MenuBookIcon                from '@mui/icons-material/MenuBookOutlined';
import PeopleAltOutlinedIcon       from '@mui/icons-material/PeopleAltOutlined';
import PlaceOutlinedIcon           from '@mui/icons-material/PlaceOutlined';
import ManageAccountsOutlinedIcon  from '@mui/icons-material/ManageAccountsOutlined';
import AdminPanelSettingsOutlined  from '@mui/icons-material/AdminPanelSettingsOutlined';
import LogoutOutlinedIcon          from '@mui/icons-material/LogoutOutlined';
import { useAuthStore }            from '../store/authStore';
import { useAssignedModules }      from '../hooks/usePortal';
import { getModuleIcon }           from '../components/moduleVisuals';
import { stripHtml }               from '../util/strings';

const DRAWER_WIDTH = 200;

function isAdminUser(roles: string[]): boolean {
  return roles.some((r) => ['administrator', 'induction_admin'].includes(r));
}

export default function StaffLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { data: modules } = useAssignedModules();
  const isAdmin = isAdminUser(user?.roles ?? []);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function renderNavItem(
    label: string,
    path: string,
    Icon: React.ElementType,
    key?: string
  ) {
    const active = location.pathname === path;
    return (
      <ButtonBase
        key={key ?? path}
        onClick={() => { navigate(path); setMobileOpen(false); }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.75,
          py: 1.25,
          borderRadius: '10px',
          justifyContent: 'flex-start',
          textAlign: 'left',
          bgcolor: active ? 'primary.main' : 'transparent',
          color: active ? 'white' : 'text.primary',
          fontWeight: active ? 600 : 500,
          '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover' },
        }}
      >
        <Icon sx={{ fontSize: 26, color: active ? 'white' : 'text.primary' }} />
        <Typography
          variant="body2"
          sx={{
            color: 'inherit',
            fontWeight: 'inherit',
            fontSize: 14,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Typography>
      </ButtonBase>
    );
  }

  const navContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: 1.5 }}>
      {renderNavItem('Dashboard', '/portal', EditOutlinedIcon)}

      {modules?.map((m) => {
        const path = `/portal/training/${m.id}`;
        const Icon = getModuleIcon(m);
        const label = stripHtml(m.title);
        return renderNavItem(label, path, Icon, String(m.id));
      })}

      {renderNavItem('Resources', '/portal/library', MenuBookIcon)}
      {renderNavItem('Locations', '/portal/locations', PlaceOutlinedIcon)}
      {renderNavItem('Meet Our Team', '/portal/team', PeopleAltOutlinedIcon)}
      {renderNavItem('Account Settings', '/portal/account', ManageAccountsOutlinedIcon)}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {isAdmin && (
        <Alert
          severity="info"
          sx={{ borderRadius: 0, flexShrink: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<AdminPanelSettingsOutlined />}
              onClick={() => navigate('/')}
            >
              Return to Admin
            </Button>
          }
        >
          <strong>Admin Preview Mode</strong> — you are viewing the staff portal.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
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
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', py: 2, pt: 'calc(16px + env(safe-area-inset-top, 0px))' },
          }}
        >
          {navContent}
        </Drawer>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppBar position="static" sx={{ flexShrink: 0, pt: 'env(safe-area-inset-top, 0px)' }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

          <Box component="main" sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
