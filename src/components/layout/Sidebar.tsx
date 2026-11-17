import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitFork, Users, UserPlus, Sparkles, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {isOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 35, display: 'block' }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-slate-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.2rem',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
              }}
            >
              🌳
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                Konukuru Tree
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 500 }}>
                Family Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: 4, display: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ padding: '20px 16px', flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 10px' }}>
            Navigation
          </div>
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/tree"
            onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <GitFork size={20} />
            <span>Interactive Tree</span>
          </NavLink>

          <NavLink
            to="/people"
            end
            onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Users size={20} />
            <span>Family Members</span>
          </NavLink>

          <NavLink
            to="/people/new"
            onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <UserPlus size={20} />
            <span>Add Member</span>
          </NavLink>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--color-slate-200)', background: 'var(--color-slate-50)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-slate-600)', fontSize: '0.8125rem' }}>
            <Sparkles size={16} color="var(--color-primary)" />
            <span>Phase 3: Chronological Tree</span>
          </div>
        </div>
      </aside>
    </>
  );
};

