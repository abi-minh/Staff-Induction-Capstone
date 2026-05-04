import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useAuthStore } from '../store/authStore';

export default function AdminLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div>
      <nav style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <NavLink to="/">Dashboard</NavLink>
        {' | '}
        <NavLink to="/modules">Modules</NavLink>
        {' | '}
        <NavLink to="/documents">Documents</NavLink>
        {' | '}
        <NavLink to="/staff">Staff</NavLink>
        {' | '}
        <NavLink to="/reports">Reports</NavLink>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{user?.name}</span>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityOutlined />}
            onClick={() => navigate('/portal')}
          >
            Staff View
          </Button>
          <button onClick={clearAuth}>Sign out</button>
        </span>
      </nav>
      <main style={{ padding: '24px 16px' }}>
        <Outlet />
      </main>
    </div>
  );
}
