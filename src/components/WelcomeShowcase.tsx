import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowRight, LogIn } from 'lucide-react';

interface SdaPhotoItem {
  id: string;
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
}

interface WelcomeShowcaseProps {
  onEnterLogin: () => void;
}

const SDA_PHOTOS: SdaPhotoItem[] = [
  {
    id: 'sda-1',
    src: '/sda/1.png',
    alt: 'Amanecer sobre pozas de evaporación en el Salar de Atacama',
    caption: 'Pozas de evaporación · Amanecer Salar',
  },
  {
    id: 'sda-2',
    src: '/sda/2.png',
    alt: 'Celdas de concentración de litio en tonos esmeralda y salmuera',
    caption: 'Celdas de concentración · Salar de Atacama',
  },
  {
    id: 'sda-3',
    src: '/sda/3.png',
    alt: 'Infraestructura industrial reflejada en poza de salmuera al atardecer',
    caption: 'Plantas Mop 1 a Mop 6 · Operación continua',
  },
  {
    id: 'sda-4',
    src: '/sda/4.png',
    alt: 'Vista panorámica aérea de complejos y rutas en el Salar de Atacama',
    caption: 'Red vial y complejos productivos',
  },
  {
    id: 'sda-home',
    src: '/sda/home.png',
    alt: 'Identidad operativa Novandino sobre vista aérea del Salar de Atacama',
    caption: 'Centro de Despacho · Novandino',
    objectPosition: 'object-left',
  },
  {
    id: 'sda-5',
    src: '/sda/5.png',
    alt: 'Cosecha de sales en el Salar bajo cielo rojo del altiplano',
    caption: 'Cosecha de sales · Turno continuo',
  },
  {
    id: 'sda-6',
    src: '/sda/6.png',
    alt: 'Pozas de salmuera turquesa con la cordillera de los Andes al fondo',
    caption: 'Sector Salar · Pozas turquesa',
  },
  {
    id: 'sda-7',
    src: '/sda/7.png',
    alt: 'Celdas de litio y acopios minerales en faena Salar',
    caption: 'Acopio y concentración mineral',
  },
  {
    id: 'sda-8',
    src: '/sda/8.png',
    alt: 'Rutas de transporte y acopios operativos en el Salar de Atacama',
    caption: 'Logística y rutas de despacho',
  },
];

// 15-tile arranged mosaic referencing all 9 sda folder assets cleanly
const MOSAIC_GRID_ORDER: SdaPhotoItem[] = [
  SDA_PHOTOS[0], // 1.png
  SDA_PHOTOS[1], // 2.png
  SDA_PHOTOS[2], // 3.png
  SDA_PHOTOS[3], // 4.png
  SDA_PHOTOS[5], // 5.png
  SDA_PHOTOS[6], // 6.png
  SDA_PHOTOS[4], // home.png
  SDA_PHOTOS[7], // 7.png
  SDA_PHOTOS[8], // 8.png
  SDA_PHOTOS[2], // 3.png
  SDA_PHOTOS[0], // 1.png
  SDA_PHOTOS[5], // 5.png
  SDA_PHOTOS[6], // 6.png
  SDA_PHOTOS[1], // 2.png
  SDA_PHOTOS[7], // 7.png
];

const SPOTLIGHT_GROUPS: string[][] = [
  ['/sda/home.png', '/sda/1.png', '/sda/3.png', '/sda/5.png'],
  ['/sda/2.png', '/sda/6.png', '/sda/7.png', '/sda/3.png'],
  ['/sda/4.png', '/sda/8.png', '/sda/1.png', '/sda/6.png'],
];

const MosaicTile: React.FC<{
  photo: SdaPhotoItem;
  isSpotlight: boolean;
  depthFactor: number;
  parallax: { x: number; y: number };
  reduceMotion: boolean;
}> = React.memo(({ photo, isSpotlight, depthFactor, parallax, reduceMotion }) => {
  const [hasError, setHasError] = useState(false);

  const transformStyle = useMemo<React.CSSProperties>(() => {
    if (reduceMotion) {
      return {
        transform: isSpotlight ? 'scale(1.03)' : 'scale(0.98)',
      };
    }
    const tx = parallax.x * depthFactor * 18;
    const ty = parallax.y * depthFactor * 14;
    const scale = isSpotlight ? 1.04 : 0.97;
    return {
      transform: `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale})`,
    };
  }, [depthFactor, isSpotlight, parallax.x, parallax.y, reduceMotion]);

  return (
    <div
      style={transformStyle}
      className={`relative aspect-[16/10] rounded-lg overflow-hidden border transition-[opacity,filter,transform,border-color] duration-700 ease-out will-change-transform ${
        isSpotlight
          ? 'opacity-95 border-[#E2DFD7]/35 shadow-lg brightness-105'
          : 'opacity-40 border-white/10 shadow-md brightness-75 saturate-75'
      }`}
    >
      {hasError ? (
        <div className="w-full h-full bg-[#1C1917] flex items-end p-4">
          <span className="text-xs font-medium text-stone-300 truncate">{photo.caption}</span>
        </div>
      ) : (
        <img
          src={photo.src}
          alt={photo.alt}
          referrerPolicy="no-referrer"
          loading="eager"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${photo.objectPosition || 'object-center'} select-none pointer-events-none`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/65 via-transparent to-[#1C1917]/20 pointer-events-none" />
    </div>
  );
});

export const WelcomeShowcase: React.FC<WelcomeShowcaseProps> = ({ onEnterLogin }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const rafParallaxRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % SPOTLIGHT_GROUPS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (rafParallaxRef.current) window.cancelAnimationFrame(rafParallaxRef.current);
    };
  }, []);

  const handleContainerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || e.pointerType === 'touch') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      if (rafParallaxRef.current) {
        window.cancelAnimationFrame(rafParallaxRef.current);
      }
      rafParallaxRef.current = window.requestAnimationFrame(() => {
        setParallax({ x: -nx, y: -ny });
      });
    },
    [prefersReducedMotion]
  );

  const activeSpotlights = SPOTLIGHT_GROUPS[spotlightIndex];

  return (
    <div
      onPointerMove={handleContainerPointerMove}
      className="relative min-h-screen w-full overflow-hidden bg-[#141210] text-stone-100 flex flex-col justify-between select-none"
    >
      {/* FULL-BLEED TILTED SDA PHOTO MOSAIC */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
      >
        <div className="w-[140vw] min-w-[1100px] max-w-[2100px] -rotate-6 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-4">
          {MOSAIC_GRID_ORDER.map((photo, index) => {
            const isSpotlight = activeSpotlights.includes(photo.src);
            const depthFactor = ((index % 3) + 1) * 0.55;
            return (
              <MosaicTile
                key={`${photo.id}-${index}`}
                photo={photo}
                isSpotlight={isSpotlight}
                depthFactor={depthFactor}
                parallax={parallax}
                reduceMotion={prefersReducedMotion}
              />
            );
          })}
        </div>

        {/* Contrast scrim guaranteeing >= 4.5:1 text legibility */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(20,18,16,0.48)_0%,rgba(20,18,16,0.82)_62%,rgba(20,18,16,0.96)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#141210]/85 via-transparent to-[#141210]/92" />
      </div>

      {/* CENTRAL HERO WITH NOVANDINO LOGO & PRIMARY INGRESO CTA */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center py-12">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 mb-5">
            SUB GERENCIA LOGISTICA LITIO
          </p>

          <div className="bg-[#FFFFFF] px-7 sm:px-10 py-4 sm:py-5 rounded-lg border border-[#E2DFD7] shadow-lg inline-flex items-center justify-center">
            <img
              src="/novandino.png"
              alt="Novandino — Somos Litio, Somos Futuro"
              referrerPolicy="no-referrer"
              className="h-14 sm:h-20 md:h-24 w-auto object-contain"
            />
          </div>

          <p className="mt-6 text-base sm:text-xl font-bold tracking-tight text-stone-100 max-w-xl leading-snug">
            CENTRO DE CONTROL DESPACHO LITIO
          </p>
        </div>

        {/* Primary CTA Triggering App Login */}
        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={onEnterLogin}
            className="group px-7 py-3.5 min-h-[46px] rounded-md bg-[#461D77] hover:bg-[#36155E] active:translate-y-[0.5px] text-white font-bold text-sm tracking-wide border border-white/15 transition-colors duration-150 ease-out flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]"
          >
            <LogIn size={16} strokeWidth={2.25} />
            <span>Ingreso al Sistema</span>
            <ArrowRight
              size={15}
              strokeWidth={2.25}
              className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </main>
    </div>
  );
};

export default WelcomeShowcase;
