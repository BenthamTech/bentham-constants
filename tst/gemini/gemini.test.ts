import { generateContent, generateJson, embed, _resetClient } from '../../src/gemini/index';

const mockGenerateContent = jest.fn();
const mockEmbedContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
      embedContent: (...args: unknown[]) => mockEmbedContent(...args),
    },
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  _resetClient();
});

describe('generateContent', () => {
  it('returns trimmed text response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '  Hello world  ' });

    const result = await generateContent('say hello');

    expect(result).toBe('Hello world');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'say hello' }] }],
        config: expect.objectContaining({ temperature: 0, maxOutputTokens: 2048 }),
      }),
    );
  });

  it('returns empty string when response has no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: null });

    const result = await generateContent('prompt');

    expect(result).toBe('');
  });

  it('uses custom temperature and maxOutputTokens', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ok' });

    await generateContent('prompt', { temperature: 0.5, maxOutputTokens: 4096 });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ temperature: 0.5, maxOutputTokens: 4096 }),
      }),
    );
  });

  it('uses custom modelId override', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ok' });

    await generateContent('prompt', { modelId: 'gemini-2.5-flash' });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash' }),
    );
  });

  it('sends files as inlineData parts after the prompt', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ok' });
    const image = Buffer.from([0xff, 0xd8, 0xff]);

    await generateContent('describe', { files: [{ data: image, mimeType: 'image/jpeg' }] });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'describe' },
              { inlineData: { data: image.toString('base64'), mimeType: 'image/jpeg' } },
            ],
          },
        ],
      }),
    );
  });

  it('propagates API errors to caller', async () => {
    mockGenerateContent.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

    await expect(generateContent('prompt')).rejects.toThrow('QUOTA_EXCEEDED');
  });

  it('reuses the same client instance across calls', async () => {
    const { GoogleGenAI } = require('@google/genai');
    mockGenerateContent.mockResolvedValue({ text: 'a' });

    await generateContent('first');
    await generateContent('second');

    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  });
});

describe('generateJson', () => {
  it('returns parsed JSON object', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"name":"John","age":30}' });

    const result = await generateJson<{ name: string; age: number }>('extract info');

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('sends responseMimeType application/json', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });

    await generateJson('prompt');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ responseMimeType: 'application/json' }),
      }),
    );
  });

  it('throws on empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    await expect(generateJson('prompt')).rejects.toThrow('Empty response from Gemini');
  });

  it('throws on invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not json{' });

    await expect(generateJson('prompt')).rejects.toThrow();
  });

  it('propagates API errors to caller', async () => {
    mockGenerateContent.mockRejectedValue(new Error('NOT_FOUND'));

    await expect(generateJson('prompt')).rejects.toThrow('NOT_FOUND');
  });

  it('sends each file as a base64 inlineData part after the prompt', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });
    const pdf = Buffer.from('%PDF-1.4 fake');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    await generateJson('read this', {
      files: [
        { data: pdf, mimeType: 'application/pdf' },
        { data: png, mimeType: 'image/png' },
      ],
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'read this' },
              { inlineData: { data: pdf.toString('base64'), mimeType: 'application/pdf' } },
              { inlineData: { data: png.toString('base64'), mimeType: 'image/png' } },
            ],
          },
        ],
      }),
    );
  });

  it('sends only the prompt part when files is empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });

    await generateJson('prompt', { files: [] });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [{ role: 'user', parts: [{ text: 'prompt' }] }],
      }),
    );
  });
});

describe('embed', () => {
  it('returns embedding vector as number array', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

    const result = await embed('test text');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-embedding-001',
        contents: 'test text',
      }),
    );
  });

  it('throws on empty text input', async () => {
    await expect(embed('')).rejects.toThrow('Cannot embed empty text');
    await expect(embed('   ')).rejects.toThrow('Cannot embed empty text');
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it('uses custom modelId for embeddings', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.5] }],
    });

    await embed('text', { modelId: 'custom-embedding-model' });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-embedding-model' }),
    );
  });

  it('propagates API errors to caller', async () => {
    mockEmbedContent.mockRejectedValue(new Error('NETWORK_ERROR'));

    await expect(embed('text')).rejects.toThrow('NETWORK_ERROR');
  });
});
