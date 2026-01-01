import React, { useEffect, useRef } from 'react';
import { Trash2, Image as ImageIcon, ExternalLink, Save, FolderOpen, Search, Loader, ZoomIn, X, Check, XCircle, ChevronDown, ChevronUp, RefreshCw, ShieldCheck, AlertTriangle, Edit3, Download } from 'lucide-react';
import { getSetting, saveSetting } from '../../services/db';
import { InventoryItem } from '../../types';
import { useVCAWorkflow } from '../../hooks/useVCAWorkflow';
import { DEFAULT_PROMPT_TEMPLATE } from '../../services/vertexService';
import { ProductInputForm } from './ProductInputForm';
import { HeightCalculator } from './HeightCalculator';
import { SceneSelector } from './SceneSelector';

export interface VCAContainerProps {
    initialProduct?: InventoryItem | null;
}

export const VCAContainer: React.FC<VCAContainerProps> = ({ initialProduct }) => {
    const { state, actions } = useVCAWorkflow();
    const initializedRef = useRef<string | null>(null);

    // Template Modal State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
    const [templateVal, setTemplateVal] = React.useState('');

    const handleOpenTemplateModal = () => {
        setTemplateVal(state.promptTemplate || DEFAULT_PROMPT_TEMPLATE);
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = async () => {
        await saveSetting('vca_prompt_template', templateVal);
        actions.setPromptTemplate(templateVal);
        setIsTemplateModalOpen(false);
    };

    // Auto-fill from inventory selection
    useEffect(() => {
        // Only initialize if we have a product and it's different or new
        if (initialProduct && initialProduct.Code !== initializedRef.current) {
            console.log('🪄 VCA Initializing with:', initialProduct.Code);
            initializedRef.current = initialProduct.Code;

            actions.setProduct({
                id: initialProduct.Code,
                name: initialProduct.Description,
                type: 'Plant', // Default inference
                dimensions: {
                    height_cm: initialProduct.HL || 0,
                    pot_height_cm: 15 // Default guess if unknown
                },
                assets: {
                    main_image: '', // Needs WP fetch logic if available elsewhere
                    detail_images: []
                }
            });
        }
    }, [initialProduct]);

    // Auto-calculate height when product or container changes
    useEffect(() => {
        if (state.product && state.container) {
            actions.calculateHeight();
        }
    }, [state.product, state.container, state.customLift, actions.calculateHeight]);

    // Trigger Final Generation
    useEffect(() => {
        if (state.currentStep === 'REFINEMENT') {
            actions.generateFinalScene();
        }
    }, [state.currentStep, actions]);

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
            <header className="flex-none flex justify-between items-center px-8 py-4 bg-white border-b shadow-sm z-20">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        Visual Commerce Agent <span className="text-blue-600">VCA</span>
                    </h1>
                    <p className="text-xs text-gray-500 font-medium tracking-wide mt-1">Generate photorealistic staged product imagery with physical accuracy.</p>
                </div>

                {/* Progress Stepper */}
                <div className="flex items-center space-x-2 text-sm">
                    {['INPUT', 'POTTED_PLANT', 'SCENE', 'GENERATE'].map((step, idx) => {
                        const isActive = state.currentStep.includes(step) || (state.currentStep === 'GENERATION_BASE' && step === 'SCENE') || (['REFINEMENT', 'OUTPUT'].includes(state.currentStep) && step === 'GENERATE');
                        return (
                            <React.Fragment key={step}>
                                <span className={`font-bold transition-colors ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
                                    0{idx + 1} {step.replace('_', ' ')}
                                </span>
                                {idx < 3 && <span className="text-gray-200">/</span>}
                            </React.Fragment>
                        );
                    })}
                </div>
            </header>

            <main className="flex-1 overflow-hidden relative">
                <div className={`h-full w-full ${state.currentStep === 'INPUT' ? '' : 'hidden'}`}>
                    <ProductInputForm
                        onProductChange={actions.setProduct}
                        onContainerChange={actions.setContainer}
                        onModelChange={actions.setModel}
                        onSceneChange={actions.setScene}
                        onConfirm={() => {
                            actions.nextStep();
                        }}
                        onSkipToScene={() => {
                            // Skip directly to Scene Selection (Step 3)
                            actions.skipToStep('GENERATION_BASE');
                        }}
                    />
                </div>

                {state.currentStep === 'POTTED_PLANT' && state.validationResult && (
                    <div className="h-full w-full overflow-y-auto p-4 animate-fade-in bg-gray-50">
                        <div className="flex flex-col lg:flex-row gap-6 h-full max-w-7xl mx-auto">
                            {/* Left Column: Logic & Controls */}
                            <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto">
                                <HeightCalculator
                                    visualTotalHeight={state.validationResult.visualTotalHeight}
                                    liftHeight={state.validationResult.liftHeight}
                                    productHeight={state.product?.dimensions.height_cm || 0}
                                    containerHeight={state.container?.dimensions.height_cm || 0}
                                    modelHeight={175}
                                    messages={state.validationResult.messages}
                                    showVisual={false}
                                />

                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center justify-around shadow-sm gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold text-blue-900 mb-1 uppercase tracking-wide">Lift Height</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => actions.setCustomLift(Math.max(0, state.validationResult!.liftHeight - 1))}
                                                className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-blue-600 hover:bg-blue-100 active:scale-95 transition-transform"
                                            >-</button>
                                            <span className="font-mono font-bold text-lg w-16 text-center bg-white rounded border py-0.5">{state.validationResult.liftHeight}cm</span>
                                            <button
                                                onClick={() => {
                                                    const maxLift = Math.max(0, (state.container?.dimensions.height_cm || 0) - (state.product?.dimensions.pot_height_cm || 0));
                                                    actions.setCustomLift(Math.min(maxLift, state.validationResult!.liftHeight + 1));
                                                }}
                                                className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-blue-600 hover:bg-blue-100 active:scale-95 transition-transform"
                                            >+</button>
                                        </div>
                                        <div className="mt-1 text-center">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold mr-1">Max:</span>
                                            <span className="text-xs font-bold text-gray-700">{Math.max(0, (state.container?.dimensions.height_cm || 0) - (state.product?.dimensions.pot_height_cm || 0))}cm</span>
                                        </div>
                                    </div>

                                    <div className="h-10 border-l border-blue-200"></div>

                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">H-Rate</span>
                                        <span className="font-mono font-bold text-lg text-gray-700 bg-white px-4 py-1 rounded border border-gray-200 shadow-sm" title="Visual Total Height / Container Height">
                                            {state.container?.dimensions.height_cm ? (state.validationResult.visualTotalHeight / state.container.dimensions.height_cm).toFixed(1) : '0.0'}
                                        </span>
                                    </div>
                                </div>


                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center justify-between">
                                        <span className="flex items-center gap-1"><Edit3 className="w-3 h-3" /> AI Prompt (Editable)</span>
                                        <button
                                            onClick={handleOpenTemplateModal}
                                            className="text-[10px] text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                        >
                                            <Save className="w-3 h-3" /> Edit Template
                                        </button>
                                    </h4>
                                    <textarea
                                        className="w-full text-xs p-2 border rounded bg-gray-50 h-24 focus:border-blue-500 outline-none resize-none font-mono text-gray-600 leading-tight"
                                        value={state.customPrompt || ''}
                                        onChange={(e) => actions.setCustomPrompt(e.target.value)}
                                        placeholder="Customize the prompt here..."
                                    />
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Reference Images (Payload)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Product Image */}
                                        <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 bg-white rounded border border-gray-200 mb-1 overflow-hidden flex items-center justify-center">
                                                {state.product?.assets.main_image ? (
                                                    <img src={state.product.assets.main_image} className="w-full h-full object-cover" />
                                                ) : <span className="text-[8px] text-gray-300">No Img</span>}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-600 block">Product</span>
                                            <span className="text-[8px] text-green-600 block">✅ Included</span>
                                        </div>

                                        {/* Container Image */}
                                        <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col items-center text-center">
                                            <div className="w-12 h-12 bg-white rounded border border-gray-200 mb-1 overflow-hidden flex items-center justify-center">
                                                {state.container?.image_url ? (
                                                    <img src={state.container.image_url} className="w-full h-full object-cover" />
                                                ) : <span className="text-[8px] text-gray-300">No Img</span>}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-600 block">Container</span>
                                            <span className={state.container?.image_url ? "text-[8px] text-green-600 block" : "text-[8px] text-gray-400 block"}>
                                                {state.container?.image_url ? "✅ Included" : "⚠️ Missing"}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-400 mt-2 leading-tight">
                                        Payload (Data Packet) includes Prompt text + 2 Reference Images.
                                    </p>
                                </div>

                                {/* Manual Generate Button */}
                                <button
                                    onClick={() => actions.generatePreview(true)}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 mb-4"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Confirm & Generate Preview
                                </button>

                                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                    <h3 className="font-bold text-gray-800 text-lg mb-2">Ready to Plant?</h3>
                                    <p className="text-gray-600 text-sm mb-6">
                                        The system has calculated the optimal physical staging.
                                        Review the generated preview on the right.
                                    </p>
                                    <button
                                        onClick={actions.nextStep}
                                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold shadow-md flex items-center justify-center gap-2"
                                    >
                                        Proceed to Scene Selection &rarr;
                                    </button>
                                    <button
                                        onClick={() => actions.prevStep()}
                                        className="mt-3 w-full text-gray-500 py-2 hover:text-gray-700 text-sm font-medium"
                                    >
                                        &larr; Refine Inputs
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: AI Preview */}
                            <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                                <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    Base Asset Preview ({state.generatedAssets.modelUsed || state.selectedModelName || 'AI Model'})
                                </h3>
                                <div className="flex gap-4 min-h-[400px]">
                                    {/* Main Preview */}
                                    <div className="flex-1 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                                        {state.generatedAssets.baseImage === 'error' ? (
                                            <div className="text-center p-8 text-red-500">
                                                <XCircle className="w-12 h-12 mx-auto mb-2" />
                                                <p className="font-bold">Generation Failed</p>
                                                <p className="text-xs mt-2 text-gray-400">Please check API Key or Model availability.<br />(Timeout or Permission Error)</p>
                                                <button onClick={() => actions.generatePreview(true)} className="mt-4 px-4 py-2 bg-white border rounded text-xs hover:bg-gray-100 text-gray-700">Retry</button>
                                            </div>
                                        ) : state.generatedAssets.baseImage ? (
                                            <div className="relative w-full h-full group">
                                                <img src={state.generatedAssets.baseImage} className="w-full h-full object-contain shadow-lg rounded" />
                                                {state.generatedAssets.isFallback && (
                                                    <div className="absolute top-2 left-2 bg-yellow-300 text-yellow-900 text-[10px] uppercase font-extrabold px-2 py-1 rounded shadow-sm border border-yellow-400 flex items-center gap-1 z-10">
                                                        <AlertTriangle className="w-3 h-3" /> AI Unavailable (Mock)
                                                    </div>
                                                )}
                                                {/* Single Download removed in favor of Batch Download - or kept as option? Keeping for specific download */}
                                                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const link = document.createElement('a');
                                                            link.href = state.generatedAssets.baseImage || '';
                                                            link.download = `${state.product?.code || 'product'}-${state.container?.name || 'container'}-selected.png`;
                                                            link.click();
                                                        }}
                                                        className="px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-md text-gray-700 hover:text-green-600 border border-gray-200 text-xs font-bold flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : state.generatedAssets.isLoading ? (
                                            <div className="text-center p-8 max-w-md">
                                                <div className="relative w-16 h-16 mx-auto mb-4">
                                                    <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                                                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                                                    <ImageIcon className="absolute inset-0 m-auto text-blue-500 w-6 h-6 animate-pulse" />
                                                </div>
                                                <h4 className="text-gray-800 font-bold mb-1">Generating Base Asset...</h4>
                                                <p className="text-gray-400 text-sm">
                                                    Using {state.generatedAssets.modelUsed || 'AI'} to synthesize {state.product?.name} in {state.container?.name}...
                                                    <br />(This might take 5-10s)
                                                </p>
                                                <button
                                                    onClick={() => actions.stopGeneration && actions.stopGeneration()}
                                                    className="mt-4 px-3 py-1 bg-red-50 text-red-500 text-[10px] rounded hover:bg-red-100 border border-red-200 underline"
                                                >
                                                    Force Stop (Cancel)
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center p-8 max-w-md">
                                                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <ImageIcon className="text-gray-300 w-8 h-8" />
                                                </div>
                                                <h4 className="text-gray-500 font-bold mb-1">Ready to Preview</h4>
                                                <p className="text-gray-400 text-sm leading-relaxed">
                                                    Confirm your prompt and reference images on the left, then click "Confirm & Generate".
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* History Sidebar */}
                                    <div className="w-24 flex flex-col gap-2 shrink-0">
                                        <button
                                            onClick={() => {
                                                const list = state.generatedAssets.history || [];
                                                if (list.length === 0 && state.generatedAssets.baseImage) {
                                                    // Fallback if history empty but baseImage exists (legacy)
                                                    const link = document.createElement('a');
                                                    link.href = state.generatedAssets.baseImage;
                                                    link.download = `${state.product?.code || 'PU'}-${state.container?.name || 'CNT'}-0.png`;
                                                    link.click();
                                                    return;
                                                }
                                                list.forEach((img, i) => {
                                                    const link = document.createElement('a');
                                                    link.href = img;
                                                    // Download Naming: SKU + ContainerShortName + Sequence
                                                    link.download = `${state.product?.code || 'SKU'}-${state.container?.name || 'CNT'}-${i + 1}.png`;
                                                    link.click();
                                                });
                                            }}
                                            disabled={!state.generatedAssets.baseImage && (!state.generatedAssets.history || state.generatedAssets.history.length === 0)}
                                            className="w-full py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-bold rounded flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Download className="w-3 h-3" />
                                            Download All
                                        </button>

                                        {/* Max 4 slots */}
                                        {Array.from({ length: 4 }).map((_, i) => {
                                            const history = state.generatedAssets.history || [];
                                            const img = history[i]; // Newest at end? Wait. Array order.
                                            // Requirements: "Newly generated covers oldest".
                                            // Implementation: push to end. So index 0 is oldest. Index 3 is newest.
                                            // Visual Requirement: "Remaining auto forward".
                                            // If I display [0, 1, 2, 3]. 0 is Top?
                                            // Usually recent at top.
                                            // Let's display in REVERSE order?
                                            // If I display reverse, Newest is Top.
                                            // If I delete #2.
                                            // Let's settle on Display Order = Array Order for now to match logic simplicity.
                                            // Or Render: history.slice().reverse()[i]?
                                            // Let's use standard order first.

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => img && actions.selectHistoryImage && actions.selectHistoryImage(img)}
                                                    className={`relative aspect-square w-full rounded border-2 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer transition-all ${img === state.generatedAssets.baseImage ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {img ? (
                                                        <>
                                                            <img src={img} className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('Delete this image?')) {
                                                                        actions.deleteHistoryItem && actions.deleteHistoryItem(i);
                                                                    }
                                                                }}
                                                                className="absolute top-0 right-0 p-1 bg-red-500 text-white opacity-0 hover:opacity-100 transition-opacity rounded-bl"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                            <span className="absolute bottom-0 left-0 bg-black/50 text-white text-[8px] px-1">{i + 1}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300 text-[10px] font-bold">{i + 1}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <p className="text-xs text-center text-gray-400 mt-4">Powered by {state.generatedAssets.modelUsed || 'Google & Replicate AI'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {state.currentStep === 'GENERATION_BASE' && (
                    <div className="h-full w-full overflow-y-auto p-8 flex items-center justify-center">
                        <section className="text-center py-8 bg-white rounded-xl shadow-lg border border-gray-100 max-w-2xl w-full">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Base Asset Preview</h3>
                            <p className="text-gray-500 mb-6 text-sm">Visualizing {state.product?.name} in {state.container?.name}</p>

                            <div className="relative w-80 h-96 mx-auto bg-gray-50 rounded-lg border border-gray-100 flex items-end justify-center overflow-hidden mb-8">
                                {/* Plant Layer (Z-10) */}
                                {state.product?.assets.main_image && (
                                    <img
                                        src={state.product.assets.main_image}
                                        className="absolute bottom-[25%] w-[80%] object-contain z-10"
                                        style={{ maxHeight: '75%' }}
                                    />
                                )}
                                {/* Container Layer (Z-0) */}
                                {state.container?.image_url && (
                                    <img
                                        src={state.container.image_url}
                                        className="absolute bottom-8 w-[60%] object-contain z-0"
                                        style={{ maxHeight: '35%' }}
                                    />
                                )}
                                {!state.product?.assets.main_image && !state.container?.image_url && (
                                    <span className="text-gray-300 text-xs mb-32">No Images Selected</span>
                                )}
                            </div>

                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={actions.prevStep}
                                    className="px-6 py-2 text-gray-500 hover:text-gray-700 underline text-sm"
                                >
                                    &larr; Refine Inputs
                                </button>
                                <button
                                    onClick={actions.nextStep}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    Confirm & Select Scene &rarr;
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {state.currentStep === 'GENERATION_SCENE' && (
                    <div className="h-full w-full overflow-y-auto p-8">
                        <section className="max-w-6xl mx-auto">
                            <SceneSelector
                                onSceneSelect={(scene) => {
                                    actions.setScene(scene);
                                    actions.nextStep();
                                }}
                            />
                            <div className="mt-4 text-center">
                                <button
                                    onClick={actions.prevStep}
                                    className="text-gray-500 hover:text-gray-700 underline text-sm"
                                >
                                    &larr; Back to Base Generation
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {(state.currentStep === 'REFINEMENT' || state.currentStep === 'OUTPUT') && (
                    <div className="h-full w-full overflow-y-auto p-8 flex flex-col items-center justify-center">
                        {state.currentStep === 'REFINEMENT' ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <div className="h-64 w-64 bg-gray-200 rounded-lg shadow-inner mb-6 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">Synthesizing Final Scene...</h2>
                                <p className="text-gray-500 mt-2">Integrating {state.product?.name} into {state.scene?.name}...</p>
                            </div>
                        ) : (
                            <section className="bg-white p-8 rounded-lg shadow-lg text-center max-w-4xl w-full border border-gray-100">
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <div className="bg-green-100 p-2 rounded-full"><Check className="w-6 h-6 text-green-600" /></div>
                                    <h2 className="text-2xl font-bold text-gray-800">Generation Complete</h2>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-8">
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-gray-500 text-sm uppercase">Base Asset</h4>
                                        <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                                            <span className="text-gray-400 text-sm">Base Image (Ready)</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-blue-600 text-sm uppercase">Final Scene</h4>
                                        <div className="aspect-[3/4] bg-blue-50 rounded-lg flex items-center justify-center border-2 border-blue-200 shadow-sm relative overflow-hidden group cursor-pointer hover:ring-4 ring-blue-100 transition">
                                            {state.generatedAssets.finalImages[0] ? (
                                                <img src={state.generatedAssets.finalImages[0]} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <ImageIcon className="w-12 h-12 text-blue-300 mb-2" />
                                                    <span className="text-blue-500 font-bold block w-full text-center">Generating...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="px-6 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold"
                                    >
                                        Start Over
                                    </button>
                                    <button
                                        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save to Library
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* Template Editor Modal */}
                {isTemplateModalOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-8">
                        <div className="bg-white w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-blue-600" /> Edit Prompt Template
                                </h3>
                                <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 p-0 flex flex-col">
                                <div className="bg-blue-50 p-3 text-xs text-blue-800 border-b flex gap-4">
                                    <span className="font-bold">Available Variables:</span>
                                    <code className="break-all">{'{{productName}}, {{productHeight}}, {{potHeight}}, {{containerHeight}}, {{containerName}}, {{containerDimension}}, {{scene}}, {{heightDiff}}, {{finalHeight}}, {{hrate}}, {{topping}}'}</code>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-6 font-mono text-sm leading-relaxed resize-none focus:outline-none"
                                    value={templateVal}
                                    onChange={e => setTemplateVal(e.target.value)}
                                    placeholder="Enter your prompt template here..."
                                />
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsTemplateModalOpen(false)}
                                    className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save Default Template
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
