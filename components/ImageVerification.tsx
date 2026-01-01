import React, { useState, useMemo, useEffect } from 'react';
import { CsvFile, InventoryItem, ProductImageRecord } from '../types';
import { processRawData } from '../services/dataProcessor';
import { getProductImages } from '../services/db';
import { Search, Image, Database, AlertCircle, RefreshCcw } from 'lucide-react';

interface ImageVerificationProps {
    files: CsvFile[];
}

export const ImageVerification: React.FC<ImageVerificationProps> = ({ files }) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [dbImages, setDbImages] = useState<ProductImageRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize inventory from files
    useEffect(() => {
        if (files.length > 0) {
            setInventory(processRawData(files));
        }
    }, [files]);

    // Enhanced Fuzzy Search Logic (Same as IMS)
    const filteredItems = useMemo(() => {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        
        const query = searchTerm.toLowerCase().trim();
        // Split by spaces for AND logic (e.g. "red rose" -> must contain "red" AND "rose")
        const terms = query.split(/\s+/).filter(Boolean);

        return inventory
            .filter(item => {
                // Check if item matches ALL terms
                return terms.every(term => {
                    return (
                        (item.Code && item.Code.toLowerCase().includes(term)) ||
                        (item.SKU && item.SKU.toLowerCase().includes(term)) ||
                        (item.Description && item.Description.toLowerCase().includes(term)) ||
                        (item.nSubCategory && item.nSubCategory.toLowerCase().includes(term))
                    );
                });
            })
            .slice(0, 50); // Increased limit slightly for better browsing
    }, [inventory, searchTerm]);

    // Fetch images when item selected
    useEffect(() => {
        const fetchImages = async () => {
            if (!selectedItem || !selectedItem.SKU) {
                setDbImages([]);
                return;
            }
            setIsLoading(true);
            try {
                const imgs = await getProductImages(selectedItem.SKU);
                setDbImages(imgs);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchImages();
    }, [selectedItem]);

    if (files.length === 0) {
        return <div className="p-10 text-center text-gray-500">Please upload CORE data first to verify codes.</div>;
    }

    return (
        <div className="h-full flex gap-6 p-6">
            
            {/* LEFT: SELECTION PANEL */}
            <div className="w-[350px] flex flex-col gap-4 bg-dark-surface border border-dark-border rounded-xl p-4 shadow-lg">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Search className="w-5 h-5 text-gemini-400"/> Select Product</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500"/>
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search SKU, Code, Desc..."
                        className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:border-gemini-500 outline-none placeholder-gray-500"
                        autoFocus
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-dark-bg rounded-lg border border-dark-border">
                    {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                            {searchTerm.length < 2 ? "Type to search..." : "No matches found"}
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <div 
                                key={item._id} 
                                onClick={() => setSelectedItem(item)}
                                className={`p-3 border-b border-dark-border cursor-pointer transition-colors ${selectedItem?._id === item._id ? 'bg-gemini-900/30 border-l-4 border-l-gemini-500' : 'hover:bg-white/5'}`}
                            >
                                <div className="flex justify-between">
                                    <span className="font-bold text-white text-sm">{item.Code}</span>
                                    <span className="font-mono text-xs text-gemini-400">{item.SKU}</span>
                                </div>
                                <div className="text-xs text-gray-400 truncate mt-1">{item.Description}</div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* Search Stats Footer */}
                <div className="text-[10px] text-gray-500 text-center border-t border-dark-border pt-2">
                    Found {filteredItems.length} matches
                </div>
            </div>

            {/* RIGHT: DETAILS & IMAGE CHECK */}
            <div className="flex-1 flex flex-col gap-6">
                
                {/* Product Info Card */}
                {selectedItem ? (
                    <div className="bg-dark-surface border border-dark-border rounded-xl p-6 shadow-lg animate-in fade-in">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-white">{selectedItem.Description}</h1>
                                <div className="flex gap-4 mt-2 text-sm">
                                    <div className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-800">Code: {selectedItem.Code}</div>
                                    <div className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-800">SKU: {selectedItem.SKU}</div>
                                    <div className="bg-green-900/30 text-green-300 px-2 py-1 rounded border border-green-800">Price: ${selectedItem.ListPrice}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500 uppercase font-bold">Supabase Status</div>
                                <div className={`text-sm font-bold flex items-center gap-2 justify-end mt-1 ${dbImages.length > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin"/> : dbImages.length > 0 ? <><Database className="w-4 h-4"/> Indexed ({dbImages.length})</> : <><AlertCircle className="w-4 h-4"/> Not Indexed</>}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-dark-surface border border-dark-border rounded-xl p-10 flex flex-col items-center justify-center text-gray-500 h-[150px]">
                        <p>Select a product to view details</p>
                    </div>
                )}

                {/* Images Grid */}
                <div className="flex-1 bg-dark-bg border border-dark-border rounded-xl p-6 overflow-y-auto">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Image className="w-5 h-5 text-purple-400"/> Supabase Image Records
                    </h3>
                    
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40 text-gray-500 gap-2"><RefreshCcw className="w-6 h-6 animate-spin"/> Loading DB records...</div>
                    ) : !selectedItem ? (
                        <div className="text-center text-gray-600 h-40 flex items-center justify-center italic">Waiting for selection...</div>
                    ) : dbImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-dark-border rounded-xl">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20"/>
                            <p className="text-lg font-medium">No Records Found in Database</p>
                            <p className="text-sm mt-2 max-w-md text-center">
                                The SKU <b>{selectedItem.SKU}</b> has not been indexed in the `product_images` table yet. 
                                Run the "Image Index Builder" in Data Management to populate this data.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {dbImages.map((img, idx) => (
                                <div key={img.id} className="bg-dark-surface rounded-xl overflow-hidden border border-dark-border shadow-lg group relative">
                                    <div className="aspect-square bg-gray-900 relative">
                                        <img src={img.image_url} alt="DB Record" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">
                                            #{idx + 1}
                                        </div>
                                    </div>
                                    <div className="p-3 border-t border-dark-border bg-black/20">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${img.variant_type === 'main' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                                                {img.variant_type === 'main' ? 'MAIN IMAGE' : `VARIANT ${img.sort_order}`}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate font-mono mt-1" title={img.image_url}>
                                            {img.image_url.split('/').pop()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};