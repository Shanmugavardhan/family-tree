import React from 'react';
import { LaneBannerNodeData } from '../../adapters/reactFlowAdapter';
import { useTheme } from '../../context/ThemeContext';
import silentStripImg from '../../assets/silent_strip.jpg';
import babyBoomersStripImg from '../../assets/baby_boomers_strip.jpg';
import genXStripImg from '../../assets/gen_x_strip.jpg';
import millennialsStripImg from '../../assets/millennials_strip.jpg';
import genZStripImg from '../../assets/gen_z_strip.jpg';
import genAlphaStripImg from '../../assets/gen_alpha_strip.jpg';
import genBetaStripImg from '../../assets/gen_beta_strip.jpg';

/**
 * Returns a generation period SVG texture pattern URL matching the historical era
 */
function getGenerationTexture(genId: string | null, isDark: boolean): string {
  const strokeOpacity = isDark ? 0.16 : 0.09;
  const fillOpacity = isDark ? 0.18 : 0.1;

  switch (genId) {
    case 'ancestral_gilded': {
      // 1843-1859: Victorian classical filigree / ornate parchment weave
      const color = encodeURIComponent(isDark ? '#d4af37' : '#92400e');
      return `url("data:image/svg+xml,%3Csvg width='36' height='36' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 18 0 C 18 9, 9 18, 0 18 C 9 18, 18 27, 18 36 C 18 27, 27 18, 36 18 C 27 18, 18 9, 18 0 Z' fill='none' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'missionary': {
      // 1860-1882: Industrial letterpress heraldic crosshatch & diamond crests
      const color = encodeURIComponent(isDark ? '#a78bfa' : '#6d28d9');
      return `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 16 L 32 16 M 16 0 L 16 32 M 8 8 L 24 24 M 24 8 L 8 24' stroke='${color}' stroke-width='1' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'lost': {
      // 1883-1900: Art Nouveau undulating organic curves & vintage wavelets
      const color = encodeURIComponent(isDark ? '#67e8f9' : '#0891b2');
      return `url("data:image/svg+xml,%3Csvg width='40' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 10 Q 10 0, 20 10 T 40 10' fill='none' stroke='${color}' stroke-width='1.4' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'greatest': {
      // 1901-1927: Art Deco geometric chevron fan & brass radiance
      const color = encodeURIComponent(isDark ? '#fbbf24' : '#b45309');
      return `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 32 L 16 0 L 32 32 M 8 32 L 16 16 L 24 32' fill='none' stroke='${color}' stroke-width='1.3' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'silent': {
      // 1928-1945: Archival classic diagonal pinstripes
      const color = encodeURIComponent(isDark ? '#94a3b8' : '#475569');
      return `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='24' x2='24' y2='0' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3Cline x1='-12' y1='12' x2='12' y2='-12' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3Cline x1='12' y1='36' x2='36' y2='12' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'baby_boomers': {
      // 1946-1964: Mid-century retro acoustic dot grid & record grooves
      const color = encodeURIComponent(isDark ? '#2dd4bf' : '#0d9488');
      return `url("data:image/svg+xml,%3Csvg width='28' height='28' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='7' cy='7' r='2.2' fill='${color}' fill-opacity='${fillOpacity}'/%3E%3Ccircle cx='21' cy='21' r='2.2' fill='${color}' fill-opacity='${fillOpacity}'/%3E%3Ccircle cx='7' cy='21' r='1.2' fill='${color}' fill-opacity='${fillOpacity * 0.7}'/%3E%3Ccircle cx='21' cy='7' r='1.2' fill='${color}' fill-opacity='${fillOpacity * 0.7}'/%3E%3C/svg%3E")`;
    }
    case 'gen_x': {
      // 1965-1980: 80s Synthwave / micro-grid terminal lines
      const color = encodeURIComponent(isDark ? '#60a5fa' : '#2563eb');
      return `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 32 0 L 0 0 0 32' fill='none' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3Ccircle cx='0' cy='0' r='1.8' fill='${color}' fill-opacity='${fillOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'millennials': {
      // 1981-1996: Y2K digital dawn / geometric diamond pixel weave
      const color = encodeURIComponent(isDark ? '#c084fc' : '#7c3aed');
      return `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 16 L 16 0 L 32 16 L 16 32 Z' fill='none' stroke='${color}' stroke-width='1.3' stroke-opacity='${strokeOpacity}'/%3E%3Ccircle cx='16' cy='16' r='1.5' fill='${color}' fill-opacity='${fillOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'gen_z': {
      // 1997-2012: Modern digital fluid waves & dynamic stream curves
      const color = encodeURIComponent(isDark ? '#34d399' : '#059669');
      return `url("data:image/svg+xml,%3Csvg width='48' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 12 Q 12 0, 24 12 T 48 12' fill='none' stroke='${color}' stroke-width='1.6' stroke-opacity='${strokeOpacity * 1.3}'/%3E%3C/svg%3E")`;
    }
    case 'gen_alpha': {
      // 2013-2028: AI neural tech hexagonal honeycomb
      const color = encodeURIComponent(isDark ? '#fb923c' : '#ea580c');
      return `url("data:image/svg+xml,%3Csvg width='32' height='36' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 16 0 L 32 9 L 32 27 L 16 36 L 0 27 L 0 9 Z' fill='none' stroke='${color}' stroke-width='1.3' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    case 'gen_beta': {
      // 2029-2044: Quantum futuristic holographic lattice triangles
      const color = encodeURIComponent(isDark ? '#fb7185' : '#e11d48');
      return `url("data:image/svg+xml,%3Csvg width='28' height='28' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='14,2 26,26 2,26' fill='none' stroke='${color}' stroke-width='1.2' stroke-opacity='${strokeOpacity}'/%3E%3C/svg%3E")`;
    }
    default: {
      // Timeless neutral blueprint crosshatch
      const color = encodeURIComponent(isDark ? '#94a3b8' : '#64748b');
      return `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 0 0 L 20 20 M 20 0 L 0 20' stroke='${color}' stroke-width='0.9' stroke-opacity='${strokeOpacity * 0.8}'/%3E%3C/svg%3E")`;
    }
  }
}

export const CohortLaneBanner: React.FC<any> = ({ data }) => {
  const { isDark } = useTheme();
  const { lane, width } = data as LaneBannerNodeData;
  const isSilent = lane.id === 'silent';
  const isBabyBoomers = lane.id === 'baby_boomers';
  const isGenX = lane.id === 'gen_x';
  const isMillennials = lane.id === 'millennials';
  const isGenZ = lane.id === 'gen_z';
  const isGenAlpha = lane.id === 'gen_alpha';
  const isGenBeta = lane.id === 'gen_beta';
  const hasCustomPanorama = isSilent || isBabyBoomers || isGenX || isMillennials || isGenZ || isGenAlpha || isGenBeta;

  const bgColor = lane.backgroundColor || '#64748b';

  let texture = getGenerationTexture(lane.id, isDark);
  let customBgColor = isDark ? `${bgColor}2c` : `${bgColor}18`;

  if (lane.id === 'ancestral_gilded') {
    customBgColor = '#161313';
  } else if (lane.id === 'missionary') {
    customBgColor = '#19131a';
  } else if (lane.id === 'lost') {
    customBgColor = '#13181f';
  } else if (lane.id === 'greatest') {
    customBgColor = '#161d17';
  } else if (isSilent) {
    texture = `url("${silentStripImg}")`;
    customBgColor = '#101715';
  } else if (isBabyBoomers) {
    texture = `url("${babyBoomersStripImg}")`;
    customBgColor = '#0f221e';
  } else if (isGenX) {
    texture = `url("${genXStripImg}")`;
    customBgColor = '#121a29';
  } else if (isMillennials) {
    texture = `url("${millennialsStripImg}")`;
    customBgColor = '#24141e';
  } else if (isGenZ) {
    texture = `url("${genZStripImg}")`;
    customBgColor = '#25150f';
  } else if (isGenAlpha) {
    texture = `url("${genAlphaStripImg}")`;
    customBgColor = '#122026';
  } else if (isGenBeta) {
    texture = `url("${genBetaStripImg}")`;
    customBgColor = '#1e141a';
  }

  return (
    <div
      style={{
        width,
        height: lane.height,
        backgroundColor: customBgColor,
        backgroundImage: texture,
        backgroundRepeat: 'repeat',
        backgroundSize: hasCustomPanorama ? 'auto 100%' : 'auto',
        backgroundPosition: 'left center',
        borderBottom: `1px solid ${isDark ? 'rgba(52, 61, 73, 0.5)' : 'rgba(52, 61, 73, 0.25)'}`,
        position: 'relative',
        boxSizing: 'border-box',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    />
  );
};
