import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RBACProvider } from './contexts/RBACContext';
import { DemoProvider } from './contexts/DemoContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <DemoProvider>
      <RBACProvider>
        <App />
      </RBACProvider>
    </DemoProvider>
  </React.StrictMode>
);
