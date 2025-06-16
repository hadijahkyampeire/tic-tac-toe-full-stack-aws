import { AppBar, Button, Toolbar, Typography } from '@mui/material';
import ThemeToggleButton from './ThemeButton';
import { signOut } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import { closeSocket } from '../lib/websocket';

export default function AppHeader() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = async () => {
    try {
      closeSocket();
      await signOut();
      localStorage.clear();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Tic Tac Toe - G1
        </Typography>
        {token && (
          <Button color="secondary" variant="contained" onClick={handleLogout}>
            Log out
          </Button>
        )}
        <ThemeToggleButton />
      </Toolbar>
    </AppBar>
  );
}
