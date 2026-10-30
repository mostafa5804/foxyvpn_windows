import React from 'react';
import { Zap } from 'lucide-react';

interface CountryFlagProps {
  code: string;
  size?: number;
  className?: string;
}

/**
 * Renders crisp inline SVG country flags so flags always display accurately on Windows 10/11
 * (where Segoe UI Emoji lacks Regional Indicator flag glyphs).
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({ code, size = 22, className = '' }) => {
  const upper = (code || '').trim().toUpperCase();

  if (upper === 'AUTO' || !upper) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[5px] bg-orange-500/20 text-[#FF7A1A] ${className}`}
        style={{ width: size, height: Math.round(size * 0.75) }}
        aria-hidden="true"
      >
        <Zap style={{ width: size * 0.65, height: size * 0.65 }} />
      </span>
    );
  }

  const w = size;
  const h = Math.round(size * 0.72);

  const renderSvg = (children: React.ReactNode) => (
    <svg
      width={w}
      height={h}
      viewBox="0 0 30 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block rounded-[3.5px] shadow-2xs shrink-0 overflow-hidden ${className}`}
      aria-label={upper}
    >
      {children}
      <rect x="0.25" y="0.25" width="29.5" height="19.5" rx="3" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
    </svg>
  );

  switch (upper) {
    case 'DE': // Germany
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#111111" />
          <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
          <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
        </>
      );
    case 'NL': // Netherlands
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#AE1C28" />
          <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
          <rect y="13.33" width="30" height="6.67" fill="#21468B" />
        </>
      );
    case 'AT': // Austria
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#ED2939" />
          <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
          <rect y="13.33" width="30" height="6.67" fill="#ED2939" />
        </>
      );
    case 'FR': // France
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#002395" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#ED2939" />
        </>
      );
    case 'BE': // Belgium
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#000000" />
          <rect x="10" width="10" height="20" fill="#FAE042" />
          <rect x="20" width="10" height="20" fill="#ED2939" />
        </>
      );
    case 'IT': // Italy
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#009246" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#CE2B37" />
        </>
      );
    case 'IE': // Ireland
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#169B62" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#FF883E" />
        </>
      );
    case 'RO': // Romania
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#002B7F" />
          <rect x="10" width="10" height="20" fill="#FCD116" />
          <rect x="20" width="10" height="20" fill="#CE1126" />
        </>
      );
    case 'FI': // Finland
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          <rect x="8" width="4.5" height="20" fill="#003580" />
          <rect y="7.75" width="30" height="4.5" fill="#003580" />
        </>
      );
    case 'SE': // Sweden
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#006AA7" />
          <rect x="8" width="4" height="20" fill="#FECC02" />
          <rect y="8" width="30" height="4" fill="#FECC02" />
        </>
      );
    case 'DK': // Denmark
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#C60C30" />
          <rect x="8" width="3.8" height="20" fill="#FFFFFF" />
          <rect y="8.1" width="30" height="3.8" fill="#FFFFFF" />
        </>
      );
    case 'NO': // Norway
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#BA0C2F" />
          <rect x="7.5" width="5" height="20" fill="#FFFFFF" />
          <rect y="7.5" width="30" height="5" fill="#FFFFFF" />
          <rect x="8.75" width="2.5" height="20" fill="#00205B" />
          <rect y="8.75" width="30" height="2.5" fill="#00205B" />
        </>
      );
    case 'CH': // Switzerland
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#D52B1E" />
          <rect x="13" y="4" width="4" height="12" fill="#FFFFFF" />
          <rect x="9" y="8" width="12" height="4" fill="#FFFFFF" />
        </>
      );
    case 'PL': // Poland
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#FFFFFF" />
          <rect y="10" width="30" height="10" fill="#DC143C" />
        </>
      );
    case 'UA': // Ukraine
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#0057B7" />
          <rect y="10" width="30" height="10" fill="#FFD700" />
        </>
      );
    case 'CZ': // Czechia
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#FFFFFF" />
          <rect y="10" width="30" height="10" fill="#D7141A" />
          <polygon points="0,0 15,10 0,20" fill="#11457E" />
        </>
      );
    case 'ES': // Spain
      return renderSvg(
        <>
          <rect width="30" height="5" fill="#AA151B" />
          <rect y="5" width="30" height="10" fill="#F1BF00" />
          <rect y="15" width="30" height="5" fill="#AA151B" />
        </>
      );
    case 'PT': // Portugal
      return renderSvg(
        <>
          <rect width="12" height="20" fill="#006600" />
          <rect x="12" width="18" height="20" fill="#FF0000" />
          <circle cx="12" cy="10" r="3.5" fill="#FFCC00" />
        </>
      );
    case 'HU': // Hungary
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#CE2939" />
          <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
          <rect y="13.33" width="30" height="6.67" fill="#477050" />
        </>
      );
    case 'BG': // Bulgaria
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#FFFFFF" />
          <rect y="6.67" width="30" height="6.67" fill="#00966E" />
          <rect y="13.33" width="30" height="6.67" fill="#D62612" />
        </>
      );
    case 'GB':
    case 'UK': // United Kingdom
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="2" />
          <rect x="12" width="6" height="20" fill="#FFFFFF" />
          <rect y="7" width="30" height="6" fill="#FFFFFF" />
          <rect x="13.2" width="3.6" height="20" fill="#C8102E" />
          <rect y="8.2" width="30" height="3.6" fill="#C8102E" />
        </>
      );
    case 'US': // United States
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#B22234" />
          <rect y="2.8" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="7.6" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="12.4" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="17.2" width="30" height="2.4" fill="#FFFFFF" />
          <rect width="13" height="11" fill="#3C3B6E" />
          <circle cx="3.5" cy="3" r="0.9" fill="#FFFFFF" />
          <circle cx="6.5" cy="3" r="0.9" fill="#FFFFFF" />
          <circle cx="9.5" cy="3" r="0.9" fill="#FFFFFF" />
          <circle cx="5" cy="5.5" r="0.9" fill="#FFFFFF" />
          <circle cx="8" cy="5.5" r="0.9" fill="#FFFFFF" />
          <circle cx="3.5" cy="8" r="0.9" fill="#FFFFFF" />
          <circle cx="6.5" cy="8" r="0.9" fill="#FFFFFF" />
          <circle cx="9.5" cy="8" r="0.9" fill="#FFFFFF" />
        </>
      );
    case 'CA': // Canada
      return renderSvg(
        <>
          <rect width="7.5" height="20" fill="#FF0000" />
          <rect x="7.5" width="15" height="20" fill="#FFFFFF" />
          <rect x="22.5" width="7.5" height="20" fill="#FF0000" />
          <path d="M15 4.5L17 8.5L20 8L17.5 11.5L18.5 14H15.8V16.5H14.2V14H11.5L12.5 11.5L10 8L13 8.5L15 4.5Z" fill="#FF0000" />
        </>
      );
    case 'JP': // Japan
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          <circle cx="15" cy="10" r="5.5" fill="#BC002D" />
        </>
      );
    case 'SG': // Singapore
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#EF3340" />
          <rect y="10" width="30" height="10" fill="#FFFFFF" />
          <circle cx="7.5" cy="5" r="3.2" fill="#FFFFFF" />
          <circle cx="8.7" cy="5" r="2.7" fill="#EF3340" />
        </>
      );
    case 'AU': // Australia
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#00008B" />
          <rect width="14" height="10" fill="#012169" />
          <path d="M0 0L14 10M14 0L0 10" stroke="#FFFFFF" strokeWidth="2" />
          <rect x="5.5" width="3" height="10" fill="#FFFFFF" />
          <rect y="3.5" width="14" height="3" fill="#FFFFFF" />
          <rect x="6.2" width="1.6" height="10" fill="#C8102E" />
          <rect y="4.2" width="14" height="1.6" fill="#C8102E" />
          <circle cx="22" cy="6" r="1.3" fill="#FFFFFF" />
          <circle cx="25" cy="10" r="1.1" fill="#FFFFFF" />
          <circle cx="21" cy="14" r="1.4" fill="#FFFFFF" />
          <circle cx="7" cy="15" r="1.7" fill="#FFFFFF" />
        </>
      );
    case 'BR': // Brazil
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#009B3A" />
          <polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FEDF00" />
          <circle cx="15" cy="10" r="3.8" fill="#002776" />
        </>
      );
    case 'TR': // Turkey
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#E30A17" />
          <circle cx="12" cy="10" r="4.8" fill="#FFFFFF" />
          <circle cx="13.4" cy="10" r="3.8" fill="#E30A17" />
          <polygon points="17.5,10 20.5,8.8 19.3,11.5 19.3,8.5 20.5,11.2" fill="#FFFFFF" />
        </>
      );
    case 'MX': // Mexico
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#006847" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#CE1126" />
          <circle cx="15" cy="10" r="2.2" fill="#8C6239" />
        </>
      );
    case 'CO': // Colombia
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#FCD116" />
          <rect y="10" width="30" height="5" fill="#003893" />
          <rect y="15" width="30" height="5" fill="#CE1126" />
        </>
      );
    case 'PE': // Peru
      return renderSvg(
        <>
          <rect width="10" height="20" fill="#D91023" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#D91023" />
        </>
      );
    case 'CL': // Chile
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#FFFFFF" />
          <rect y="10" width="30" height="10" fill="#D52B1E" />
          <rect width="10" height="10" fill="#0039A6" />
          <polygon points="5,2.3 5.8,4.5 8,4.5 6.2,5.8 6.8,8 5,6.7 3.2,8 3.8,5.8 2,4.5 4.2,4.5" fill="#FFFFFF" />
        </>
      );
    case 'AR': // Argentina
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#74ACDF" />
          <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
          <rect y="13.33" width="30" height="6.67" fill="#74ACDF" />
          <circle cx="15" cy="10" r="2.1" fill="#F6B40E" />
        </>
      );
    case 'MY': // Malaysia
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#CC0001" />
          <rect y="2.8" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="7.6" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="12.4" width="30" height="2.4" fill="#FFFFFF" />
          <rect y="17.2" width="30" height="2.4" fill="#FFFFFF" />
          <rect width="15" height="11" fill="#010066" />
          <circle cx="6.5" cy="5.5" r="3.2" fill="#FFCC00" />
          <circle cx="7.6" cy="5.5" r="2.6" fill="#010066" />
          <circle cx="10.2" cy="5.5" r="1.4" fill="#FFCC00" />
        </>
      );
    case 'TH': // Thailand
      return renderSvg(
        <>
          <rect width="30" height="3.33" fill="#A51931" />
          <rect y="3.33" width="30" height="3.33" fill="#F4F5F8" />
          <rect y="6.67" width="30" height="6.67" fill="#2D2A4A" />
          <rect y="13.33" width="30" height="3.33" fill="#F4F5F8" />
          <rect y="16.67" width="30" height="3.33" fill="#A51931" />
        </>
      );
    case 'PH': // Philippines
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#0038A8" />
          <rect y="10" width="30" height="10" fill="#CE1126" />
          <polygon points="0,0 14,10 0,20" fill="#FFFFFF" />
          <circle cx="5.2" cy="10" r="2" fill="#FCD116" />
        </>
      );
    case 'GH': // Ghana
      return renderSvg(
        <>
          <rect width="30" height="6.67" fill="#CE1126" />
          <rect y="6.67" width="30" height="6.67" fill="#FCD116" />
          <rect y="13.33" width="30" height="6.67" fill="#006B3F" />
          <polygon points="15,7.2 15.8,9.4 18,9.4 16.2,10.7 16.8,12.8 15,11.5 13.2,12.8 13.8,10.7 12,9.4 14.2,9.4" fill="#000000" />
        </>
      );
    case 'ZA': // South Africa
      return renderSvg(
        <>
          <rect width="30" height="10" fill="#E03C31" />
          <rect y="10" width="30" height="10" fill="#001489" />
          <path d="M0 0L12 10L0 20V0Z" fill="#000000" />
          <path d="M0 2L11 10L0 18M11 10H30" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M0 2L11 10L0 18M11 10H30" stroke="#007749" strokeWidth="3.2" />
          <path d="M0 4.5L7.5 10L0 15.5" stroke="#FFB81C" strokeWidth="1.5" fill="none" />
        </>
      );
    case 'KR': // South Korea
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          <circle cx="15" cy="10" r="4.8" fill="#CD2E3A" />
          <path d="M10.2 10A4.8 4.8 0 0 0 19.8 10A2.4 2.4 0 0 1 15 10A2.4 2.4 0 0 0 10.2 10Z" fill="#0047A0" />
        </>
      );
    case 'NZ': // New Zealand
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#00247D" />
          <rect width="14" height="10" fill="#012169" />
          <path d="M0 0L14 10M14 0L0 10" stroke="#FFFFFF" strokeWidth="2" />
          <rect x="5.5" width="3" height="10" fill="#FFFFFF" />
          <rect y="3.5" width="14" height="3" fill="#FFFFFF" />
          <rect x="6.2" width="1.6" height="10" fill="#C8102E" />
          <rect y="4.2" width="14" height="1.6" fill="#C8102E" />
          <circle cx="22" cy="5.5" r="1.3" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.4" />
          <circle cx="25" cy="9.5" r="1.2" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.4" />
          <circle cx="19.5" cy="10" r="1.2" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.4" />
          <circle cx="22" cy="14.5" r="1.4" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.4" />
        </>
      );
    default:
      return renderSvg(
        <>
          <rect width="30" height="20" fill="#1E293B" />
          <text
            x="15"
            y="13.5"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="9.5"
            fontWeight="bold"
            fontFamily="Vazirmatn, sans-serif"
          >
            {upper.slice(0, 2)}
          </text>
        </>
      );
  }
};
