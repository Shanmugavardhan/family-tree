import React from 'react';
import { FamilyCanvas } from '../components/canvas/FamilyCanvas';

export const FamilyTreePage: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <FamilyCanvas />
    </div>
  );
};
