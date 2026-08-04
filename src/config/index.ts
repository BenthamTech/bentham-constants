export const gcpProject = "bentham-463307";

export const geminiConfig = {
  model: "gemini-3.1-flash-lite",
  location: "global",
  embeddingModel: "gemini-embedding-001",
  embeddingLocation: "us-central1",
} as const;

export const serviceUrls = {
  notification: "https://api.notification.bentham.legal",
  storage: "https://api.storage.bentham.legal",
  trademark: "https://api.trademark.bentham.legal",
  documentValidator: "https://api.document-validator.bentham.legal",
  app: "https://www.bentham.legal",
  jeremy: "https://jeremy.bentham.legal",
  // TODO: add mca once custom domain is available (asia-south2 does not support domain mappings)
} as const;
