import { useState, useCallback, useMemo, useEffect } from 'react';
import {
    VCAState,
    VCAWorkflowStep,
    ProductSpecs,
    ContainerSpecs,
    SceneConfig,
    ModelIdentity
} from '../types/vca';
import { geminiService } from '../services/geminiService';
import { vertexService, urlToBase64 } from '../services/vertexService';
import { mergeImages } from '../services/imageUtils';
import { useToast } from './useToast';
import { getSetting } from '../services/db';

const INITIAL_STATE: VCAState = {
    currentStep: 'INPUT',
    product: null,
    container: null,
    scene: null,
    model: null,
    validationResult: null,
    generatedAssets: {
        sceneImages: [],
        finalImages: [],
        history: [],
        isLoading: false // Explicit init
    }
};

export const useVCAWorkflow = () => {
    const [state, setState] = useState<VCAState>(INITIAL_STATE);
    const toast = useToast();

    // Init: Load Model Name and Prompt Template
    useEffect(() => {
        const loadInit = async () => {
            const [modelId, promptTemplate] = await Promise.all([
                getSetting('ai_image_gen_model'),
                getSetting('vca_prompt_template')
            ]);

            let name = 'Gemini 3 Pro';
            if (modelId) {
                if (modelId.includes('nano-banana-pro')) name = 'Nano Banana Pro';
                else if (modelId.includes('nano-banana')) name = 'Nano Banana';
                else if (modelId.includes('gemini-2.5')) name = 'Gemini 2.5';
            }

            setState(prev => ({
                ...prev,
                selectedModelName: name,
                promptTemplate: promptTemplate || undefined
            }));
        };
        loadInit();
    }, []);

    // Helper to generate consistent prompts based on current state
    const _buildPrompt = useCallback((p: ProductSpecs | null, c: ContainerSpecs | null, m: ModelIdentity | null, s: SceneConfig | null, liftOverride?: number, templateOverride?: string) => {
        return vertexService.buildPrompt(
            p?.name || 'Plant',
            p?.dimensions.height_cm || 100,
            p?.dimensions.pot_height_cm || 15,
            c?.name || 'Generic Pot',
            c?.dimensions.height_cm || 18,
            c?.dimensions.dimension || `${c?.dimensions.diameter_cm || 30}×${c?.dimensions.diameter_cm || 30}×${c?.dimensions.height_cm || 18}cm`,
            c?.styling.topping || 'Soil',
            s?.prompt_template || 'Studio setting: white background',
            liftOverride,
            templateOverride
        );
    }, []);

    const setProduct = useCallback((product: ProductSpecs) => {
        setState(prev => ({
            ...prev,
            product,
            customPrompt: _buildPrompt(product, prev.container, prev.model, prev.scene, prev.customLift, prev.promptTemplate)
        }));
    }, [_buildPrompt]);

    const setContainer = useCallback((container: ContainerSpecs) => {
        setState(prev => ({
            ...prev,
            container,
            customPrompt: _buildPrompt(prev.product, container, prev.model, prev.scene, prev.customLift, prev.promptTemplate)
        }));
    }, [_buildPrompt]);

    const setScene = useCallback((scene: SceneConfig) => {
        setState(prev => ({
            ...prev,
            scene,
            customPrompt: _buildPrompt(prev.product, prev.container, prev.model, scene, prev.customLift, prev.promptTemplate)
        }));
    }, [_buildPrompt]);

    const setModel = useCallback((model: ModelIdentity) => {
        setState(prev => ({
            ...prev,
            model,
            customPrompt: _buildPrompt(prev.product, prev.container, model, prev.scene, prev.customLift, prev.promptTemplate)
        }));
    }, [_buildPrompt]);

    const setCustomPrompt = useCallback((prompt: string) => {
        setState(prev => ({ ...prev, customPrompt: prompt }));
    }, []);

    const setCustomLift = useCallback((lift: number) => {
        setState(prev => ({
            ...prev,
            customLift: lift,
            customPrompt: _buildPrompt(prev.product, prev.container, prev.model, prev.scene, lift, prev.promptTemplate)
        }));
    }, [_buildPrompt]);

    const deleteHistoryItem = useCallback((index: number) => {
        setState(prev => {
            const list = [...(prev.generatedAssets.history || [])];
            list.splice(index, 1);
            return {
                ...prev,
                generatedAssets: { ...prev.generatedAssets, history: list }
            };
        });
    }, []);

    const selectHistoryImage = useCallback((image: string) => {
        setState(prev => ({
            ...prev,
            generatedAssets: { ...prev.generatedAssets, baseImage: image }
        }));
    }, []);

    const setPromptTemplate = useCallback((template: string) => {
        setState(prev => ({
            ...prev,
            promptTemplate: template,
            customPrompt: _buildPrompt(prev.product, prev.container, prev.model, prev.scene, prev.customLift, template)
        }));
    }, [_buildPrompt]);

    const calculateHeight = useCallback(() => {
        if (!state.product || !state.container) return;

        const { height_cm, pot_height_cm = 0 } = state.product.dimensions;
        const { height_cm: containerHeight } = state.container.dimensions;

        // Logic from spec: Lift = Container Height - Original Pot Height (if positive)
        // Visual Height = Product Height + Lift
        const maxLift = Math.max(0, containerHeight - pot_height_cm);

        // Use custom lift if set, otherwise maxLift (calculated)
        const liftHeight = state.customLift !== undefined ? state.customLift : maxLift;
        const visualTotalHeight = height_cm + liftHeight;

        // Simple validation logic (example)
        const isValid = visualTotalHeight > 0;
        const messages = [`Calculated Visual Height: ${visualTotalHeight}cm (Lift: ${liftHeight}cm)`];

        // Removed VS Model logic as per request

        setState(prev => ({
            ...prev,
            validationResult: {
                visualTotalHeight,
                liftHeight,
                isValid,
                messages
            }
        }));
    }, [state.product, state.container, state.model, state.customLift]);

    const nextStep = useCallback(() => {
        const steps: VCAWorkflowStep[] = ['INPUT', 'POTTED_PLANT', 'GENERATION_BASE', 'GENERATION_SCENE', 'REFINEMENT', 'OUTPUT'];
        const currentIndex = steps.indexOf(state.currentStep);
        if (currentIndex < steps.length - 1) {
            setState(prev => ({ ...prev, currentStep: steps[currentIndex + 1] }));
        }
    }, [state.currentStep]);

    const prevStep = useCallback(() => {
        const steps: VCAWorkflowStep[] = ['INPUT', 'POTTED_PLANT', 'GENERATION_BASE', 'GENERATION_SCENE', 'REFINEMENT', 'OUTPUT'];
        const currentIndex = steps.indexOf(state.currentStep);

        if (currentIndex > 0) {
            let targetStep = steps[currentIndex - 1];

            // Special handling: If going back from GENERATION_BASE (Step 3) to POTTED_PLANT (Step 2),
            // check if Step 2 was actually completed (has baseImage).
            // If not, it means we skipped Step 2, so go back to INPUT (Step 1).
            if (state.currentStep === 'GENERATION_BASE' && !state.generatedAssets.baseImage) {
                targetStep = 'INPUT';
            }

            setState(prev => ({ ...prev, currentStep: targetStep }));
        }
    }, [state.currentStep, state.generatedAssets.baseImage]);

    const skipToStep = useCallback((step: VCAWorkflowStep) => {
        setState(prev => ({ ...prev, currentStep: step }));
    }, []);

    const generateFinalScene = useCallback(async () => {
        if (!state.product || !state.container) return;

        const prompt = state.customPrompt || _buildPrompt(state.product, state.container, state.model, state.scene);
        console.log("Generating Final Scene with prompt:", prompt);

        const images: string[] = [];
        // 1. Product Image
        if (state.product.assets.main_image) {
            try { images.push(await urlToBase64(state.product.assets.main_image)); } catch (e) { console.warn("Failed to load Product Img", e); }
        }
        // 2. Container Image
        if (state.container.image_url) {
            try { images.push(await urlToBase64(state.container.image_url)); } catch (e) { console.warn("Failed to load Container Img", e); }
        }

        try {
            // Call Imaging Service
            const result = await vertexService.generateImage(prompt, images);

            // Determine model name for display
            const modelId = await getSetting('ai_image_gen_model') || 'gemini-3-pro-image-preview';
            let modelName = 'Gemini 3 Pro';
            if (modelId.includes('nano-banana-pro')) modelName = 'Nano Banana Pro';
            else if (modelId.includes('nano-banana')) modelName = 'Nano Banana';
            else if (modelId.includes('gemini-2.5')) modelName = 'Gemini 2.5 Flash';

            if (result) {
                setState(prev => ({
                    ...prev,
                    generatedAssets: {
                        ...prev.generatedAssets,
                        finalImages: [result],
                        isLoading: false,
                        modelUsed: modelName
                    },
                    currentStep: 'OUTPUT'
                }));
            } else {
                setState(prev => ({
                    ...prev,
                    generatedAssets: { ...prev.generatedAssets, finalImages: [], isLoading: false }
                }));
            }
            // The original code had a duplicate setState here, which is removed.
            // The logic for currentStep: 'OUTPUT' is now inside the if/else blocks.
        } catch (e) {
            console.error("Generation failed", e);
            setState(prev => ({
                ...prev,
                generatedAssets: { ...prev.generatedAssets, finalImages: [], isLoading: false },
                currentStep: 'OUTPUT'
            }));
        }
    }, [state.product, state.container, state.model, state.scene, state.customPrompt, _buildPrompt]);

    const generatePreview = useCallback(async (manualTrigger: boolean = false) => {
        if (!state.product || !state.container) return;

        // ========== 高度校验 ==========
        const potHeight = state.product.dimensions.pot_height_cm || 0;
        const containerHeight = state.container.dimensions.height_cm;
        const heightDiff = containerHeight - potHeight; // 容器比Pot高出的部分

        // 如果容器比Pot高度少于2cm，拒绝生成（2cm留给Topping填充物）
        if (heightDiff < 2) {
            toast.showToast('⚠️ 容器太矮，无法容纳此植物。容器高度必须比原配Pot高至少2cm（留给Topping填充物）。', 'warning', 5000);
            return;
        }
        // ========== 高度校验结束 ==========

        const prompt = state.customPrompt || _buildPrompt(state.product, state.container, state.model, state.scene);

        console.log("Generating Preview with prompt:", prompt);

        // If we have an image (and not forcing retry), skip
        if (!manualTrigger && state.generatedAssets.baseImage) return;

        if (manualTrigger) {
            console.log("📸 Generating Preview (Manual Trigger)...");
        }

        // Set Loading State
        setState(prev => ({
            ...prev,
            generatedAssets: { ...prev.generatedAssets, isLoading: true, baseImage: undefined }
        }));

        try {
            const images: string[] = [];
            let productLoaded = false;
            let containerLoaded = false;

            // 1. Product Image - 只使用第一张 Product 图片
            if (state.product.assets.main_image) {
                try {
                    images.push(await urlToBase64(state.product.assets.main_image));
                    productLoaded = true;
                } catch (e) {
                    console.warn("Failed to load Product Img (likely CORS)", e);
                }
            }

            // 2. Container Image - 只使用唯一的 Container 图片
            if (state.container?.image_url) {
                try {
                    images.push(await urlToBase64(state.container.image_url));
                    containerLoaded = true;
                } catch (e) {
                    console.warn("Failed to load Container Img", e);
                }
            }

            // User Feedback for CORS/Loading Errors
            if (state.product.assets.main_image && !productLoaded) {
                toast.showToast('⚠️ Product Image blocked by Browser Security (CORS). AI will guess the plant look.', 'warning', 6000);
            }

            // ========== Pass images directly to Gemini 2.5 Pro Exp ==========
            console.log(`📸 Preparing ${images.length} image(s) for Gemini 2.5 Pro Exp`);

            // Call Gemini 2.5 Pro Exp (supports multiple images)
            const result = await vertexService.generateImage(prompt, images);

            // Determine model name for display
            const modelId = await getSetting('ai_image_gen_model') || 'gemini-3-pro-image-preview';
            let modelName = 'Gemini 3 Pro';
            if (modelId.includes('nano-banana-pro')) modelName = 'Nano Banana Pro';
            else if (modelId.includes('nano-banana')) modelName = 'Nano Banana';
            else if (modelId.includes('gemini-2.5')) modelName = 'Gemini 2.5 Flash';

            if (result) {
                setState(prev => ({
                    ...prev,
                    generatedAssets: {
                        ...prev.generatedAssets,
                        baseImage: result,
                        isFallback: false,
                        isLoading: false,
                        modelUsed: modelName,
                        history: (() => {
                            const list = [...(prev.generatedAssets.history || [])];
                            list.push(result);
                            if (list.length > 4) list.shift(); // Cycle: Remove oldest
                            return list;
                        })()
                    }
                }));
                toast.showToast('Preview Generated Successfully', 'success');
            } else {
                throw new Error("No result from Vertex AI");
            }
        } catch (error: any) {
            console.error("Preview Generation Failed:", error);
            const isRecitation = error.message?.includes('RECITATION');

            // Fallback Logic
            const fallbackImage = state.product.assets.main_image || state.container.image_url;

            if (fallbackImage) {
                console.log("Using Fallback Image due to error:", fallbackImage);
                setState(prev => ({
                    ...prev,
                    generatedAssets: {
                        ...prev.generatedAssets,
                        baseImage: fallbackImage,
                        isFallback: true,
                        isLoading: false
                    }
                }));
                toast.showToast(`AI Generation Error: ${error.message} - Displaying fallback.`, 'error');
            } else {
                setState(prev => ({
                    ...prev,
                    generatedAssets: {
                        ...prev.generatedAssets,
                        baseImage: 'error',
                        isLoading: false
                    }
                }));
                if (isRecitation) {
                    toast.showToast('AI Safety Block: Recitation check failed.', 'error');
                } else {
                    toast.showToast(`AI Generation Failed: ${error.message}`, 'error');
                }
            }
        }
    }, [state.product, state.container, state.customPrompt, state.generatedAssets.baseImage, _buildPrompt, toast]);

    const stopGeneration = useCallback(() => {
        setState(prev => ({
            ...prev,
            generatedAssets: { ...prev.generatedAssets, isLoading: false }
        }));
        toast.showToast('Generation stopped by user.', 'info');
    }, [toast]);

    const actions = useMemo(() => ({
        setProduct,
        setContainer,
        setScene,
        setModel,
        calculateHeight,
        nextStep,
        prevStep,
        generateFinalScene,
        generatePreview,
        setCustomPrompt,
        stopGeneration,
        skipToStep,
        setCustomLift,
        setPromptTemplate,
        deleteHistoryItem,
        selectHistoryImage
    }), [
        setProduct,
        setContainer,
        setScene,
        setModel,
        calculateHeight,
        nextStep,
        prevStep,
        generateFinalScene,
        generatePreview,
        setCustomPrompt,
        stopGeneration,
        skipToStep,
        setCustomLift,
        setPromptTemplate,
        deleteHistoryItem,
        selectHistoryImage
    ]);

    return {
        state,
        actions
    };
};
