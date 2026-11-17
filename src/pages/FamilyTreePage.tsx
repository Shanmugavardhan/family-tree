import React from 'react';
import { FamilyCanvas } from '../components/canvas/FamilyCanvas';
import { GitFork } from 'lucide-react';

export const FamilyTreePage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header bar */}
      <div
        style={{
          padding: '10px 24px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GitFork size={17} />
          </div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              Chronological Family Tree
            </h1>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              Interactive multi-generational canvas ordered by birth cohorts
            </p>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <FamilyCanvas />
      </div>
    </div>
  );
};
