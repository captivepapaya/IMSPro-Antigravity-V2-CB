
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, Camera, Loader2, ArrowUp, ArrowDown, Search, Check
} from 'lucide-react';
import { 
  InventoryItem, CsvFile, WordPressConfig, AiAnalysisResult 
} from '../types';
import { 
  processRawData, getAiContextSubCategories, searchInventoryByAi 
} from '../services/dataProcessor';
import { geminiService } from '../services/geminiService';
import { synonymService } from '../services/synonymService';
import { fetchWpImage } from '../services/wpService';

interface AiTerminalProps {
  files: CsvFile[];
  wpConfig: WordPressConfig;
  onAddToCart: (item: InventoryItem, qty: number) => void;
  selectedCameraId?: string;
}

type ScoredInventoryItem = InventoryItem & {
  matchScore: number;
  matchReason: string;
  nameScore: number;
  colorScore: number;
};

// Internal Thumbnail Component
const Thumbnail = ({ sku, wpConfig }: { sku: string, wpConfig: WordPressConfig }) => {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        if(wpConfig.url && sku) fetchWpImage(sku, wpConfig).then(setSrc);
    }, [sku, wpConfig]);
    
    if(!src) return <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs">No Img</div>;
    return <img src={src} className="w-full h-full object-cover" />;
};

// Internal Result Card Component for Animation Logic
const ResultCard = ({ item, wpConfig, onAdd }: { item: ScoredInventoryItem, wpConfig: WordPressConfig, onAdd: (item: InventoryItem) => void }) => {
    const [isAdded, setIsAdded] = useState(false);

    const handleClick = () => {
        onAdd(item);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 500); // Reset after 500ms
    };

    return (
        <div 
            className="bg-dark-bg border border-dark-border hover:border-purple-500 rounded-xl overflow-hidden group transition-all flex flex-col h-full"
        >
            <div className="aspect-square bg-black relative flex-shrink-0">
                <Thumbnail sku={item.SKU} wpConfig={wpConfig} />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                    {item.matchScore}%
                </div>
            </div>
            <div className="p-3 flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                    <div className="font-bold text-white text-sm truncate w-20">{item.Code}</div>
                    <div className="font-mono text-green-400 text-sm font-bold">${item.ListPrice}</div>
                </div>
                <div className="text-xs text-gray-400 truncate mt-1 mb-auto">{item.Description}</div>
                <div className="mt-2 text-[10px] text-gray-600 flex justify-between">
                    <span>Match: {item.nameScore}%</span>
                    <span>Color: {item.colorScore}%</span>
                </div>
            </div>
            <button 
                onClick={handleClick}
                className={`w-full py-3 font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1 ${
                    isAdded 
                    ? 'bg-green-600 text-white scale-95' 
                    : 'bg-purple-600/10 text-purple-400 group-hover:bg-purple-600 group-hover:text-white'
                }`}
            >
                {isAdded ? <><Check className="w-3 h-3"/> ADDED!</> : 'ADD TO CART'}
            </button>
        </div>
    );
};

export const AiTerminal: React.FC<AiTerminalProps> = ({ 
    files, wpConfig, onAddToCart, selectedCameraId 
}) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // AI State
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>('');
    const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
    const [aiResults, setAiResults] = useState<ScoredInventoryItem[]>([]);
    const [aiSortConfig, setAiSortConfig] = useState<{ key: 'Price' | 'Color', direction: 'asc' | 'desc' } | null>(null);
    const [priceFilter, setPriceFilter] = useState<number | null>(null);
    const [availablePrices, setAvailablePrices] = useState<number[]>([]);

    useEffect(() => {
        if (files.length > 0) setInventory(processRawData(files));
    }, [files]);

    // Start Camera on Mount
    useEffect(() => {
        let mounted = true;
        const startCam = async () => {
            try {
                const constraints = { 
                    video: { 
                        deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
                        width: { ideal: 1280 }, 
                        height: { ideal: 720 } 
                    } 
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (mounted) {
                    setVideoStream(stream);
                    if (videoRef.current) videoRef.current.srcObject = stream;
                } else {
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch (e) {
                console.error("AI Camera Error", e);
            }
        };
        startCam();
        return () => {
            mounted = false;
            if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        };
    }, [selectedCameraId]);

    const handleCapture = () => {
        if (!videoRef.current || capturedImages.length >= 4) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const b64 = canvas.toDataURL('image/jpeg', 0.6);
            setCapturedImages(p => [...p, b64]);
            // Reset previous results on new capture batch start
            if (aiResults.length > 0) {
                setAiResults([]);
                setAiAnalysis(null);
            }
        }
    };

    const handleAnalyze = async () => {
        if (capturedImages.length === 0) return;
        setIsAnalyzing(true);
        setAiStatus('Identifying...');
        
        try {
            const contextCats = getAiContextSubCategories(inventory);
            const res = await geminiService.analyzeImage(capturedImages, contextCats);
            
            if (res) {
                setAiStatus('Finding Matches...');
                setAiAnalysis(res);
                const matches = searchInventoryByAi(inventory, res);
                setAiResults(matches);
                
                const prices = Array.from(new Set(matches.map(m => m.ListPrice))).sort((a,b) => a-b);
                setAvailablePrices(prices);
                setPriceFilter(null);
                // Optional: setCapturedImages([]); // Keep images visible for reference
            } else {
                setAiStatus('No Match Found');
            }
        } catch (e: any) {
            alert("AI Error: " + e.message);
            setAiStatus('Error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSelectProduct = (item: InventoryItem) => {
        onAddToCart(item, 1);
    };

    const toggleAiSort = (key: 'Price' | 'Color') => { 
        setAiSortConfig(current => { 
            if (current?.key === key) { 
                return current.direction === 'asc' ? { key, direction: 'desc' } : null; 
            } 
            return { key, direction: 'asc' }; 
        }); 
    };

    const displayedResults = useMemo(() => {
        let res = [...aiResults];
        if (priceFilter !== null) { res = res.filter(i => i.ListPrice === priceFilter); }
        if (aiSortConfig) {
           res.sort((a, b) => {
              if (aiSortConfig.key === 'Price') { return aiSortConfig.direction === 'asc' ? a.ListPrice - b.ListPrice : b.ListPrice - a.ListPrice; }
              if (aiSortConfig.key === 'Color') { 
                  const cA = String(a.Color || '').trim().toLowerCase(); 
                  const cB = String(b.Color || '').trim().toLowerCase(); 
                  if (cA < cB) return aiSortConfig.direction === 'asc' ? -1 : 1; 
                  if (cA > cB) return aiSortConfig.direction === 'asc' ? 1 : -1; 
                  return 0; 
              }
              return 0;
           });
        }
        return res;
    }, [aiResults, aiSortConfig, priceFilter]);

    return (
        <div className="h-full flex flex-col p-4 gap-4">
            
            {/* Header / Top Bar */}
            <div className="flex justify-between items-center bg-dark-surface p-4 rounded-xl border border-dark-border flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-400" /> AI Terminal
                    </h1>
                    <p className="text-gray-400 text-sm">Capture plant images for intelligent identification.</p>
                </div>
                <div className="flex gap-2">
                    {/* Status Indicator */}
                    {isAnalyzing && (
                        <div className="px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-purple-300 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> {aiStatus}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* LEFT: Camera & Capture */}
                <div className="w-1/3 flex flex-col gap-4">
                    
                    {/* 1. Captured Images Strip (Top) */}
                    <div className="h-20 bg-dark-surface rounded-xl border border-dark-border p-2 flex gap-2 items-center flex-shrink-0">
                        {capturedImages.map((img, i) => (
                            <div key={i} className="h-full aspect-square bg-black rounded overflow-hidden border border-gray-600 relative group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => setCapturedImages(p => p.filter((_, idx) => idx !== i))}
                                    className="absolute inset-0 bg-red-900/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity"
                                >
                                    X
                                </button>
                            </div>
                        ))}
                        {capturedImages.length === 0 && (
                            <div className="flex-1 text-center text-gray-600 text-xs italic">Captured photos appear here</div>
                        )}
                        {capturedImages.length > 0 && (
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="ml-auto px-4 h-full bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all flex flex-col items-center justify-center min-w-[80px] shadow-lg"
                            >
                                <Sparkles className="w-5 h-5 mb-1" />
                                Identify
                            </button>
                        )}
                    </div>

                    {/* 2. Camera Preview (Square) */}
                    <div className="w-full aspect-square bg-black rounded-xl overflow-hidden border border-purple-500/20 relative shadow-lg">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        
                        {/* Capture Button Overlay */}
                        <div className="absolute bottom-6 inset-x-0 flex justify-center z-20">
                            <button 
                                onClick={handleCapture}
                                className="w-20 h-20 rounded-full border-4 border-white/50 bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all shadow-xl"
                            >
                                <div className="w-16 h-16 bg-white rounded-full shadow-inner"></div>
                            </button>
                        </div>

                        {/* Analysis Overlay Info */}
                        {aiAnalysis && (
                            <div className="absolute top-4 left-4 right-4 bg-black/70 backdrop-blur p-3 rounded-lg border border-purple-500/30 text-xs pointer-events-none">
                                <div className="text-purple-300 font-bold mb-1">AI Detected:</div>
                                <div className="text-white text-sm">{aiAnalysis.simpleName}</div>
                                <div className="text-gray-400">Color: {aiAnalysis.color}</div>
                            </div>
                        )}
                    </div>

                </div>

                {/* RIGHT: Results Grid */}
                <div className="flex-1 flex flex-col bg-dark-surface rounded-xl border border-dark-border overflow-hidden shadow-lg">
                    {/* Filter Bar - Conditional */}
                    {aiResults.length > 0 && (
                        <div className="p-3 border-b border-dark-border bg-dark-bg/50 flex gap-2 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-top-2">
                            <button onClick={() => toggleAiSort('Price')} className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs font-bold text-gray-300 flex items-center gap-1 whitespace-nowrap hover:text-white">
                                Price {aiSortConfig?.key === 'Price' && (aiSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                            </button>
                            <div className="w-px h-6 bg-gray-700 mx-1"></div>
                            {availablePrices.map(p => (
                                <button 
                                    key={p} 
                                    onClick={() => setPriceFilter(curr => curr === p ? null : p)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${priceFilter === p ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                                >
                                    ${p}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                        {displayedResults.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center animate-pulse">
                                        <Sparkles className="w-16 h-16 mb-4 text-purple-500 opacity-50" />
                                        <p>Analyzing botanical features...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Search className="w-16 h-16 mb-4 opacity-20" />
                                        <p>Capture images to find matching products</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                {displayedResults.map(item => (
                                    <ResultCard 
                                        key={item.Code} 
                                        item={item} 
                                        wpConfig={wpConfig} 
                                        onAdd={handleSelectProduct} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
