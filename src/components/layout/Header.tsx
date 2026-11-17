import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, UserPlus, Heart } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Overview & Analytics';
    if (path === '/people') return 'Family Directory';
    if (path === '/people/new') return 'Add New Family Member';
    if (path.endsWith('/edit')) return 'Edit Member Information';
    if (path.startsWith('/people/')) return 'Person Profile & Kinship';
    return 'Konukuru Family';
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            color: 'var(--color-slate-600)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
          {getPageTitle()}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginRight: 8 }}>
          <Heart size={15} color="#e11d48" fill="#e11d48" />
          <span>Active Lineage</span>
        </div>
        <Link to="/people/new" className="btn btn-primary btn-sm">
          <UserPlus size={16} />
          <span>Add Member</span>
        </Link>
      </div>
    </header>
  );
};

