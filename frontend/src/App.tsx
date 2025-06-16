import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AppHeader from './components/AppBar';
import { GamePage } from './pages/GamePage';
import { AuthForm } from './components/AuthForm';
import PrivateRoute from './hooks/privateRoute';
import { WebSocketProvider } from './context/useWebSocket';

function InnerApp() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route
          path="/board"
          element={
            <PrivateRoute>
              <GamePage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<AuthForm />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <Router>
        <InnerApp />
      </Router>
    </WebSocketProvider>
  );
}
