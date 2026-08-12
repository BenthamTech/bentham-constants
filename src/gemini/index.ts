import { GoogleGenAI } from "@google/genai";
import { gcpProject, geminiConfig } from "../config/index";

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  modelId?: string;
}

let genAIInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({
      vertexai: true,
      project: gcpProject,
      location: geminiConfig.location,
    });
  }
  return genAIInstance;
}

/**
 * Generate text content from a prompt using Gemini.
 * @param prompt - The input prompt
 * @param options - Optional temperature, maxOutputTokens, modelId override
 * @returns The generated text (trimmed)
 */
export async function generateContent(
  prompt: string,
  options: GeminiOptions = {},
): Promise<string> {
  const client = getClient();
  const modelId = options.modelId || geminiConfig.model;

  const result = await client.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
    },
  });

  return result.text?.trim() || "";
}

/**
 * Generate content and parse the response as JSON.
 * Throws if the response is empty or not valid JSON.
 * @param prompt - The input prompt
 * @param options - Optional temperature, maxOutputTokens, modelId override
 * @returns Parsed JSON object
 */
export async function generateJson<T = unknown>(
  prompt: string,
  options: GeminiOptions = {},
): Promise<T> {
  const client = getClient();
  const modelId = options.modelId || geminiConfig.model;

  const result = await client.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
    },
  });

  const text = result.text?.trim() || "";
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return JSON.parse(text) as T;
}

/**
 * Generate an embedding vector for the given text.
 * @param text - The text to embed
 * @param options - Optional modelId override (defaults to geminiConfig.embeddingModel)
 * @returns The embedding vector as number array
 */
export async function embed(
  text: string,
  options: Pick<GeminiOptions, "modelId"> = {},
): Promise<number[]> {
  const client = getClient();
  const modelId = options.modelId || geminiConfig.embeddingModel;

  const result = await client.models.embedContent({
    model: modelId,
    contents: text,
  });

  if (!result.embeddings || !result.embeddings[0]) {
    throw new Error("Empty embedding response from Gemini");
  }

  return result.embeddings[0].values as number[];
}

/**
 * Reset the internal client instance.
 * Useful for testing — not intended for production use.
 */
export function _resetClient(): void {
  genAIInstance = null;
}
