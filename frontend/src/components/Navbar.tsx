import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { competitionApi } from '../api';
import { bootBrand } from '../branding';
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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { COMPETITION_YEAR } from '../constants/formOptions';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [brand, setBrand] = useState(bootBrand || 'Eval Platform');
  const open = Boolean(menuAnchor);

  useEffect(() => { competitionApi.cached().then((c) => setBrand(c.display_name)).catch(() => {}); }, []);

  const close = () => setMenuAnchor(null);
  const handleLogout = async () => { close(); await logout(); navigate('/login'); };

  return (
    <AppBar position="static">
      <Container>
        <Toolbar disableGutters sx={{ gap: 2, py: 2.5 }}>
          <Typography component={Link} to="/" variant="h5"
            sx={{ fontWeight: 'bold', color: 'inherit', mr: 1, textDecoration: 'none' }}>
            {brand} {COMPETITION_YEAR}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={(e) => setMenuAnchor(e.currentTarget)} aria-haspopup="true"
            sx={{ color: 'inherit', minWidth: 'auto', gap: 1 }}>
            {user && <Box component="span" sx={{ fontWeight: 700, fontSize: '1rem' }}>{user.name || user.email}</Box>}
            <Box component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>Ξ</Box>
          </Button>
          <Menu id="account-menu" anchorEl={menuAnchor} open={open} onClose={close}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem component={Link} to="/" onClick={close}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><HomeIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Home" />
            </MenuItem>
            <MenuItem component={Link} to="/toolkit" onClick={close}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><BuildIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Toolkit" />
            </MenuItem>
            <MenuItem component={Link} to="/benchmark" onClick={close}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><BarChartIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Benchmark" />
            </MenuItem>
            {user?.is_admin && (
              <MenuItem component={Link} to="/admin" onClick={close}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><AdminPanelSettingsIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Admin" />
              </MenuItem>
            )}
            {user && [
              <Divider key="d" />,
              <MenuItem key="a" component={Link} to="/account" onClick={close}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><AccountCircleIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Account" />
              </MenuItem>,
              <MenuItem key="l" onClick={handleLogout}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Logout" />
              </MenuItem>,
            ]}
            {!user && [
              <Divider key="d2" />,
              <MenuItem key="li" component={Link} to="/login" onClick={close}><ListItemText primary="Log in" /></MenuItem>,
              <MenuItem key="su" component={Link} to="/signup" onClick={close}><ListItemText primary="Sign up" /></MenuItem>,
            ]}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
