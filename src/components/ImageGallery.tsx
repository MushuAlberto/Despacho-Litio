
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Trash2, ChevronLeft, ChevronRight, 
  Image as ImageIcon, X, Home, Plus,
  Maximize2, Minimize2, Play, Pause, Timer,
  Clock, TrendingUp, Target, Users, Scale, ClipboardCheck, Truck, Loader2
} from 'lucide-react';
import ChartCard from './ChartCard';
import { ProductDetailSection } from './ProductDetailSection';
import { NovandinoLogo } from './BrandLogo';
import { formatDateToCL, formatNumberWithDecimals, formatHoursToTime } from '../utils/dataProcessor';

declare const html2canvas: any;

interface GalleryImage {
  id: string;
  url: string;
  name: string;
  date: string;
}

interface ImageGalleryProps {
  onBack: () => void;
  rawData?: any[];
  selectedDate?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ onBack, rawData = [], selectedDate = '' }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalTime, setIntervalTime] = useState(5); // en segundos
  const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);

  // Persistence
  useEffect(() => {
    const savedImages = localStorage.getItem('sqm_gallery_images');
    if (savedImages) {
      try {
        setImages(JSON.parse(savedImages));
      } catch (e) {
        console.error("Error loading gallery images", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sqm_gallery_images', JSON.stringify(images));
  }, [images]);

  // Data calculations for report generation
  const filteredData = useMemo(() => {
    if (!rawData || !selectedDate) return [];
    return rawData.filter(r => r.Fecha === selectedDate);
  }, [rawData, selectedDate]);

  const operationalKPIs = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalTonReal = filteredData.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = filteredData.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = filteredData.reduce((a, b) => a + b.Eq_Real, 0);
    const avgReg = filteredData.length > 0 ? filteredData.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / filteredData.length : 0;
    const validSdaTimes = filteredData.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = filteredData.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = filteredData.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;
    return [
      { label: "Tiempo Gral. Faena (SdA)", value: formatHoursToTime(avgSda), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "TIEMPO GRAL: FAENA (NY)", value: formatHoursToTime(avgPang), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Productividad Diaria", value: `${productivity.toFixed(1)} T/H`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { label: "Carga Real Despachada", value: `${formatNumberWithDecimals(totalTonReal, 2)} Ton`, icon: <Truck className="w-3.5 h-3.5" /> },
      { label: "Cumplimiento Programa", value: `${compliance.toFixed(1)}%`, icon: <Target className="w-3.5 h-3.5" />, status: compliance < 85 ? 'danger' : 'normal' },
      { label: "Intensidad de Flota", value: `${totalEqReal} EQ`, icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Factor de Carga (Eficiencia)", value: `${avgLoad.toFixed(1)} T/EQ`, icon: <Scale className="w-3.5 h-3.5" /> },
      { label: "PROMEDIO DE % DE REGULACIÓN", value: `${Math.round(avgReg)}%`, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    ];
  }, [filteredData]);

  const productList = useMemo(() => {
    const products = [...new Set(filteredData.map(r => r.Producto as string))] as string[];
    return products.sort((a: string, b: string) => {
      const priority: Record<string, number> = { 'SLIT': 1, 'LSI (S)': 2 };
      const aPrio = priority[a] || 99;
      const bPrio = priority[b] || 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.localeCompare(b);
    });
  }, [filteredData]);

  // Automatic report image generation effect
  useEffect(() => {
    if (!rawData || rawData.length === 0 || !selectedDate) return;

    const runAutomaticCapture = async () => {
      const savedImages = localStorage.getItem('sqm_gallery_images');
      let currentImagesList: GalleryImage[] = [];
      if (savedImages) {
        try {
          currentImagesList = JSON.parse(savedImages);
        } catch (e) {
          console.error(e);
        }
      }

      const prefixKpiId = `auto_kpi_${selectedDate}`;
      const prefixChartId = `auto_chart_${selectedDate}`;
      const prefixProductsIds = productList.map(p => `auto_prod_${p.replace(/\s+/g, '_')}_${selectedDate}`);

      const hasKpis = currentImagesList.some(img => img.id === prefixKpiId);
      const hasChart = currentImagesList.some(img => img.id === prefixChartId);
      const hasProducts = prefixProductsIds.every(id => currentImagesList.some(img => img.id === id));

      if (hasKpis && hasChart && hasProducts) {
        return; // Already exists, don't regenerate
      }

      setIsGeneratingAuto(true);
      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const generatedList: GalleryImage[] = [];

      try {
        // 1. Capture KPIs
        if (!hasKpis) {
          const kpiEl = document.getElementById('capture-kpis-executive');
          if (kpiEl) {
            const canvas = await html2canvas(kpiEl, { scale: 1.5, useCORS: true });
            generatedList.push({
              id: prefixKpiId,
              url: canvas.toDataURL('image/jpeg', 0.9),
              name: `INFORME OPERATIVO - CUMPLIMIENTO GLOBAL (${formatDateToCL(selectedDate)})`,
              date: formatDateToCL(selectedDate)
            });
          }
        }

        // 2. Capture Composed Chart
        if (!hasChart) {
          const chartEl = document.getElementById('capture-composed-chart');
          if (chartEl) {
            const canvas = await html2canvas(chartEl, { scale: 1.5, useCORS: true });
            generatedList.push({
              id: prefixChartId,
              url: canvas.toDataURL('image/jpeg', 0.9),
              name: `ANÁLISIS COMPARATIVO (${formatDateToCL(selectedDate)})`,
              date: formatDateToCL(selectedDate)
            });
          }
        }

        // 3. Capture Products
        for (let i = 0; i < productList.length; i++) {
          const prod = productList[i];
          const prodId = prefixProductsIds[i];
          const hasProd = currentImagesList.some(img => img.id === prodId);
          if (!hasProd) {
            const prodEl = document.getElementById(`capture-product-${i}`);
            if (prodEl) {
              const canvas = await html2canvas(prodEl, { scale: 1.5, useCORS: true });
              generatedList.push({
                id: prodId,
                url: canvas.toDataURL('image/jpeg', 0.9),
                name: `AUDITORÍA DE DESEMPEÑO - ${prod} (${formatDateToCL(selectedDate)})`,
                date: formatDateToCL(selectedDate)
              });
            }
          }
        }

        if (generatedList.length > 0) {
          setImages(prev => {
            const filteredPrev = prev.filter(p => !generatedList.some(g => g.id === p.id));
            const newList = [...generatedList, ...filteredPrev];
            localStorage.setItem('sqm_gallery_images', JSON.stringify(newList));
            return newList;
          });
        }
      } catch (err) {
        console.error("Error generating automatic report images:", err);
      } finally {
        setIsGeneratingAuto(false);
      }
    };

    runAutomaticCapture();
  }, [rawData, selectedDate, productList]);

  // Autoplay Effect
  useEffect(() => {
    let interval: any;
    if (autoPlay && images.length > 0 && !isFullScreen) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, intervalTime * 1000);
    }
    return () => clearInterval(interval);
  }, [autoPlay, images.length, intervalTime, isFullScreen]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: GalleryImage = {
          id: Math.random().toString(36).substr(2, 9),
          url: e.target?.result as string,
          name: file.name,
          date: new Date().toLocaleDateString()
        };
        setImages(prev => [newImage, ...prev]);

        // Record Image upload activity log in Firestore
        try {
          const savedUser = localStorage.getItem('sqm_current_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            import('../services/firebase').then(async ({ logActivity }) => {
              await logActivity(
                parsedUser,
                'Subió Evidencia',
                `Cargó una nueva imagen de terreno (${file.name}) a la Galería Operativa.`
              );
            }).catch(err => console.error(err));
          }
        } catch (err) {
          console.error('Error logging image upload:', err);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteImage = (id: string) => {
    const imgToDelete = images.find(img => img.id === id);
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    if (currentIndex >= newImages.length) {
      setCurrentIndex(Math.max(0, newImages.length - 1));
    }

    // Record Image deletion activity log in Firestore
    try {
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        import('../services/firebase').then(async ({ logActivity }) => {
          await logActivity(
            parsedUser,
            'Eliminó Evidencia',
            `Eliminó la imagen (${imgToDelete?.name || 'sin_nombre'}) de la Galería Operativa.`
          );
        }).catch(err => console.error(err));
      }
    } catch (err) {
      console.error('Error logging image delete:', err);
    }
  };

  const nextSlide = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevSlide = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const openFullScreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (images.length > 0) {
      setIsFullScreen(true);
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          await (docEl as any).mozRequestFullScreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen();
        }
      } catch (err) {
        console.error("Error requesting native fullscreen:", err);
      }
    }
  };

  const closeFullScreen = async () => {
    setIsFullScreen(false);
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error exiting native fullscreen:", err);
    }
  };

  // Sync React state with browser's native fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          closeFullScreen();
        } else {
          onBack();
        }
      }
      
      if (images.length === 0) return;
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, nextSlide, prevSlide, isFullScreen, onBack]);

  return (
    <div className="min-h-screen bg-calido flex flex-col font-sans text-tecnico relative">
      {/* Header */}
      <header className="bg-white border-b border-violeta/10 p-6 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-violeta hover:text-nucleo font-black text-[10px] uppercase tracking-widest transition-colors group"
          >
            <Home size={14} className="group-hover:-translate-x-1 transition-transform" /> Menú
          </button>
          <div className="h-8 w-px bg-violeta/10" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-[950] text-nucleo tracking-tighter uppercase leading-none">Galería Operativa</h1>
            <p className="text-[10px] font-bold text-violeta/60 uppercase tracking-[0.3em] mt-1">Registro Visual de Faena</p>
          </div>
          {isGeneratingAuto && (
            <div className="flex items-center gap-2 bg-ionizado/10 px-4 py-2 rounded-full border border-ionizado/20 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ionizado" />
              <span className="text-[9px] font-black text-ionizado uppercase tracking-wider">Sincronizando reportes automáticos...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Autoplay Controls */}
          {images.length > 0 && (
            <div className="bg-calido/50 rounded-2xl p-1 flex items-center gap-1 border border-violeta/5">
              <button 
                onClick={() => setAutoPlay(!autoPlay)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${autoPlay ? 'bg-ionizado text-white shadow-lg' : 'bg-white text-violeta hover:bg-white'}`}
              >
                {autoPlay ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                {autoPlay ? 'Reproduciendo' : 'Autoplay'}
              </button>
              
              <div className="flex items-center gap-2 px-3">
                <Timer size={12} className="text-violeta/40" />
                <select 
                  value={intervalTime} 
                  onChange={(e) => setIntervalTime(Number(e.target.value))}
                  className="bg-transparent text-[10px] font-black text-violeta uppercase outline-none cursor-pointer"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={40}>40s</option>
                  <option value={45}>45s</option>
                </select>
              </div>
            </div>
          )}

          <label className="bg-nucleo text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-nucleo/90 transition-all cursor-pointer shadow-lg shadow-nucleo/10 active:scale-95">
            <Plus size={14} strokeWidth={3} /> Subir Imágenes
            <input 
              type="file" 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={(e) => handleFileUpload(e.target.files)} 
            />
          </label>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-12">
        {images.length === 0 ? (
          <div 
            className={`
              w-full h-[60vh] border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center space-y-6 transition-all duration-500
              ${dragActive ? 'border-ionizado bg-ionizado/5' : 'border-violeta/10 bg-white/50'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-violeta/20 shadow-sm border border-violeta/5">
              <ImageIcon size={48} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-nucleo uppercase tracking-tight">No hay imágenes</h2>
              <p className="text-violeta/60 font-medium mt-1">Arrastra tus archivos aquí o usa el botón de subida.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Carousel */}
            <section className="relative group">
              <div className="aspect-[21/9] w-full bg-tecnico rounded-[3rem] overflow-hidden shadow-2xl relative carousel-container">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`
                      absolute inset-0 transition-all duration-700 ease-in-out flex items-center justify-center
                      ${idx === currentIndex ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-110 pointer-events-none z-0'}
                    `}
                  >
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay Info (Static per slide but simplified) */}
                    <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none">
                      <div className="text-white space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">{img.date}</p>
                        <h3 className="text-3xl font-black tracking-tight">{img.name}</h3>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Single Stable Fullscreen Button */}
                <div className="absolute bottom-12 right-12 z-40">
                  <button 
                    onClick={openFullScreen}
                    className="w-16 h-16 bg-white/20 backdrop-blur-2xl rounded-2xl flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/30 cursor-pointer shadow-[0_0_40px_rgba(0,0,0,0.3)] group/btn"
                    title="Pantalla Completa"
                  >
                    <Maximize2 size={28} className="group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Controls */}
                <div className="absolute inset-y-0 left-0 w-32 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button 
                    onClick={prevSlide}
                    className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/20"
                  >
                    <ChevronLeft size={32} />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button 
                    onClick={nextSlide}
                    className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-nucleo transition-all border border-white/20"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>

                {/* Indicators */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 transition-all duration-500 rounded-full ${idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Grid View / Management */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-ionizado rounded-full" />
                  <h2 className="text-xl font-black text-nucleo uppercase tracking-tight">Biblioteca de Medios</h2>
                </div>
                <p className="text-[10px] font-black text-violeta/40 uppercase tracking-widest">{images.length} Archivos</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {images.map((img, idx) => (
                  <div 
                    key={img.id}
                    className={`
                      group relative aspect-square rounded-3xl overflow-hidden border-2 transition-all duration-300 cursor-pointer
                      ${idx === currentIndex ? 'border-ionizado ring-4 ring-ionizado/10' : 'border-transparent hover:border-violeta/20'}
                    `}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-nucleo/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                        className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Fullscreen Overlay */}
      {isFullScreen && images[currentIndex] && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-300">
          {/* Background image blurred to fill space beautifully (ambient glow) */}
          <div 
            className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-30 select-none pointer-events-none" 
            style={{ backgroundImage: `url(${images[currentIndex].url})` }}
          />

          {/* Floating Top Header Control */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
            {/* Ambient Info Panel */}
            <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 flex flex-col gap-0.5 shadow-2xl pointer-events-auto">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">{images[currentIndex].date}</p>
              <h3 className="text-lg font-black tracking-tight text-white max-w-md truncate">{images[currentIndex].name}</h3>
            </div>

            {/* Floating Close Button */}
            <button 
              onClick={closeFullScreen}
              className="w-14 h-14 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/15 shadow-2xl cursor-pointer pointer-events-auto hover:scale-105 active:scale-95"
              title="Cerrar Pantalla Completa"
            >
              <X size={26} />
            </button>
          </div>
          
          {/* Main Full-Size Image Container */}
          <div className="w-full h-full flex items-center justify-center relative p-0 select-none">
            {/* Prev Trigger */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50">
              <button 
                onClick={prevSlide} 
                className="w-16 h-16 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                title="Imagen Anterior"
              >
                <ChevronLeft size={36} />
              </button>
            </div>

            {/* Image (Fills absolute maximum space with object-contain) */}
            <img 
              src={images[currentIndex].url} 
              alt={images[currentIndex].name} 
              className="w-full h-full max-w-full max-h-full object-contain shadow-2xl z-10 select-none animate-in fade-in zoom-in-95 duration-300" 
            />

            {/* Next Trigger */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50">
              <button 
                onClick={nextSlide} 
                className="w-16 h-16 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                title="Siguiente Imagen"
              >
                <ChevronRight size={36} />
              </button>
            </div>
          </div>

          {/* Bottom Slides Counter and Help Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-none">
            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        </div>
      )}
      {/* Hidden Offscreen Capture Area */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '1000px', 
          background: '#ffffff',
          pointerEvents: 'none'
        }}
      >
        {/* 1. KPIs Executive Cover */}
        <div id="capture-kpis-executive" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
          <div className="flex justify-between items-start pb-8 border-b-2 border-slate-200">
            <div className="flex flex-col items-start gap-4">
              <NovandinoLogo className="h-28 w-[400px] max-w-full" variant="print" />
              <div>
                <h1 className="text-4xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO</h1>
                <p className="text-violeta font-bold text-[9px] tracking-[0.4em] uppercase">Subgerencia Logística Litio - Despacho Litio</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-violeta font-bold text-[9px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
              <p className="text-3xl font-[900] text-ionizado tracking-tighter">{formatDateToCL(selectedDate)}</p>
            </div>
          </div>
          
          {filteredData.length > 0 && (
            <div className="bg-white rounded-[2rem] p-8 border-2 border-ionizado/10 border-l-[12px] border-l-ionizado space-y-6 shadow-sm mt-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-ionizado">
                  <span className="font-black uppercase tracking-[0.3em] text-[9px]">KPIs OPERATIVOS</span>
                </div>
                <h2 className="text-3xl font-[900] text-nucleo tracking-tighter uppercase">Cumplimiento Global</h2>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-4">
                {operationalKPIs?.map((kpi, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-calido flex flex-col gap-1 shadow-sm border-b-4 border-b-levanda">
                    <div className="flex items-center gap-1.5 text-black">
                      {kpi.icon}
                      <span className="text-[9px] font-black text-black uppercase tracking-widest">{kpi.label}</span>
                    </div>
                    <span className={`text-xl font-[900] ${kpi.status === 'danger' ? 'text-rose-600' : 'text-black'} tracking-tighter`}>
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Composed Chart */}
        <div id="capture-composed-chart" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div className="flex flex-col">
              <p className="text-[9px] font-black text-ionizado uppercase tracking-[0.3em]">Análisis Gráfico</p>
              <h2 className="text-3xl font-[950] text-nucleo uppercase tracking-tight">Comparación de Despacho</h2>
            </div>
            <p className="text-xs font-black text-violeta uppercase tracking-widest">{formatDateToCL(selectedDate)}</p>
          </div>
          <div className="pt-6">
            {filteredData.length > 0 && (
              <ChartCard 
                type="composed" 
                xAxis="Producto" 
                yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} 
                title="Análisis Comparativo" 
                data={filteredData} 
              />
            )}
          </div>
        </div>

        {/* 3. Products Details */}
        {productList.map((prod, idx) => (
          <div key={prod} id={`capture-product-${idx}`} style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
            <ProductDetailSection 
              product={prod} 
              data={filteredData.filter(d => d.Producto === prod)} 
              date={selectedDate || ''} 
              index={idx + 1} 
              total={productList.length} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};
