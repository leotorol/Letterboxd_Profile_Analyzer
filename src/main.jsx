import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './styles/global.css';
import { DataProvider } from './context/DataProvider';
import App from './App';

// mount this React app to the root DOM node
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <App />
      <Analytics />
    </DataProvider>
  </StrictMode>
);
