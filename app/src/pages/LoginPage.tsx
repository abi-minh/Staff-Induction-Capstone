import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CircularProgress, TextField, Typography,
} from '@mui/material';
import { login, fetchCurrentUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';

function isAdminRole(roles: string[]): boolean {
  return roles.some((r) => ['administrator', 'induction_admin'].includes(r));
}

export default function LoginPage() {
  const navigate       = useNavigate();
  const setAuth        = useAuthStore((s) => s.setAuth);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await login(username, password);
      const user  = await fetchCurrentUser(token.token);
      setAuth(token.token, user);
      // Clear the spinner before navigating, not in a finally that runs after
      // it: if rendering the destination ever throws or hangs, a stranded
      // spinner on a painted login card is indistinguishable from a hung
      // browser, which is how this failure was reported.
      setLoading(false);
      navigate(isAdminRole(user.roles) ? '/' : '/portal', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400, p: 4 }}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            2 BENT RODS
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sign in to continue
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            id="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            fullWidth
            required
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            required
          />

          {error && <Alert severity="error">{error}</Alert>}
          {!error && sessionExpired && (
            <Alert severity="info">
              Your session ended. Please sign in again.
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            fullWidth
            sx={{ mt: 1, py: 1.2 }}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
