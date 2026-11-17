import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isCanvasPage = location.pathname === '/tree';

  return (
    <div className={`app-container ${isCanvasPage ? 'canvas-layout' : ''}`}>
      <Header isCanvasPage={isCanvasPage} />
      <main className={`page-body ${isCanvasPage ? 'canvas-page' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};
