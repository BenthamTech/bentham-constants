"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceUrls = exports.geminiConfig = exports.gcpProject = void 0;
exports.gcpProject = "bentham-463307";
exports.geminiConfig = {
    model: "gemini-3.1-flash-lite",
    location: "global",
    embeddingModel: "gemini-embedding-001",
    embeddingLocation: "us-central1",
};
exports.serviceUrls = {
    notification: "https://api.notification.bentham.legal",
    storage: "https://api.storage.bentham.legal",
    trademark: "https://api.trademark.bentham.legal",
    documentValidator: "https://api.document-validator.bentham.legal",
    payment: "https://api.payment.bentham.legal",
    app: "https://www.bentham.legal",
    jeremy: "https://jeremy.bentham.legal",
    // Raw Cloud Run URL: asia-south2 does not support Cloud Run domain mappings.
    // TODO: swap for a custom domain (api.dsc.bentham.legal) once a load balancer is set up.
    dsc: "https://bentham-dsc-api-206295998484.asia-south2.run.app",
    // TODO: add mca once custom domain is available (asia-south2 does not support domain mappings)
};
