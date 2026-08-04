import { gcpProject, geminiConfig, serviceUrls } from '../../src/config';

describe('config', () => {
  it('exports gcpProject', () => {
    expect(gcpProject).toBe('bentham-463307');
  });

  it('exports geminiConfig with model and location', () => {
    expect(geminiConfig.model).toBe('gemini-3.1-flash-lite');
    expect(geminiConfig.location).toBe('global');
    expect(geminiConfig.embeddingModel).toBe('gemini-embedding-001');
    expect(geminiConfig.embeddingLocation).toBe('us-central1');
  });

  it('exports serviceUrls with all expected keys', () => {
    expect(serviceUrls).toHaveProperty('notification');
    expect(serviceUrls).toHaveProperty('storage');
    expect(serviceUrls).toHaveProperty('trademark');
    expect(serviceUrls).toHaveProperty('documentValidator');
    expect(serviceUrls).toHaveProperty('app');
  });

  it('all service URLs are valid HTTPS', () => {
    for (const url of Object.values(serviceUrls)) {
      expect(url).toMatch(/^https:\/\/.+/);
    }
  });
});
