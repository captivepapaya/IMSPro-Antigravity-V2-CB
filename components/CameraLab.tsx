
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, RefreshCcw, Video, AlertTriangle, Monitor, Play, StopCircle, Aperture, Image as ImageIcon, ChevronDown, Layers, Loader2, ZoomIn, X, RotateCw, RotateCcw, RefreshCw, Plus, Trash2, Save, Eye, Palette, Check } from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';

interface CameraLabProps {
    preferredDeviceId?: string;
}

// --- COLOR CONFIGURATION ---
type ColorOption = { label: string; hex: string };

const SUBJECT_COLORS = [
  { id: 'white', label: 'White', dotColor: '#FFFFFF', border: true },
  { id: 'purple', label: 'Purple', dotColor: '#A855F7', border: false },
  { id: 'pink', label: 'Pink', dotColor: '#EC4899', border: false },
  { id: 'red', label: 'Red', dotColor: '#EF4444', border: false },
  { id: 'yellow', label: 'Yellow', dotColor: '#EAB308', border: false },
  { id: 'blue', label: 'Blue', dotColor: '#3B82F6', border: false },
  { id: 'green', label: 'Green', dotColor: '#22C55E', border: false },
];

const BG_PALETTES: Record<string, ColorOption[]> = {
  white: [
    { label: 'Lt Gray', hex: '#F3F4F6' },
    { label: 'Beige', hex: '#F5F5DC' },
    { label: 'Sand', hex: '#E6E2D3' },
    { label: 'Dk Gray', hex: '#4B5563' },
  ],
  purple: [
    { label: 'Warm Gray', hex: '#E7E5E4' },
    { label: 'Sand', hex: '#E6E2D3' },
    { label: 'Cool Gray', hex: '#F1F5F9' },
    { label: 'Dk Gray', hex: '#374151' },
  ],
  pink: [
    { label: 'Blue Gray', hex: '#CBD5E1' },
    { label: 'Khaki', hex: '#D4C4A8' },
    { label: 'Lt Gray', hex: '#F3F4F6' },
    { label: 'Sand', hex: '#E6E2D3' },
  ],
  red: [
    { label: 'Teal Gray', hex: '#CAD4D4' },
    { label: 'Lt Gray', hex: '#F3F4F6' },
    { label: 'Dk Gray', hex: '#374151' },
  ],
  yellow: [
    { label: 'Pale Purple', hex: '#F3E8FF' },
    { label: 'Cool Gray', hex: '#F1F5F9' },
    { label: 'Sand', hex: '#E6E2D3' },
  ],
  blue: [
    { label: 'Warm Gray', hex: '#E7E5E4' },
    { label: 'Beige', hex: '#F5F5DC' },
    { label: 'Sand', hex: '#E6E2D3' },
  ],
  green: [
    { label: 'Lt Gray', hex: '#F3F4F6' },
    { label: 'Sand', hex: '#E6E2D3' },
    { label: 'Dk Gray', hex: '#374151' },
  ]
};

export const CameraLab: React.FC<CameraLabProps> = ({ preferredDeviceId }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{w: number, h: number}>({ w: 1920, h: 1080 });
  
  // Capture & Processing State
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [enableBgRemoval, setEnableBgRemoval] = useState(true); 
  
  // Advanced Color Logic
  const [isTransparent, setIsTransparent] = useState(false);
  const [subjectColor, setSubjectColor] = useState<string>('white');
  const [selectedBgHex, setSelectedBgHex] = useState<string>(BG_PALETTES['white'][0].hex);

  // Update BG Hex when Subject Color changes
  useEffect(() => {
      const palette = BG_PALETTES[subjectColor];
      if (palette && palette.length > 0) {
          // Default to the first color in the new palette
          setSelectedBgHex(palette[0].hex);
      }
  }, [subjectColor]);
  
  // Grid State (Max 4 images)
  const [gridImages, setGridImages] = useState<string[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null); 
  const [modalSource, setModalSource] = useState<'raw' | 'processed' | 'grid'>('raw'); 
  const [rotation, setRotation] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const RESOLUTIONS = [
    { label: 'HD (720p)', w: 1280, h: 720 },
    { label: 'FHD (1080p)', w: 1920, h: 1080 },
    { label: '4K (2160p)', w: 3840, h: 2160 },
  ];

  useEffect(() => {
    refreshDevices();
    return () => stopStream();
  }, []);

  useEffect(() => {
      if (preferredDeviceId && !selectedDeviceId) {
          setSelectedDeviceId(preferredDeviceId);
      }
  }, [preferredDeviceId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn("Auto-play prevented:", e));
    }
  }, [stream]);

  const refreshDevices = async () => {
    try {
      const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
      permStream.getTracks().forEach(t => t.stop());
      
      const list = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = list.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      
      if (!selectedDeviceId && videoDevices.length > 0) {
          const match = preferredDeviceId ? videoDevices.find(d => d.deviceId === preferredDeviceId) : null;
          setSelectedDeviceId(match ? match.deviceId : videoDevices[0].deviceId);
      }
    } catch (e: any) {
      setError(`Access Denied: ${e.message}`);
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleStream = async () => {
    if (stream) {
        stopStream();
        return;
    }
    setError(null);
    setIsStarting(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: resolution.w },
          height: { ideal: resolution.h }
        }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
    } catch (e: any) {
      setError(`Error: ${e.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCapture = async () => {
      if (!videoRef.current) return;
      
      setRawImage(null);
      setProcessedImage(null);
      setIsProcessingBg(true);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      
      // Always Crop 1:1 from center
      const size = Math.min(vw, vh);
      const sx = (vw - size) / 2;
      const sy = (vh - size) / 2;
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d')?.drawImage(video, sx, sy, size, size, 0, 0, size, size);
      
      const rawUrl = canvas.toDataURL('image/jpeg', 0.95);
      setRawImage(rawUrl);

      if (enableBgRemoval) {
          try {
              const blob = await removeBackground(rawUrl, {
                  progress: (key: string, current: number, total: number) => { /* Optional logging */ }
              });
              
              const transparentUrl = URL.createObjectURL(blob);
              
              if (isTransparent) {
                  setProcessedImage(transparentUrl);
              } else {
                  const img = new Image();
                  img.src = transparentUrl;
                  await new Promise(r => { img.onload = r; });
                  
                  const compCanvas = document.createElement('canvas');
                  compCanvas.width = canvas.width;
                  compCanvas.height = canvas.height;
                  const ctx = compCanvas.getContext('2d');
                  
                  if (ctx) {
                      // Fill Background with Selected Hex
                      ctx.fillStyle = selectedBgHex;
                      ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);
                      ctx.drawImage(img, 0, 0);
                      setProcessedImage(compCanvas.toDataURL('image/jpeg', 0.95));
                  }
              }
          } catch (e: any) {
              console.error("BG Removal failed", e);
          } finally {
              setIsProcessingBg(false);
          }
      } else {
          setIsProcessingBg(false);
          setProcessedImage(rawUrl);
      }
  };

  // --- Modal Logic ---
  const openEditor = (img: string, source: 'raw' | 'processed' | 'grid') => {
      setModalImage(img);
      setModalSource(source);
      setRotation(0);
      setShowModal(true);
  };

  const rotateImage = (deg: number) => {
      setRotation(prev => prev + deg);
  };

  const saveEditedImage = async () => {
      if (!modalImage) return;
      if (rotation === 0) { setShowModal(false); return; }

      const img = new Image();
      img.src = modalImage;
      await new Promise(r => { img.onload = r; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          
          const newUrl = canvas.toDataURL('image/jpeg', 0.95);
          
          if (modalSource === 'raw') setRawImage(newUrl);
          if (modalSource === 'processed') setProcessedImage(newUrl);
      }
      setShowModal(false);
  };

  // --- Grid Logic ---
  const addToGrid = (imgUrl: string) => {
      if (gridImages.length >= 4) {
          alert("Grid is full (Max 4). Please delete an image first.");
          return;
      }
      setGridImages(prev => [...prev, imgUrl]);
  };

  const removeFromGrid = (index: number) => {
      setGridImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg text-gray-200 overflow-hidden relative">
      
      {/* --- MODAL OVERLAY --- */}
      {showModal && modalImage && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
              <button onClick={() => { setShowModal(false); setRotation(0); setModalImage(null); }} className="absolute top-4 right-4 p-2 bg-dark-surface border border-dark-border rounded-full hover:bg-red-900/50 hover:border-red-500 text-gray-400 hover:text-white transition-all z-50"><X className="w-6 h-6"/></button>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-dark-surface/80 backdrop-blur border border-dark-border rounded-full px-6 py-3 shadow-2xl z-50">
                  {modalSource !== 'grid' && (
                      <>
                        <button onClick={() => rotateImage(-90)} className="p-2 hover:bg-white/10 rounded-full text-white" title="Rotate Left"><RotateCcw className="w-6 h-6"/></button>
                        <button onClick={() => setRotation(0)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white" title="Reset"><RefreshCw className="w-5 h-5"/></button>
                        <button onClick={() => rotateImage(90)} className="p-2 hover:bg-white/10 rounded-full text-white" title="Rotate Right"><RotateCw className="w-6 h-6"/></button>
                        <div className="w-px h-6 bg-gray-600 mx-2"></div>
                        <button onClick={saveEditedImage} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
                      </>
                  )}
                  {modalSource === 'grid' && <span className="text-sm text-gray-400 font-bold uppercase">View Only</span>}
              </div>
              <div className="w-[80%] h-[80%] flex items-center justify-center relative overflow-hidden">
                  <img src={modalImage} className="max-w-full max-h-full object-contain transition-transform duration-300 shadow-2xl border border-white/10" style={{ transform: `rotate(${rotation}deg)` }}/>
              </div>
          </div>
      )}

      {/* --- HEADER --- */}
      <div className="h-14 border-b border-dark-border bg-dark-surface flex items-center px-4 gap-4 flex-shrink-0 z-20">
        <div className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 rounded-lg bg-gemini-600/20 flex items-center justify-center text-gemini-400"><Camera className="w-5 h-5" /></div>
            <h1 className="font-bold text-white whitespace-nowrap hidden md:block">Camera Studio</h1>
        </div>
        <div className="h-6 w-px bg-dark-border mx-2"></div>
        <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar">
            {/* Cam & Res */}
            <div className="relative group min-w-[120px] max-w-[200px]">
                <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-md py-1.5 pl-2 pr-8 text-xs text-white outline-none focus:border-gemini-500 appearance-none truncate">
                    {devices.length === 0 && <option>No Cams</option>}
                    {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unknown Camera'}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>
            <div className="relative min-w-[70px]">
                <select value={`${resolution.w}x${resolution.h}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); setResolution({ w, h }); }} className="w-full bg-dark-bg border border-dark-border rounded-md py-1.5 pl-2 pr-6 text-xs text-white outline-none focus:border-gemini-500 appearance-none">
                    {RESOLUTIONS.map(r => <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>

            {/* BG Controls Group */}
            <div className="flex items-center gap-2 bg-dark-bg rounded-md border border-dark-border p-1 ml-2">
                <button onClick={() => setEnableBgRemoval(!enableBgRemoval)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${enableBgRemoval ? 'bg-purple-900/30 text-purple-300' : 'text-gray-500 hover:text-gray-300'}`} title="Toggle AI BG Removal">
                    <Layers className="w-3.5 h-3.5" /> <span className="hidden xl:inline">AI BG</span>
                </button>
                
                {enableBgRemoval && (
                    <>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        
                        {/* Transparent Toggle */}
                        {/* FIXED: Added 'relative' class to prevent absolute child span from overflowing viewport */}
                        <button 
                            onClick={() => setIsTransparent(!isTransparent)} 
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors relative ${isTransparent ? 'bg-gray-600 border-gray-400 text-white' : 'bg-transparent border-gray-600 text-transparent hover:border-gray-400'}`}
                            title="Transparent Background"
                        >
                            <span className="bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-gray-700 w-full h-full rounded opacity-50 absolute inset-0 pointer-events-none"></span>
                            {isTransparent && <Check className="w-3 h-3 relative z-10"/>}
                        </button>

                        {!isTransparent && (
                            <>
                                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                                {/* Subject Color Dots */}
                                <div className="flex gap-1.5">
                                    {SUBJECT_COLORS.map(c => (
                                        <button 
                                            key={c.id} 
                                            onClick={() => setSubjectColor(c.id)}
                                            className={`w-4 h-4 rounded-full transition-transform ${subjectColor === c.id ? 'scale-125 ring-1 ring-white ring-offset-1 ring-offset-dark-bg' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                            style={{ backgroundColor: c.dotColor, border: c.border ? '1px solid #555' : 'none' }}
                                            title={`Subject: ${c.label}`}
                                        />
                                    ))}
                                </div>
                                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                                {/* Background Palette Rects */}
                                <div className="flex gap-1">
                                    {BG_PALETTES[subjectColor]?.map((bgOpt, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => setSelectedBgHex(bgOpt.hex)}
                                            className={`w-6 h-4 rounded-sm transition-all border ${selectedBgHex === bgOpt.hex ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                            style={{ backgroundColor: bgOpt.hex }}
                                            title={`BG: ${bgOpt.label}`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <button onClick={toggleStream} disabled={isStarting} className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${stream ? 'bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50' : 'bg-green-600 text-white border border-green-500 hover:bg-green-500'}`}>
                {stream ? <StopCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {stream ? 'STOP' : 'START'}
            </button>
        </div>
      </div>

      {/* --- MAIN WORKSPACE --- */}
      <div className="flex-1 flex flex-col min-h-0">
          
          {/* TOP ROW: 4 COLUMNS (1:1 Aspect Ratio enforced) */}
          <div className="w-full border-b border-dark-border grid grid-cols-4 divide-x divide-dark-border bg-black/20 flex-shrink-0">
              
              {/* COL 1: LIVE FEED (Center Crop) */}
              <div className="relative group aspect-square">
                  <div className="absolute top-2 left-2 z-20 text-[10px] font-bold text-white/50 uppercase tracking-widest bg-black/50 px-2 rounded pointer-events-none">Live (1:1)</div>
                  {stream && !isProcessingBg && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <button onClick={handleCapture} className="w-[40%] aspect-square rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/50 shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center justify-center transform active:scale-95 transition-all cursor-pointer group-hover:animate-pulse-slow hover:bg-white/30" title="Click to Capture">
                              <div className="w-[85%] h-[85%] rounded-full bg-white/80 shadow-inner"></div>
                          </button>
                      </div>
                  )}
                  <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
                      {error ? <div className="text-red-400 flex flex-col items-center gap-2"><AlertTriangle className="w-8 h-8"/><span>{error}</span></div> : stream ? (
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" onLoadedMetadata={() => videoRef.current?.play()} />
                      ) : <div className="text-gray-700 flex flex-col items-center"><Video className="w-12 h-12 opacity-20 mb-2"/> Inactive</div>}
                  </div>
              </div>

              {/* COL 2: RAW CAPTURE (1:1) */}
              <div className="relative group aspect-square bg-dark-bg">
                  <div className="absolute top-2 left-2 z-20 text-[10px] font-bold text-white/50 uppercase tracking-widest bg-black/50 px-2 rounded pointer-events-none">Raw Capture</div>
                  {rawImage && (
                      <div className="absolute inset-0 z-30 flex items-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
                          <button onClick={() => addToGrid(rawImage)} className="h-full w-1/2 flex flex-col items-center justify-center gap-2 hover:bg-white/10 text-white border-r border-white/10 transition-colors">
                              <Plus className="w-8 h-8"/> <span className="text-xs font-bold uppercase">Add to Grid</span>
                          </button>
                          <button onClick={() => openEditor(rawImage, 'raw')} className="h-full w-1/2 flex flex-col items-center justify-center gap-2 hover:bg-white/10 text-white transition-colors">
                              <ZoomIn className="w-8 h-8"/> <span className="text-xs font-bold uppercase">Edit / View</span>
                          </button>
                      </div>
                  )}
                  <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                      {rawImage ? <img src={rawImage} className="w-full h-full object-cover" /> : <div className="text-gray-700 italic text-xs">No image</div>}
                  </div>
              </div>

              {/* COL 3: PROCESSED (1:1) */}
              <div className="relative group aspect-square bg-dark-surface/50">
                  <div className="absolute top-2 left-2 z-20 text-[10px] font-bold text-white/50 uppercase tracking-widest bg-black/50 px-2 rounded pointer-events-none">Processed</div>
                  {processedImage && !isProcessingBg && (
                      <div className="absolute inset-0 z-30 flex items-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
                          <button onClick={() => addToGrid(processedImage)} className="h-full w-1/2 flex flex-col items-center justify-center gap-2 hover:bg-white/10 text-white border-r border-white/10 transition-colors">
                              <Plus className="w-8 h-8"/> <span className="text-xs font-bold uppercase">Add to Grid</span>
                          </button>
                          <button onClick={() => openEditor(processedImage, 'processed')} className="h-full w-1/2 flex flex-col items-center justify-center gap-2 hover:bg-white/10 text-white transition-colors">
                              <ZoomIn className="w-8 h-8"/> <span className="text-xs font-bold uppercase">Edit / View</span>
                          </button>
                      </div>
                  )}
                  <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'conic-gradient(#808080 90deg, #404040 90deg 180deg, #808080 180deg 270deg, #404040 270deg)', backgroundSize: '20px 20px' }}></div>
                      {isProcessingBg ? <div className="flex flex-col items-center gap-3 text-purple-400 z-10"><Loader2 className="w-8 h-8 animate-spin"/><span className="text-xs font-mono">Processing...</span></div> : processedImage ? <img src={processedImage} className="w-full h-full object-cover z-10 relative" /> : <div className="text-gray-700 italic text-xs z-10">No image</div>}
                  </div>
              </div>

              {/* COL 4: GRID (2x2) */}
              <div className="aspect-square bg-black border-l border-dark-border grid grid-cols-2 grid-rows-2">
                  {[0, 1, 2, 3].map(idx => (
                      <div key={idx} className="relative border border-dark-border/30 overflow-hidden group">
                          {gridImages[idx] ? (
                              <>
                                  <img src={gridImages[idx]} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEditor(gridImages[idx], 'grid')} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-white"><Eye className="w-3 h-3"/></button>
                                      <button onClick={() => removeFromGrid(idx)} className="p-1.5 bg-red-900/80 hover:bg-red-800 rounded-full text-white"><Trash2 className="w-3 h-3"/></button>
                                  </div>
                              </>
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-800 text-[10px] font-mono">{idx + 1}</div>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* BOTTOM ROW: RESERVED */}
          <div className="flex-1 bg-dark-bg relative overflow-hidden flex items-center justify-center min-h-0">
              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
              <div className="border-2 border-dashed border-dark-border rounded-2xl w-3/4 h-3/4 flex flex-col items-center justify-center text-gray-600">
                  <Monitor className="w-12 h-12 opacity-20 mb-4" />
                  <h3 className="text-lg font-semibold">Reserved Workspace</h3>
                  <p className="text-sm opacity-50">Drag & Drop or Post-Processing Tools</p>
              </div>
          </div>

      </div>
    </div>
  );
};
