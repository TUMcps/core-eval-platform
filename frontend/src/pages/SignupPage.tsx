import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container, Box, Card, CardHeader, CardContent, TextField, Button, Alert, Typography, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      await signup(name, email, password);
      setMsg('Account created. The first account is an enabled admin; later accounts await admin approval.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container sx={{ pt: 8, pb: 8 }}>
      <Grid container spacing={5} alignItems="center" justifyContent="center">
        <Grid size={{ xs: 12, sm: 8, md: 5 }}>
          <Card elevation={6}>
            <CardHeader title="Sign up" sx={{ bgcolor: 'grey.50', py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }} />
            <CardContent sx={{ p: 4 }}>
              {error && <Alert severity="warning" onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert>}
              {msg && <Alert severity="success" sx={{ mb: 3 }}>{msg}</Alert>}
              <Box component="form" onSubmit={submit}>
                <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} sx={{ mb: 3 }} />
                <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} sx={{ mb: 3 }} />
                <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} sx={{ mb: 3 }} />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </Button>
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Typography variant="body2">
                    Already have an account? <Link to="/login" style={{ textDecoration: 'none' }}>Log in.</Link>
                  </Typography>
                  <Button component={Link} to="/" variant="outlined" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>Back to home</Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
