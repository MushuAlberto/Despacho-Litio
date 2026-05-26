import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'large' | 'medium' | 'small' | 'print';
}

export const NovandinoLogo: React.FC<BrandLogoProps> = ({ className = '', variant = 'medium' }) => {
  let height = 120;
  let width = 500;
  
  if (variant === 'small') {
    height = 70;
    width = 250;
  } else if (variant === 'large') {
    height = 160;
    width = 600;
  } else if (variant === 'print') {
    height = 110;
    width = 460;
  }

  return (
    <div className={`flex items-center select-none ${className}`} style={{ display: 'inline-flex' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Geometric Chevron N Logo (Novandino) */}
        <g transform={variant === 'small' ? `translate(10, 10) scale(0.48)` : `translate(12, 12) scale(0.85)`}>
          {/* Left thick chevron fold */}
          <path d="M 50,90 L 15,55 L 50,20 L 70,40 L 45,65 L 70,90 Z" fill="#461D77" />
          {/* Right thick chevron fold */}
          <path d="M 50,20 L 85,55 L 50,90 L 30,70 L 55,45 L 30,20 Z" fill="#461D77" opacity="0.9" />
        </g>
        
        {/* Brand Name */}
        <text
          x={variant === 'small' ? 72 : 115}
          y={variant === 'small' ? 44 : 70}
          fill="#461D77"
          fontFamily="'Inter', 'Space Grotesk', system-ui, sans-serif"
          fontSize={variant === 'small' ? 32 : 48}
          fontWeight="900"
          letterSpacing="-0.04em"
        >
          NOVANDINO
        </text>
        
        {/* Lithium tag/pill */}
        <rect
          x={variant === 'small' ? 198 : 395}
          y={variant === 'small' ? 22 : 30}
          width={variant === 'small' ? 40 : 54}
          height={variant === 'small' ? 26 : 38}
          rx={variant === 'small' ? 8 : 12}
          stroke="#461D77"
          strokeWidth="3.5"
        />
        <text
          x={variant === 'small' ? 218 : 422}
          y={variant === 'small' ? 39 : 56}
          textAnchor="middle"
          fill="#461D77"
          fontFamily="'Inter', 'Space Grotesk', system-ui, sans-serif"
          fontSize={variant === 'small' ? 14 : 20}
          fontWeight="900"
        >
          + Li
        </text>
        
        {/* Slogan */}
        <text
          x={variant === 'small' ? 73 : 118}
          y={variant === 'small' ? 58 : 94}
          fill="#7177EC"
          opacity="0.85"
          fontFamily="'Inter', 'JetBrains Mono', monospace"
          fontSize={variant === 'small' ? 7.5 : 10.5}
          fontWeight="800"
          letterSpacing="0.4em"
        >
          SOMOS LITIO, SOMOS FUTURO
        </text>
      </svg>
    </div>
  );
};

export default NovandinoLogo;
