import { GoogleGenAI } from "@google/genai";
import { gcpProject, geminiConfig } from "../config/index";

/** A file sent to Gemini alongside the prompt (e.g. a PDF or image to read). */
export interface GeminiFile {
  data: Buffer;
  mimeType: string;
}

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  modelId?: string;
  /** Files sent as inline parts after the prompt. */
  files?: GeminiFile[];
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

/** The prompt as a text part, followed by one inline part per file. */
function buildParts(prompt: string, files: GeminiFile[] = []) {
  return [
    { text: prompt },
    ...files.map((file) => ({
      inlineData: { data: file.data.toString("base64"), mimeType: file.mimeType },
    })),
  ];
}

/**
 * Generate text content from a prompt using Gemini.
 * @param prompt - The input prompt
 * @param options - Optional temperature, maxOutputTokens, modelId override, files
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
    contents: [{ role: "user", parts: buildParts(prompt, options.files) }],
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
 * @param options - Optional temperature, maxOutputTokens, modelId override, files
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
    contents: [{ role: "user", parts: buildParts(prompt, options.files) }],
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
  if (!text.trim()) {
    throw new Error("Cannot embed empty text");
  }

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
