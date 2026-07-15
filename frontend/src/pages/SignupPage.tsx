import { useState } from 'react';
import { Paper, Box, TextField, Button, Typography, Alert, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await signup(email, password);
      setMsg('Account created. The first account is an enabled admin; later accounts await admin approval.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Signup failed');
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto' }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Sign up</Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {msg && <Alert severity="success">{msg}</Alert>}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" size="large">Create account</Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
