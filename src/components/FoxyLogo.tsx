import React from 'react';

interface FoxyLogoProps {
  size?: number;
  className?: string;
}

/**
 * High-precision geometric Fox + Cyber Shield vector emblem for FoxyVPN Windows.
 */
export const FoxyLogo: React.FC<FoxyLogoProps> = ({ size = 24, className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`shieldBg-${uid}`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E2634" />
          <stop offset="100%" stopColor="#0D1118" />
        </linearGradient>
        <linearGradient id={`shieldStroke-${uid}`} x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9A4D" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#FF6B1A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2DD4A0" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`foxFurMain-${uid}`} x1="16" y1="12" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB066" />
          <stop offset="45%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#D9480F" />
        </linearGradient>
        <linearGradient id={`foxEarLeft-${uid}`} x1="14" y1="12" x2="27" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9A4D" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
        <linearGradient id={`foxEarRight-${uid}`} x1="50" y1="12" x2="37" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9A4D" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
        <linearGradient id={`foxCheek-${uid}`} x1="20" y1="34" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </linearGradient>
      </defs>

      {/* Outer Armor Shield Base */}
      <path
        d="M32 4L55 12.5V30.5C55 45.2 45.1 55.8 32 60C18.9 55.8 9 45.2 9 30.5V12.5L32 4Z"
        fill={`url(#shieldBg-${uid})`}
        stroke={`url(#shieldStroke-${uid})`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* Subtle Inner Cyber Shield Glow Ring */}
      <path
        d="M32 8.2L50.8 15.2V30.2C50.8 42.3 42.7 51.3 32 55C21.3 51.3 13.2 42.3 13.2 30.2V15.2L32 8.2Z"
        stroke="#FF7A1A"
        strokeOpacity="0.16"
        strokeWidth="1.2"
      />

      {/* Left Fox Ear (Outer) */}
      <path d="M16.5 13L28 22.5L18.5 31L16.5 13Z" fill={`url(#foxEarLeft-${uid})`} />
      {/* Right Fox Ear (Outer) */}
      <path d="M47.5 13L36 22.5L45.5 31L47.5 13Z" fill={`url(#foxEarRight-${uid})`} />

      {/* Inner Dark Ear Triangles */}
      <path d="M19.2 17.2L25.6 22.6L20.3 27.6L19.2 17.2Z" fill="#18121E" />
      <path d="M44.8 17.2L38.4 22.6L43.7 27.6L44.8 17.2Z" fill="#18121E" />

      {/* Geometric Fox Head Crown & Forehead */}
      <path
        d="M18.5 31L27.5 22H36.5L45.5 31L48 37.5L32 51.5L16 37.5L18.5 31Z"
        fill={`url(#foxFurMain-${uid})`}
      />

      {/* Faceted Center Blaze */}
      <path d="M32 22L26.5 34.5L32 48.5L37.5 34.5L32 22Z" fill="#FF8B33" />

      {/* Cream/White Lower Cheeks */}
      <path d="M16 37.5L26.5 35.5L32 49.5L19.5 42.5L16 37.5Z" fill={`url(#foxCheek-${uid})`} />
      <path d="M48 37.5L37.5 35.5L32 49.5L44.5 42.5L48 37.5Z" fill={`url(#foxCheek-${uid})`} />

      {/* Glowing Cyber Eyes */}
      <path d="M22.5 32.5L27.8 34.2L24.2 35.8L22.5 32.5Z" fill="#0E1116" />
      <path d="M41.5 32.5L36.2 34.2L39.8 35.8L41.5 32.5Z" fill="#0E1116" />
      <circle cx="25.2" cy="34" r="1" fill="#2DD4A0" />
      <circle cx="38.8" cy="34" r="1" fill="#2DD4A0" />

      {/* Dark Snout Tip */}
      <path d="M29.2 46.8H34.8L32 51.5L29.2 46.8Z" fill="#0E1116" />
    </svg>
  );
};
