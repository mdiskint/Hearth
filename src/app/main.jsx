import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import { AuthProvider } from '../context/AuthContext';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
