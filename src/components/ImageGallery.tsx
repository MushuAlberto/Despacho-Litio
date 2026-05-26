
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, Trash2, ChevronLeft, ChevronRight, 
  Image as ImageIcon, X, Home, Plus,
  Maximize2, Minimize2, Play, Pause, Timer
} from 'lucide-react';

interface GalleryImage {
  id: string;
  url: string;
  name: string;
  date: string;
}

interface ImageGalleryProps {
  onBack: () => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ onBack }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalTime, setIntervalTime] = useState(5); // en segundos

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
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteImage = (id: string) => {
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    if (currentIndex >= newImages.length) {
      setCurrentIndex(Math.max(0, newImages.length - 1));
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

  const openFullScreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (images.length > 0) {
      setIsFullScreen(true);
    }
  };

  const closeFullScreen = () => {
    setIsFullScreen(false);
  };

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
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-3xl flex flex-col">
          <div className="flex justify-between items-center p-8 text-white z-10">
            <div className="flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">{images[currentIndex].date}</p>
              <h3 className="text-2xl font-black tracking-tight">{images[currentIndex].name}</h3>
            </div>
            <button 
              onClick={closeFullScreen}
              className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/20 shadow-2xl cursor-pointer"
            >
              <X size={28} />
            </button>
          </div>
          
          <div className="flex-1 relative flex items-center justify-center p-12">
            <button onClick={prevSlide} className="absolute left-8 w-20 h-20 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all z-20 cursor-pointer"><ChevronLeft size={48} color="white" /></button>
            <img 
              src={images[currentIndex].url} 
              alt={images[currentIndex].name} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
            />
            <button onClick={nextSlide} className="absolute right-8 w-20 h-20 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all z-20 cursor-pointer"><ChevronRight size={48} color="white" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
