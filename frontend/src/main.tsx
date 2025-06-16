import './amplifyConfig';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { CustomThemeProvider } from './context/themeContext.tsx';

createRoot(document.getElementById('root')!).render(
  <CustomThemeProvider>
    <App />
  </CustomThemeProvider>
);
