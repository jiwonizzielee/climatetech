import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Overview from './pages/Overview';
import Timeline from './pages/Timeline';
import Collaboration from './pages/Collaboration';
import Forecast from './pages/Forecast';
import Scenarios from './pages/Scenarios';
import Comparison from './pages/Comparison';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Overview />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="collaboration" element={<Collaboration />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="scenarios" element={<Scenarios />} />
          <Route path="comparison" element={<Comparison />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
