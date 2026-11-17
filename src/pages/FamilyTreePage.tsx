import React from 'react';
import { FamilyCanvas } from '../components/canvas/FamilyCanvas';
import { GitFork } from 'lucide-react';

export const FamilyTreePage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
      {/* Header bar */}
      <div
        style={{
          padding: '12px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GitFork size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Chronological Family Tree
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
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

