import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PeoplePage } from './pages/PeoplePage';
import { AddPersonPage } from './pages/AddPersonPage';
import { EditPersonPage } from './pages/EditPersonPage';
import { PersonProfilePage } from './pages/PersonProfilePage';
import { FamilyTreePage } from './pages/FamilyTreePage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tree" element={<FamilyTreePage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="people/new" element={<AddPersonPage />} />
          <Route path="people/:id" element={<PersonProfilePage />} />
          <Route path="people/:id/edit" element={<EditPersonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
