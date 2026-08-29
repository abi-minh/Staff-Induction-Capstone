import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Toolbar, Typography, Avatar, ButtonBase, Alert, Button,
} from '@mui/material';
import EditOutlinedIcon            from '@mui/icons-material/EditOutlined';
import MenuBookIcon                from '@mui/icons-material/MenuBookOutlined';
import PeopleAltOutlinedIcon       from '@mui/icons-material/PeopleAltOutlined';
import PlaceOutlinedIcon           from '@mui/icons-material/PlaceOutlined';
import AdminPanelSettingsOutlined  from '@mui/icons-material/AdminPanelSettingsOutlined';
import { useAuthStore }            from '../store/authStore';
import { useAssignedModules }      from '../hooks/usePortal';
import { getModuleIcon }           from '../components/moduleVisuals';
import { stripHtml }               from '../util/strings';
import LogoutOutlinedIcon      from '@mui/icons-material/LogoutOutlined';

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
        onClick={() => navigate(path)}
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
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

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Box
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            py: 2,
            overflowY: 'auto',
          }}
        >
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
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppBar position="sticky">
            <Toolbar>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13 }}>
                  {initials}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
    </Box>
  );
}
