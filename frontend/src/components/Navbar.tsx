import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { competitionApi } from '../api';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import BuildIcon from '@mui/icons-material/Build';
import BarChartIcon from '@mui/icons-material/BarChart';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [title, setTitle] = useState('Eval Platform');
  const open = Boolean(menuAnchor);

  useEffect(() => { competitionApi.info().then((c) => setTitle(c.display_name)).catch(() => {}); }, []);

  const close = () => setMenuAnchor(null);
  const handleLogout = async () => { close(); await logout(); navigate('/login'); };

  const item = (to: string, label: string, Icon: typeof HomeIcon) => (
    <MenuItem component={Link} to={to} onClick={close}>
      <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><Icon fontSize="small" /></ListItemIcon>
      <ListItemText primary={label} />
    </MenuItem>
  );

  return (
    <AppBar position="static" sx={{ bgcolor: 'white', color: '#2c3e50', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <Container>
        <Toolbar disableGutters sx={{ gap: 2, py: 2.5 }}>
          <Typography component={Link} to="/" variant="h5"
            sx={{ fontWeight: 'bold', color: '#2c3e50', mr: 1, textDecoration: 'none' }}>
            {title}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {user ? (
            <>
              <Button onClick={(e) => setMenuAnchor(e.currentTarget)} aria-haspopup="true"
                sx={{ color: '#2c3e50', minWidth: 'auto', gap: 1 }}>
                <Box component="span" sx={{ fontWeight: 700 }}>{user.email}</Box>
                <Box component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>Ξ</Box>
              </Button>
              <Menu id="account-menu" anchorEl={menuAnchor} open={open} onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                {item('/', 'Home', HomeIcon)}
                {item('/tools', 'Tools', BuildIcon)}
                {item('/benchmarks', 'Benchmarks', BarChartIcon)}
                {item('/tasks', 'Tasks', PlaylistPlayIcon)}
                {item('/scoreboard', 'Scoreboard', EmojiEventsIcon)}
                {user.is_admin && item('/admin', 'Admin', AdminPanelSettingsIcon)}
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Logout" />
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button component={Link} to="/login" sx={{ color: '#2c3e50' }}>Log in</Button>
              <Button component={Link} to="/signup" variant="contained">Sign up</Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
