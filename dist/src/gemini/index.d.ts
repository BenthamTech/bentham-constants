export interface GeminiOptions {
    temperature?: number;
    maxOutputTokens?: number;
    modelId?: string;
}
/**
 * Generate text content from a prompt using Gemini.
 * @param prompt - The input prompt
 * @param options - Optional temperature, maxOutputTokens, modelId override
 * @returns The generated text (trimmed)
 */
export declare function generateContent(prompt: string, options?: GeminiOptions): Promise<string>;
/**
 * Generate content and parse the response as JSON.
 * Throws if the response is empty or not valid JSON.
 * @param prompt - The input prompt
 * @param options - Optional temperature, maxOutputTokens, modelId override
 * @returns Parsed JSON object
 */
export declare function generateJson<T = unknown>(prompt: string, options?: GeminiOptions): Promise<T>;
/**
 * Generate an embedding vector for the given text.
 * @param text - The text to embed
 * @param options - Optional modelId override (defaults to geminiConfig.embeddingModel)
 * @returns The embedding vector as number array
 */
export declare function embed(text: string, options?: Pick<GeminiOptions, "modelId">): Promise<number[]>;
/**
 * Reset the internal client instance.
 * Useful for testing — not intended for production use.
 */
export declare function _resetClient(): void;
