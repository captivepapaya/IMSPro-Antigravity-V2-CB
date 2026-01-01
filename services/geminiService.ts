
import { GoogleGenAI } from "@google/genai";
import { CsvFile, FilterParams, AiAnalysisResult } from '../types';
import { processRawData, searchInventory } from './dataProcessor';
import { synonymService } from './synonymService';
import { idb } from '../utils/idb';

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  public resetClient() {
    this.ai = null;
    console.log("Gemini Client Reset");
  }

  public async checkModelPermissions(): Promise<{ hasImagen: boolean; models: string[] }> {
    try {
      const client = await this.getClient();
      const response = await client.models.list();
      // @ts-ignore
      const models = (response.models || []).map((m: any) => m.name || m.displayName);
      const hasImagen = models.some((m: string) => m.toLowerCase().includes('imagen'));
      console.log("🤖 Available Models:", models);
      return { hasImagen, models };
    } catch (e) {
      console.error("Failed to list models:", e);
      // Fallback: If list fails, assume NO imagen, or return empty
      return { hasImagen: false, models: [] };
    }
  }

  private async getClient(): Promise<GoogleGenAI> {
    if (!this.ai) {
      const dbKey = await idb.get('google_api_key');

      // Safe env access
      let envKey = '';
      try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) envKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_API_KEY || '';
        // @ts-ignore
        if (!envKey && typeof process !== 'undefined' && process.env) envKey = process.env.API_KEY || '';
      } catch (e) { console.warn("Env read warn", e); }

      const key = envKey || dbKey || '';
      if (!key) throw new Error("API Key missing. Please configure in Settings.");
      this.ai = new GoogleGenAI({ apiKey: key });
    }
    return this.ai;
  }

  // --- Step 1: NLU - Extract Parameters ---
  private async extractSearchParameters(userQuery: string): Promise<FilterParams | null> {
    const extractionPrompt = `
      You are a search parameter extractor for an inventory database.
      STRICTLY output only JSON. No markdown code blocks.
      Extract: keywords, minHL, maxHL, minPrice, maxPrice, inStockOnly.
      Query: "${userQuery}"
    `;

    try {
      const client = await this.getClient();
      const response = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: extractionPrompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || "{}";
      const cleanJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson) as FilterParams;
    } catch (e) {
      console.error("Param extraction failed", e);
      return null;
    }
  }

  // --- Step 2: Vision - Analyze Image(s) from Camera ---
  public async analyzeImage(base64Images: string[], contextSubCategories: string[]): Promise<AiAnalysisResult | null> {

    const imageParts = base64Images.map(img => {
      const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      return { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } };
    });

    const specificVocabulary = synonymService.getAiVocabulary();
    const fallbackCategories = synonymService.getFallbackCategories();

    const prompt = `
      You are an expert botanist and artificial plant inventory specialist.
      
      TASK:
      Identify the artificial plant/flower in the image(s).
      
      MECHANISM 1: SPECIFIC IDENTIFICATION
      Check if the item is present in this SPECIFIC LIST (Singular names/Synonyms):
      ${JSON.stringify(specificVocabulary)}
      
      - If confident, return the EXACT matching term from the list in 'simpleName'.
      
      MECHANISM 2: FALLBACK CLASSIFICATION
      If confident it is NOT in the list, classify as one of:
      ${JSON.stringify(fallbackCategories)}
      
      OUTPUT:
      - color: Single DOMINANT color (e.g. 'Red', 'Pink'). If unknown, 'NA'.
      
      JSON FORMAT:
      {
        "simpleName": "Exact term or Fallback Category",
        "matchedSubCategories": [],
        "inferredSubCategory": "",
        "color": "Red",
        "description": "Visual description"
      }
    `;

    try {
      const client = await this.getClient();
      const response = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            ...imageParts,
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || "{}";
      const cleanJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson) as AiAnalysisResult;
    } catch (error) {
      console.error("Image analysis failed", error);
      return null;
    }
  }

  public async sendMessage(message: string, history: { role: string, parts: { text: string }[] }[], files: CsvFile[]) {
    const inventory = processRawData(files);
    const filters = await this.extractSearchParameters(message);

    let searchContext = "";
    if (filters && (filters.keywords || filters.minHL !== undefined || filters.maxHL !== undefined || filters.minPrice !== undefined)) {
      const results = searchInventory(inventory, filters);
      const topResults = results.slice(0, 100);
      searchContext = `Search Results: ${results.length} items. Top 100: ${JSON.stringify(topResults, null, 2)}`;
    } else {
      searchContext = `No specific filters. Sample: ${JSON.stringify(inventory.slice(0, 5))}`;
    }

    const finalPrompt = `User Query: ${message}\nSystem Data: ${searchContext}\nReply strictly as a plain text list (SKU | Desc | Price | Stock).`;

    try {
      const client = await this.getClient();
      const chat = client.chats.create({
        model: 'gemini-1.5-flash',
        config: { temperature: 0.5 },
        history: history.map(h => ({ role: h.role, parts: h.parts }))
      });

      const result = await chat.sendMessage({ message: finalPrompt });
      return result.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  private async generateImageViaVertex(prompt: string, apiKey: string, projectId: string, modelId: string = 'imagen-3.0-generate-001'): Promise<string | null> {
    console.log(`🌩️ Attempting Vertex AI REST API Fallback with Model: ${modelId}...`);
    // Using standard Vertex prediction endpoint
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predict?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt: prompt }],
          parameters: { sampleCount: 1, aspectRatio: "3:4" } // Portrait for plants
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Vertex AI Error (${response.status}):`, errText);
        return null;
      }

      const data = await response.json();
      // Handle Vertex Response Format
      const b64 = data.predictions?.[0]?.bytesBase64Encoded || data.predictions?.[0];
      if (b64) {
        return `data:image/png;base64,${b64}`;
      }
      return null;
    } catch (e) {
      console.error("Vertex AI Fetch Error", e);
      return null;
    }
  }

  public async generateImage(prompt: string): Promise<string | null> {
    console.log("🎨 Gemini generating image with prompt:", prompt.substring(0, 50) + "...");
    try {
      const client = await this.getClient();

      // 20s Timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Reference Image generation timed out (20s)")), 20000)
      );

      // Try Imagen 3 (AI Studio SDK)
      const request = client.models.generateContent({
        model: 'imagen-3.0-generate-001',
        contents: { parts: [{ text: prompt }] }
      });

      const response = await Promise.race([request, timeout]) as any;

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const part = response.candidates[0].content.parts.find((p: any) => p.inlineData);
        if (part && part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error: any) {
      console.error("Image generation failed (SDK Main).", error);

      // FALLBACK: Try Vertex AI REST API if Project ID is configured
      try {
        const projectId = await idb.get('google_project_id');
        const apiKey = await idb.get('google_api_key');
        const modelId = await idb.get('google_model_id') || 'imagen-3.0-generate-001';

        if (projectId && apiKey) {
          console.log("🔄 Switching to Vertex AI Fallback for Project:", projectId);
          const vertexResult = await this.generateImageViaVertex(prompt, apiKey, projectId, modelId);
          if (vertexResult) {
            console.log("✅ Vertex AI Generation Successful!");
            return vertexResult;
          }
        }
      } catch (fallbackErr) {
        console.error("Vertex Fallback failed:", fallbackErr);
      }

      if (error?.message) console.error("Error Message:", error.message);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
