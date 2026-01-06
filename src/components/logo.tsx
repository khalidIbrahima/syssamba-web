import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  variant?: 'default' | 'full';
}

export function Logo({ width, height, className, variant = 'default' }: LogoProps) {
  const defaultWidth = variant === 'full' ? 250 : 200;
  const defaultHeight = variant === 'full' ? 80 : 60;
  
  const svgWidth = width || defaultWidth;
  const svgHeight = height || defaultHeight;
  const viewBox = variant === 'full' ? '0 0 250 80' : '0 0 200 60';
  
  return (
    <svg 
      width={svgWidth} 
      height={svgHeight} 
      viewBox={viewBox} 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Graphic Element: Network/Molecular Structure */}
      <g id="graphic">
        {variant === 'full' ? (
          <>
            {/* Central circle */}
            <circle cx="35" cy="40" r="10" fill="#2563eb" />
            
            {/* Outer circles (6 circles arranged in star pattern) */}
            <circle cx="35" cy="15" r="6" fill="#2563eb" />
            <circle cx="55" cy="25" r="6" fill="#2563eb" />
            <circle cx="55" cy="55" r="6" fill="#2563eb" />
            <circle cx="35" cy="65" r="6" fill="#2563eb" />
            <circle cx="15" cy="55" r="6" fill="#2563eb" />
            <circle cx="15" cy="25" r="6" fill="#2563eb" />
            
            {/* Connection lines */}
            <line x1="35" y1="40" x2="35" y2="15" stroke="#2563eb" strokeWidth="2.5" />
            <line x1="35" y1="40" x2="55" y2="25" stroke="#2563eb" strokeWidth="2.5" />
            <line x1="35" y1="40" x2="55" y2="55" stroke="#2563eb" strokeWidth="2.5" />
            <line x1="35" y1="40" x2="35" y2="65" stroke="#2563eb" strokeWidth="2.5" />
            <line x1="35" y1="40" x2="15" y2="55" stroke="#2563eb" strokeWidth="2.5" />
            <line x1="35" y1="40" x2="15" y2="25" stroke="#2563eb" strokeWidth="2.5" />
            
            {/* Text: SYSSAMBA */}
            <text x="75" y="50" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="700" fill="#1f2937" letterSpacing="2">SYSSAMBA</text>
          </>
        ) : (
          <>
            {/* Central circle */}
            <circle cx="25" cy="30" r="8" fill="#2563eb" />
            
            {/* Outer circles (6 circles arranged in star pattern) */}
            <circle cx="25" cy="12" r="5" fill="#2563eb" />
            <circle cx="40" cy="20" r="5" fill="#2563eb" />
            <circle cx="40" cy="40" r="5" fill="#2563eb" />
            <circle cx="25" cy="48" r="5" fill="#2563eb" />
            <circle cx="10" cy="40" r="5" fill="#2563eb" />
            <circle cx="10" cy="20" r="5" fill="#2563eb" />
            
            {/* Connection lines */}
            <line x1="25" y1="30" x2="25" y2="12" stroke="#2563eb" strokeWidth="2" />
            <line x1="25" y1="30" x2="40" y2="20" stroke="#2563eb" strokeWidth="2" />
            <line x1="25" y1="30" x2="40" y2="40" stroke="#2563eb" strokeWidth="2" />
            <line x1="25" y1="30" x2="25" y2="48" stroke="#2563eb" strokeWidth="2" />
            <line x1="25" y1="30" x2="10" y2="40" stroke="#2563eb" strokeWidth="2" />
            <line x1="25" y1="30" x2="10" y2="20" stroke="#2563eb" strokeWidth="2" />
            
            {/* Text: SYSSAMBA */}
            <text x="55" y="38" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="700" fill="#1f2937" letterSpacing="1">SYSSAMBA</text>
          </>
        )}
      </g>
    </svg>
  );
}

