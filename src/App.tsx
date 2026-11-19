import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LineageProvider } from './context/LineageContext';
import { AppLayout } from './components/layout/AppLayout';
import { FamilyTreePage } from './pages/FamilyTreePage';
import { PersonProfilePage } from './pages/PersonProfilePage';
import { EditPersonPage } from './pages/EditPersonPage';

const TreeRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} replace />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LineageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              {/* Primary home is the interactive Family Tree */}
              <Route index element={<FamilyTreePage />} />
              <Route path="tree" element={<TreeRedirect />} />
              <Route path="people" element={<Navigate to="/" replace />} />
              <Route path="people/:id" element={<PersonProfilePage />} />
              <Route path="people/:id/edit" element={<EditPersonPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LineageProvider>
    </ThemeProvider>
  );
};
