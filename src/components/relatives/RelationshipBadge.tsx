import React from 'react';

interface RelationshipBadgeProps {
  relationship: string;
  category?: string;
}

export const RelationshipBadge: React.FC<RelationshipBadgeProps> = ({ relationship }) => {
  return (
    <span
      className="badge badge-relationship"
      style={{
        padding: '3px 9px',
        fontSize: '0.75rem',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}
    >
      {relationship}
    </span>
  );
};

