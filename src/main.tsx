import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { TransformCalibrationProvider } from './context/TransformCalibrationContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <TransformCalibrationProvider>
        <App />
      </TransformCalibrationProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
