import { AppBar, Toolbar, Box, Button, Typography, Container } from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { competitionApi } from '../api';

function NavButton({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Button component={RouterLink} to={to} size="small"
      color={active ? 'primary' : 'inherit'} variant={active ? 'contained' : 'text'}>
      {label}
    </Button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('Eval Platform');

  useEffect(() => { competitionApi.info().then((c) => setTitle(c.display_name)).catch(() => {}); }, []);

  return (
    <AppBar position="sticky">
      <Container>
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <Typography component={RouterLink} to="/" variant="h6"
            sx={{ textDecoration: 'none', color: 'text.primary', fontWeight: 700, mr: 2 }}>
            {title}
          </Typography>
          {user && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <NavButton to="/tools" label="Tools" />
              <NavButton to="/benchmarks" label="Benchmarks" />
              <NavButton to="/tasks" label="Tasks" />
              <NavButton to="/scoreboard" label="Scoreboard" />
              {user.is_admin && <NavButton to="/admin" label="Admin" />}
            </Box>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {user ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>{user.email}</Typography>
              <Button size="small" variant="outlined" onClick={async () => { await logout(); navigate('/login'); }}>
                Log out
              </Button>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <NavButton to="/login" label="Log in" />
              <Button component={RouterLink} to="/signup" size="small" variant="contained">Sign up</Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
