import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { register, login, confirmRegister, fetchSession } from '../hooks/auth';

export const AuthForm = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'signup' | 'confirm' | 'signin'>('signup');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    try {
      await register(email, password);
      setMessage(
        'Signup successful! Check your email for the confirmation code.'
      );
      setStep('confirm');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setMessage((err as { message?: string }).message || 'Error signing up');
      } else {
        setMessage('Error signing up');
      }
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmRegister(email, code);
      setMessage('Account confirmed! You can now sign in.');
      setStep('signin');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setMessage(
          (err as { message?: string }).message || 'Error confirming account'
        );
      } else {
        setMessage('Error confirming account');
      }
    }
    setLoading(false);
  };

  const handleSignin = async () => {
    setLoading(true);
    try {
      const response = await login(email, password);
      const session = await fetchSession();
      const idToken = session.tokens?.idToken?.toString();
      console.log(session, 'session');
      localStorage.setItem('token', idToken ?? '');
      localStorage.setItem('isSignedIn', response.isSignedIn.toString());
      localStorage.setItem(
        'userEmail',
        session.tokens?.signInDetails?.loginId ?? ''
      );
      localStorage.setItem('userId', session.userSub ?? '');
      setMessage('Signed in successfully!');
      navigate('/board');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setMessage((err as { message?: string }).message || 'Error signing in');
      } else {
        setMessage('Error signing in');
      }
    }
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {step === 'signup'
            ? 'Sign Up'
            : step === 'signin'
            ? 'Sign In'
            : 'Confirm Account'}
        </Typography>

        <TextField
          label="Email"
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {(step === 'signup' || step === 'signin') && (
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {step === 'confirm' && (
          <TextField
            label="Confirmation Code"
            fullWidth
            margin="normal"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}

        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          onClick={
            step === 'signup'
              ? handleSignup
              : step === 'signin'
              ? handleSignin
              : handleConfirm
          }
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Submit'}
        </Button>

        <Box mt={2}>
          {step === 'signup' && (
            <Button onClick={() => setStep('signin')} size="small">
              Already have an account? Sign In
            </Button>
          )}
          {step === 'signin' && (
            <Button onClick={() => setStep('signup')} size="small">
              No account? Sign Up
            </Button>
          )}
        </Box>

        {message && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};
