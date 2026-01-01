export interface ProductSpecs {
    id: string;
    name: string; // e.g., "Gum Tree"
    code?: string; // Inventory Code / SKU
    type: 'Plant' | 'Furniture' | 'Decor';
    dimensions: {
        height_cm: number; // e.g., 180
        width_cm?: number;
        pot_height_cm?: number; // e.g., 18
        pot_diameter_cm?: number;
    };
    assets: {
        main_image: string; // URL
        detail_images: string[];
    };
}

export interface ContainerSpecs {
    id: string;
    name: string; // e.g., "White Textured Pot"
    dimensions: {
        height_cm: number; // e.g., 30
        diameter_cm: number; // e.g., 31
        dimension?: string; // e.g., "30×30×40cm" - 完整尺寸描述
    };
    styling: {
        topping: 'White Pebbles' | 'Black Pebbles' | 'Mixed Pebbles' | 'Artificial Moss' | 'Coconut Fiber' | 'Bark' | 'Soil';
        color: string;
    };
    image_url?: string;
}

export interface ModelIdentity {
    name: string; // e.g., "Demo1"
    face_reference_image: string; // URL
    height_cm: number; // e.g., 175
}

export interface SceneConfig {
    id: string;
    name: string; // e.g., "Beach" or "Custom"
    prompt_template: string; // Supports {{ model.name }}, {{ product.name }}
    is_custom: boolean;
    outfit_ref?: string;
    force_scale_check?: boolean;
}

export type VCAWorkflowStep =
    | 'INPUT'
    | 'POTTED_PLANT'
    | 'GENERATION_BASE'
    | 'GENERATION_SCENE'
    | 'REFINEMENT'
    | 'OUTPUT';

export interface VCAState {
    currentStep: VCAWorkflowStep;
    product: ProductSpecs | null;
    container: ContainerSpecs | null;
    customPrompt?: string;
    scene: SceneConfig | null;
    model: ModelIdentity | null;
    validationResult: {
        visualTotalHeight: number;
        liftHeight: number;
        isValid: boolean;
        messages: string[];
    } | null;
    generatedAssets: {
        baseImage?: string;
        modelUsed?: string; // e.g. "Gemini 3 Pro" or "Nano Banana"
        isFallback?: boolean;
        isLoading?: boolean;
        sceneImages: string[];
        finalImages: string[];
        history: string[]; // Store last 4 generated images
    };
    customLift?: number; // User override for lift height
    selectedModelName?: string; // e.g. "Nano Banana Pro"
    promptTemplate?: string; // Loaded from settings
}
