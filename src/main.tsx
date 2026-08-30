import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { TransformCalibrationProvider } from './context/TransformCalibrationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <TransformCalibrationProvider>
          <App />
        </TransformCalibrationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
