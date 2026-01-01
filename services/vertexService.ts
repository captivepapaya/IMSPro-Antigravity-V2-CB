import { idb } from '../utils/idb';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSetting } from './db';

export const DEFAULT_PROMPT_TEMPLATE = `The plant is {{productHeight}}cm tall, with original pot {{potHeight}}cm. The new container is {{containerHeight}}cm tall, which is {{heightDiff}}cm taller than the original pot. Final height will be {{finalHeight}}cm.

Container surface uses {{topping}} as topping material (2cm thick).
Container Name: {{containerName}}
Container Dimension: {{formattedDimension}}

IMPORTANT CONSTRAINTS:
1. Must use the exact plant from the input image, do not change any appearance
2. Must use the exact container from the input image, do not change any appearance
3. Only combine them together, do not create new objects
4. Maintain all physical properties: lighting, texture, color, perspective
5. Do not apply any artistic processing or creative interpretation
6. Output must look like a real photograph, not AI-generated art`;

/**
 * Converts a URL to Base64 string
 */
export async function urlToBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove the data:image/...;base64, prefix
                const base64Only = base64.split(',')[1];
                resolve(base64Only);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('urlToBase64 failed:', error);
        throw error;
    }
}

interface VertexConfig {
    apiKey: string;
    projectId: string; // Not used for Gemini 1.5/2.0 Flash in AI Studio, but kept for structure
    location: string;
    modelId: string; // e.g. 'gemini-2.0-flash-exp'
    provider: string;
}

/**
 * Service for interacting with Google Gemini 2.0 Flash
 */
class VertexService {
    private static instance: VertexService;

    private constructor() { }

    public static getInstance(): VertexService {
        if (!VertexService.instance) {
            VertexService.instance = new VertexService();
        }
        return VertexService.instance;
    }

    private async getConfig(): Promise<VertexConfig> {
        // Load API provider selection
        const apiProvider = await getSetting('ai_provider') || 'ai_studio';

        // Load model selection
        const selectedModel = await getSetting('ai_image_gen_model') || 'gemini-3-pro-image-preview';

        console.log('🔍 Debug Config Loading:', {
            apiProvider,
            selectedModel
        });

        let apiKey: string = '';
        let projectId: string = '';
        let location: string = 'us-central1';

        if (apiProvider === 'vertex_ai') {
            // Vertex AI configuration
            apiKey = await getSetting('google_vertex_key') || '';
            projectId = await getSetting('google_project_id') || '';
            location = await getSetting('google_vertex_location') || 'us-central1';
        } else {
            // AI Studio configuration
            apiKey = await getSetting('google_api_key') || '';
        }

        if (!apiKey) {
            console.warn("⚠️ No API Key found for provider:", apiProvider);
        }

        return {
            projectId,
            apiKey,
            modelId: selectedModel,
            location,
            provider: apiProvider
        };
    }

    /**
     * Builds the VCA prompt with physical constraints
     */
    public buildPrompt(
        productName: string,
        productHeight: number,
        potHeight: number,
        containerName: string,
        containerHeight: number,
        containerDimension: string,
        topping: string,
        scene: string,
        liftOverride?: number,
        templateOverride?: string
    ): string {
        const heightDiff = liftOverride !== undefined ? liftOverride : (containerHeight - potHeight);
        const finalHeight = productHeight + heightDiff;
        const formattedDimension = containerDimension ? `${containerDimension}` : `${containerHeight}x${containerHeight}cm`;

        const hrate = containerHeight > 0 ? (finalHeight / containerHeight).toFixed(1) : "0.0";

        const template = templateOverride || DEFAULT_PROMPT_TEMPLATE;

        // Perform replacements
        return template
            .replace(/{{productName}}/g, productName)
            .replace(/{{productHeight}}/g, String(productHeight))
            .replace(/{{potHeight}}/g, String(potHeight))
            .replace(/{{containerName}}/g, containerName)
            .replace(/{{containerHeight}}/g, String(containerHeight))
            .replace(/{{heightDiff}}/g, String(heightDiff))
            .replace(/{{finalHeight}}/g, String(finalHeight))
            .replace(/{{hrate}}/g, hrate)
            .replace(/{{formattedDimension}}/g, formattedDimension)
            .replace(/{{containerDimension}}/g, formattedDimension) // Alias
            .replace(/{{topping}}/g, topping)
            .replace(/{{scene}}/g, scene);
    }

    /**
     * Generates an image using selected model (Gemini or Replicate)
     * Routes to appropriate API based on model selection
     */
    public async generateImage(prompt: string, images: string[] = []): Promise<string | null> {
        const config = await this.getConfig();

        // Route to appropriate API based on model
        if (config.modelId.startsWith('replicate:')) {
            return this.generateImageReplicate(prompt, images, config);
        } else {
            return this.generateImageGemini(prompt, images, config);
        }
    }

    /**
     * Generate image using Replicate API
     */
    private async generateImageReplicate(prompt: string, images: string[], config: any): Promise<string | null> {
        const replicateToken = await getSetting('replicate_api_key');
        if (!replicateToken) {
            throw new Error('Replicate API Token not found. Please configure in AI Settings.');
        }

        // Extract model name (e.g., "replicate:google/nano-banana" -> "google/nano-banana")
        const modelName = config.modelId.replace('replicate:', '');

        console.log('🚀 VertexService: Calling Replicate -', modelName);

        try {
            // Prepare image input (Replicate expects array)
            const imageInput = images.map(img => `data:image/jpeg;base64,${img}`);

            // Load saved Replicate parameters
            const aspectRatio = await getSetting('replicate_aspect_ratio') || 'match_input_image';
            const outputFormat = await getSetting('replicate_output_format') || 'jpg';
            const resolution = await getSetting('replicate_resolution') || '2K';
            const safetyFilterLevel = await getSetting('replicate_safety_filter') || 'block_only_high';

            // Build input parameters
            const input: any = {
                prompt: prompt,
                image_input: imageInput,
                aspect_ratio: aspectRatio,
                output_format: outputFormat
            };

            // Pro version: add resolution and safety filter
            if (modelName.includes('nano-banana-pro')) {
                input.resolution = resolution;
                input.safety_filter_level = safetyFilterLevel;
                console.log(`✨ Using Pro version: ${resolution}, Safety: ${safetyFilterLevel}`);
            }

            console.log('📋 Replicate Parameters:', { aspectRatio, outputFormat, resolution: input.resolution || 'N/A' });

            // Step 1: Create Prediction (using Proxy)
            const createResponse = await fetch(`/replicate-api/v1/models/${modelName}/predictions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${replicateToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'wait'
                },
                body: JSON.stringify({ input })
            });

            if (!createResponse.ok) {
                const error = await createResponse.text();
                throw new Error(`Replicate API Error: ${error}`);
            }

            const prediction = await createResponse.json();
            const predictionId = prediction.id;
            console.log('✅ Prediction created:', predictionId);

            // Step 2: Poll for result (using Proxy)
            console.log('⏳ Waiting for result...');
            let attempts = 0;
            const maxAttempts = 60;  // 60 seconds timeout

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));  // Wait 1 second

                const statusResponse = await fetch(`/replicate-api/v1/predictions/${predictionId}`, {
                    headers: {
                        'Authorization': `Bearer ${replicateToken}`
                    }
                });

                const status = await statusResponse.json();
                console.log(`📊 Status: ${status.status} (${attempts + 1}/${maxAttempts})`);

                if (status.status === 'succeeded') {
                    console.log('🎨 Image generated successfully!');
                    // Replicate returns URL, need to convert to base64
                    const imageUrl = Array.isArray(status.output) ? status.output[0] : status.output;
                    return imageUrl;  // Return URL directly for now
                } else if (status.status === 'failed') {
                    throw new Error(`Replicate generation failed: ${status.error}`);
                } else if (status.status === 'canceled') {
                    throw new Error('Replicate generation was canceled');
                }

                attempts++;
            }

            throw new Error('Replicate generation timeout');

        } catch (error) {
            console.error('Replicate Exception:', error);
            throw error;
        }
    }

    /**
     * Generate image using Gemini API (existing logic)
     */
    private async generateImageGemini(prompt: string, images: string[], config: any): Promise<string | null> {
        // Gemini endpoint via AI Studio
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelId}:generateContent`;

        console.log('🚀 VertexService: Calling Gemini 3 Pro Image Preview');
        console.log('📍 Endpoint:', endpoint);

        // Build parts array (images + text)
        const parts: any[] = [];

        // Add all images as inline_data
        if (images.length > 0) {
            console.log(`📸 Attaching ${images.length} image(s)...`);
            images.forEach((imageBase64, index) => {
                parts.push({
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: imageBase64
                    }
                });
                console.log(`  ✅ Image ${index + 1} attached (${imageBase64.length} chars)`);
            });
        }

        // Add text prompt
        const finalPrompt = `${prompt}

CRITICAL: Create a photorealistic composite showing the plant naturally planted inside the container. Preserve all original textures, colors, and lighting. The result must look like a single photograph.`;

        parts.push({ text: finalPrompt });
        console.log('📝 Prompt:', finalPrompt.substring(0, 100) + '...');

        // Gemini API payload structure
        const payload = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                topK: 40,
                responseModalities: ["IMAGE"]  // Required for image generation
            }
        };

        console.log('📦 Payload:', {
            partsCount: parts.length,
            imagesCount: images.length
        });

        try {
            console.log('🌐 Sending request to Gemini 3 Pro Image Preview...');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': config.apiKey  // AI Studio API Key
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Gemini API Error:", response.status, errorText);
                throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Gemini Response received');
            console.log('📄 Response:', JSON.stringify(data, null, 2).substring(0, 500));

            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];

                // Check for safety filters
                if (candidate.finishReason === 'SAFETY') {
                    console.warn('⚠️ Blocked by safety filters');
                    console.warn('Safety ratings:', candidate.safetyRatings);
                    throw new Error('Content blocked by safety filters.');
                }

                // Check finish reason
                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    console.warn(`⚠️ Stopped early: ${candidate.finishReason}`);
                }

                const content = candidate.content;
                if (content && content.parts) {
                    for (const part of content.parts) {
                        // Check for generated image (API uses camelCase: inlineData)
                        if (part.inlineData && part.inlineData.data) {
                            const base64 = part.inlineData.data;
                            const mimeType = part.inlineData.mimeType || 'image/png';
                            console.log(`🎨 Generated image! Size: ${base64.length} chars`);
                            console.log(`📷 MIME: ${mimeType}`);
                            return `data:${mimeType};base64,${base64}`;
                        }

                        // Log text responses
                        if (part.text) {
                            console.log('📝 Text response:', part.text.substring(0, 200));
                        }
                    }
                }
            }

            console.warn("Gemini returned no image in response");
            console.warn("Full response:", JSON.stringify(data, null, 2));
            return null;

        } catch (error) {
            console.error("Gemini Generation Exception:", error);
            throw error;
        }
    }
}

export const vertexService = new VertexService();
