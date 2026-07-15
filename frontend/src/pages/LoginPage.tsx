import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container, Box, Card, CardHeader, CardContent, TextField, Button, Alert, Typography, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container sx={{ pt: 8, pb: 8 }}>
      <Grid container spacing={5} alignItems="center" justifyContent="center">
        <Grid size={{ xs: 12, sm: 8, md: 5 }}>
          <Card elevation={6}>
            <CardHeader title="Log in" sx={{ bgcolor: 'grey.50', py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }} />
            <CardContent sx={{ p: 4 }}>
              {error && <Alert severity="warning" onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert>}
              <Box component="form" onSubmit={submit}>
                <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} sx={{ mb: 3 }} />
                <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} sx={{ mb: 3 }} />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? 'Logging in…' : 'Log in'}
                </Button>
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Typography variant="body2">
                    Don't have an account? <Link to="/signup" style={{ textDecoration: 'none' }}>Sign up.</Link>
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
