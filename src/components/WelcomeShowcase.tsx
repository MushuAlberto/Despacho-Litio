import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Compass, Layers, LogIn, ShieldCheck, Truck } from 'lucide-react';

export type ShowcaseTabId = 'inicio' | 'salar' | 'flota' | 'reportes';

interface SdaPhotoItem {
  id: string;
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
}

interface ShowcaseSlide {
  id: ShowcaseTabId;
  label: string;
  kicker: string;
  headline: string;
  subtitle: string;
  spotlightSources: string[];
  icon: React.ReactNode;
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

const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    kicker: 'Salar de Atacama · Centro de Despacho M1',
    headline: 'Inicio',
    subtitle: 'Control operacional de litio y despacho diario desde el Salar.',
    spotlightSources: ['/sda/home.png', '/sda/1.png', '/sda/3.png', '/sda/5.png'],
    icon: <Compass size={15} />,
  },
  {
    id: 'salar',
    label: 'Salar',
    kicker: 'Plantas Mop 1 a Mop 6 · Trazabilidad Stokes',
    headline: 'Salar',
    subtitle: 'Ingesta validada del Reporte Stokes y monitoreo continuo por planta.',
    spotlightSources: ['/sda/2.png', '/sda/6.png', '/sda/7.png', '/sda/3.png'],
    icon: <Layers size={15} />,
  },
  {
    id: 'flota',
    label: 'Flota',
    kicker: 'Transporte Terrestre · Tiempos de Ciclo',
    headline: 'Flota',
    subtitle: 'Seguimiento de llegada de equipos, regulación en ruta y cumplimiento.',
    spotlightSources: ['/sda/4.png', '/sda/8.png', '/sda/1.png'],
    icon: <Truck size={15} />,
  },
  {
    id: 'reportes',
    label: 'Reportes',
    kicker: 'Analítica Ejecutiva · Respaldo Offline PWA',
    headline: 'Reportes',
    subtitle: 'Informes operativos en PDF, cambios de turno y sincronización segura.',
    spotlightSources: ['/sda/5.png', '/sda/home.png', '/sda/6.png', '/sda/8.png'],
    icon: <ShieldCheck size={15} />,
  },
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
      className={`relative aspect-[16/10] rounded-2xl overflow-hidden border transition-[opacity,filter,transform,border-color] duration-500 ease-out will-change-transform ${
        isSpotlight
          ? 'opacity-95 border-white/25 shadow-[0_18px_45px_rgba(0,0,0,0.7)] brightness-105'
          : 'opacity-40 border-white/10 shadow-xl brightness-75 saturate-75'
      }`}
    >
      {hasError ? (
        <div className="w-full h-full bg-gradient-to-br from-[#23153F] via-[#131827] to-[#080A12] flex items-end p-4">
          <span className="text-xs font-medium text-white/70 truncate">{photo.caption}</span>
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15 pointer-events-none" />
    </div>
  );
});

export const WelcomeShowcase: React.FC<WelcomeShowcaseProps> = ({ onEnterLogin }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeTab, setActiveTab] = useState<ShowcaseTabId>('inicio');
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lensStyle, setLensStyle] = useState<{
    left: number;
    width: number;
    stretchX: number;
    scaleY: number;
    ready: boolean;
  }>({ left: 0, width: 88, stretchX: 1, scaleY: 1, ready: false });

  const dockTrackRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Record<ShowcaseTabId, HTMLButtonElement | null>>({
    inicio: null,
    salar: null,
    flota: null,
    reportes: null,
  });
  const previousLeftRef = useRef<number | null>(null);
  const stretchTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const rafParallaxRef = useRef<number | null>(null);

  const activeSlide = useMemo(
    () => SHOWCASE_SLIDES.find((s) => s.id === activeTab) || SHOWCASE_SLIDES[0],
    [activeTab]
  );

  const measureLensToTab = useCallback(
    (tabId: ShowcaseTabId, animateStretch = true) => {
      const targetEl = tabButtonRefs.current[tabId];
      const trackEl = dockTrackRef.current;
      if (!targetEl || !trackEl) return;

      const nextLeft = targetEl.offsetLeft;
      const nextWidth = targetEl.offsetWidth;
      const prevLeft = previousLeftRef.current;
      const travelDistance = prevLeft !== null ? Math.abs(nextLeft - prevLeft) : 0;

      previousLeftRef.current = nextLeft;

      if (stretchTimerRef.current) {
        window.clearTimeout(stretchTimerRef.current);
      }

      const computedStretch =
        animateStretch && !prefersReducedMotion && travelDistance > 8
          ? Math.min(1.26, 1.08 + travelDistance / 420)
          : 1;
      const computedScaleY = computedStretch > 1 ? 0.92 : 1;

      setLensStyle({
        left: nextLeft,
        width: nextWidth,
        stretchX: computedStretch,
        scaleY: computedScaleY,
        ready: true,
      });

      if (computedStretch > 1) {
        stretchTimerRef.current = window.setTimeout(() => {
          setLensStyle((curr) => ({
            ...curr,
            stretchX: 1,
            scaleY: 1,
          }));
        }, 170);
      }
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    measureLensToTab(activeTab, true);
  }, [activeTab, measureLensToTab]);

  useEffect(() => {
    const trackEl = dockTrackRef.current;
    if (!trackEl) return;

    const handleResize = () => measureLensToTab(activeTab, false);
    handleResize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(handleResize);
      observer.observe(trackEl);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, measureLensToTab]);

  useEffect(() => {
    return () => {
      if (stretchTimerRef.current) window.clearTimeout(stretchTimerRef.current);
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

  const selectTabAtPointerX = useCallback(
    (clientX: number) => {
      let closestId: ShowcaseTabId | null = null;
      let minDist = Number.POSITIVE_INFINITY;

      for (const slide of SHOWCASE_SLIDES) {
        const el = tabButtonRefs.current[slide.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - centerX);
        if (dist < minDist) {
          minDist = dist;
          closestId = slide.id;
        }
      }

      if (closestId && closestId !== activeTab) {
        setActiveTab(closestId);
      }
    },
    [activeTab]
  );

  const handleDockPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    selectTabAtPointerX(e.clientX);
  };

  const handleDockPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    selectTabAtPointerX(e.clientX);
  };

  const handleDockPointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      onPointerMove={handleContainerPointerMove}
      className="relative min-h-screen w-full overflow-hidden bg-[#07080D] text-white flex flex-col justify-between select-none"
    >
      {/* Hidden SVG refraction filter for the liquid-glass lens */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <filter id="liquid-glass-lens" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.02"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* FULL-BLEED TILTED SDA PHOTO MOSAIC */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
      >
        <div className="w-[140vw] min-w-[1100px] max-w-[2100px] -rotate-6 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-4">
          {MOSAIC_GRID_ORDER.map((photo, index) => {
            const isSpotlight = activeSlide.spotlightSources.includes(photo.src);
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(7,8,13,0.42)_0%,rgba(7,8,13,0.78)_60%,rgba(7,8,13,0.95)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080D]/80 via-transparent to-[#07080D]/90" />
      </div>

      {/* ZONE 1–3 CLEAN TOP BAR */}
      <header className="relative z-20 w-full max-w-[1440px] mx-auto px-6 sm:px-10 py-5 flex items-center justify-between gap-8">
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('inicio');
          }}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1C5] rounded-md"
        >
          Novandino
        </a>

        <nav aria-label="Secciones operativas" className="hidden md:flex items-center gap-7">
          {SHOWCASE_SLIDES.map((slide) => {
            const isActive = slide.id === activeTab;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveTab(slide.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1C5] rounded-sm ${
                  isActive
                    ? 'text-white border-[#4FD1C5]'
                    : 'text-slate-300 border-transparent hover:text-white'
                }`}
              >
                {slide.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onEnterLogin}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold tracking-wide border border-white/20 backdrop-blur-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1C5]"
          >
            <span>Ingreso</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* CENTRAL HERO HEADLINE & PRIMARY INGRESO CTA */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center pb-28 sm:pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#4FD1C5] mb-3">
              {activeSlide.kicker}
            </p>

            <h1
              style={{ textWrap: 'balance' } as React.CSSProperties}
              className="text-[clamp(3.25rem,8vw,5.75rem)] font-black tracking-tight text-white leading-[0.98] drop-shadow-[0_12px_36px_rgba(0,0,0,0.85)]"
            >
              {activeSlide.headline}
            </h1>

            <p className="mt-4 text-base sm:text-lg font-medium text-slate-200/95 max-w-xl leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {activeSlide.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Primary CTA Triggering App Login */}
        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={onEnterLogin}
            className="group px-7 py-3.5 min-h-[48px] rounded-2xl bg-[#4FD1C5] hover:bg-[#6BE3D8] active:scale-[0.98] text-[#051B18] font-extrabold text-sm tracking-wide shadow-[0_18px_45px_rgba(79,209,197,0.32)] transition-all duration-150 flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080D]"
          >
            <LogIn size={17} strokeWidth={2.5} />
            <span>Ingreso al Sistema</span>
            <ArrowRight
              size={16}
              strokeWidth={2.5}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </main>

      {/* BOTTOM ELASTIC LIQUID-GLASS LENS DOCK */}
      <div className="fixed bottom-5 sm:bottom-8 inset-x-0 z-30 px-3 flex justify-center pointer-events-none">
        <div
          onPointerDown={handleDockPointerDown}
          onPointerMove={handleDockPointerMove}
          onPointerUp={handleDockPointerUp}
          onPointerCancel={handleDockPointerUp}
          onPointerLeave={handleDockPointerUp}
          className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar rounded-full bg-white/[0.1] backdrop-blur-2xl border border-white/25 shadow-[0_24px_55px_rgba(0,0,0,0.72),inset_0_1px_1px_rgba(255,255,255,0.4)] p-1.5 flex items-center gap-1 touch-none"
        >
          {/* Tab Track with Stretching Glass Lens */}
          <div ref={dockTrackRef} className="relative flex items-center">
            {lensStyle.ready && (
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={{
                  x: lensStyle.left,
                  width: lensStyle.width,
                  scaleX: lensStyle.stretchX,
                  scaleY: lensStyle.scaleY,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 360,
                  damping: 26,
                  mass: 0.75,
                }}
                style={{
                  transformOrigin: 'center center',
                  filter: prefersReducedMotion ? undefined : 'url(#liquid-glass-lens)',
                }}
                className="absolute inset-y-0 left-0 rounded-full pointer-events-none bg-gradient-to-b from-white/35 via-white/15 to-white/10 border border-white/50 shadow-[0_6px_22px_rgba(0,0,0,0.35),inset_0_1px_2px_rgba(255,255,255,0.75)] backdrop-blur-md"
              />
            )}

            {SHOWCASE_SLIDES.map((slide) => {
              const isActive = slide.id === activeTab;
              return (
                <button
                  key={slide.id}
                  ref={(el) => {
                    tabButtonRefs.current[slide.id] = el;
                  }}
                  type="button"
                  onClick={() => setActiveTab(slide.id)}
                  aria-pressed={isActive}
                  className={`relative z-10 min-h-[44px] px-3.5 sm:px-5 rounded-full flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1C5] ${
                    isActive ? 'text-white' : 'text-slate-200/75 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline-flex opacity-85">{slide.icon}</span>
                  <span>{slide.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-white/20 mx-1 shrink-0" aria-hidden="true" />

          {/* Dock Ingreso Action */}
          <button
            type="button"
            onClick={onEnterLogin}
            className="relative z-10 min-h-[44px] px-4 sm:px-5 rounded-full bg-[#4FD1C5] hover:bg-[#6BE3D8] active:scale-95 text-[#051B18] font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LogIn size={14} strokeWidth={2.5} />
            <span>Ingreso</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeShowcase;
