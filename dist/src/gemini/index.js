"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = generateContent;
exports.generateJson = generateJson;
exports.embed = embed;
exports._resetClient = _resetClient;
const genai_1 = require("@google/genai");
const index_1 = require("../config/index");
let genAIInstance = null;
function getClient() {
    if (!genAIInstance) {
        genAIInstance = new genai_1.GoogleGenAI({
            vertexai: true,
            project: index_1.gcpProject,
            location: index_1.geminiConfig.location,
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
async function generateContent(prompt, options = {}) {
    const client = getClient();
    const modelId = options.modelId || index_1.geminiConfig.model;
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
async function generateJson(prompt, options = {}) {
    const client = getClient();
    const modelId = options.modelId || index_1.geminiConfig.model;
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
    return JSON.parse(text);
}
/**
 * Generate an embedding vector for the given text.
 * @param text - The text to embed
 * @param options - Optional modelId override (defaults to geminiConfig.embeddingModel)
 * @returns The embedding vector as number array
 */
async function embed(text, options = {}) {
    if (!text.trim()) {
        throw new Error("Cannot embed empty text");
    }
    const client = getClient();
    const modelId = options.modelId || index_1.geminiConfig.embeddingModel;
    const result = await client.models.embedContent({
        model: modelId,
        contents: text,
    });
    if (!result.embeddings || !result.embeddings[0]) {
        throw new Error("Empty embedding response from Gemini");
    }
    return result.embeddings[0].values;
}
/**
 * Reset the internal client instance.
 * Useful for testing — not intended for production use.
 */
function _resetClient() {
    genAIInstance = null;
}
