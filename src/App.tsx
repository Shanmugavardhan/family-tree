import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { PeoplePage } from './pages/PeoplePage';
import { AddPersonPage } from './pages/AddPersonPage';
import { EditPersonPage } from './pages/EditPersonPage';
import { PersonProfilePage } from './pages/PersonProfilePage';
import { FamilyTreePage } from './pages/FamilyTreePage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/tree" replace />} />
            <Route path="tree" element={<FamilyTreePage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/new" element={<AddPersonPage />} />
            <Route path="people/:id" element={<PersonProfilePage />} />
            <Route path="people/:id/edit" element={<EditPersonPage />} />
            <Route path="*" element={<Navigate to="/tree" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};
