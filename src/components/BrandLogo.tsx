import React, { useState, useEffect } from 'react';

// Robust helper to convert local public image URL to base64 data-URL
const getBase64FromUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image at ${url}`);
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error(`Image at ${url} is empty (0 bytes)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface BrandLogoProps {
  className?: string;
  variant?: 'large' | 'medium' | 'small' | 'print';
}

export const NovandinoLogo: React.FC<BrandLogoProps> = ({ className = '', variant = 'medium' }) => {
  const [logoSrc, setLogoSrc] = useState<string>('/novandino.png');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const tryLoad = async () => {
      try {
        const b64 = await getBase64FromUrl('/novandino.png');
        if (active) setLogoSrc(b64);
      } catch {
        try {
          const b64Fallback = await getBase64FromUrl('/logo novandino.png');
          if (active) setLogoSrc(b64Fallback);
        } catch (err2) {
          console.warn("Could not find or convert any Novandino PNG image, using SVG fallback:", err2);
          if (active) setHasError(true);
        }
      }
    };
    tryLoad();
    return () => {
      active = false;
    };
  }, []);

  if (logoSrc && !hasError) {
    let imgHeightClass = "h-32";
    if (variant === 'small') {
      imgHeightClass = "h-full max-h-[70px]";
    } else if (variant === 'large') {
      imgHeightClass = "h-40";
    } else if (variant === 'print') {
      imgHeightClass = "h-32";
    }

    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <img
          src={logoSrc}
          alt="Novandino Logo"
          className={`${imgHeightClass} w-auto object-contain max-w-full`}
          onError={() => {
            if (logoSrc === '/novandino.png') {
              setLogoSrc('/logo novandino.png');
            } else {
              setHasError(true);
            }
          }}
        />
      </div>
    );
  }

  let height = 120;
  let width = 500;

  if (variant === 'small') {
    height = 70;
    width = 310;
  } else if (variant === 'large') {
    height = 160;
    width = 600;
  } else if (variant === 'print') {
    height = 110;
    width = 460;
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full max-w-full max-h-full block"
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
          x={variant === 'small' ? 70 : 115}
          y={variant === 'small' ? 44 : 70}
          fill="#461D77"
          fontFamily="'Inter', 'Space Grotesk', system-ui, sans-serif"
          fontSize={variant === 'small' ? 28 : 48}
          fontWeight="900"
          letterSpacing="-0.04em"
        >
          NOVANDINO
        </text>

        {/* Lithium tag/pill */}
        <rect
          x={variant === 'small' ? 250 : 395}
          y={variant === 'small' ? 20 : 30}
          width={variant === 'small' ? 44 : 54}
          height={variant === 'small' ? 26 : 38}
          rx={variant === 'small' ? 8 : 12}
          stroke="#461D77"
          strokeWidth="3.5"
        />
        <text
          x={variant === 'small' ? 272 : 422}
          y={variant === 'small' ? 37 : 56}
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
          x={variant === 'small' ? 71 : 118}
          y={variant === 'small' ? 58 : 94}
          fill="#7177EC"
          opacity="0.85"
          fontFamily="'Inter', 'JetBrains Mono', monospace"
          fontSize={variant === 'small' ? 7.5 : 10.5}
          fontWeight="800"
          letterSpacing="0.32em"
        >
          SOMOS LITIO, SOMOS FUTURO
        </text>
      </svg>
    </div>
  );
};

export default NovandinoLogo;
