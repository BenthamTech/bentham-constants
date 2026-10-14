import { CoiRejection, CoiWarning, DOCUMENT_VALIDATOR_PATHS, DocumentValidatorErrorCode } from '../../src/document-validator/index';

describe('DOCUMENT_VALIDATOR_PATHS', () => {
  it('puts every path under /api/v1/validate, where the validator mounts its router', () => {
    for (const path of Object.values(DOCUMENT_VALIDATOR_PATHS)) {
      expect(path).toMatch(/^\/api\/v1\/validate\/[a-z-]+$/);
    }
  });

  it('exposes the COI endpoint', () => {
    expect(DOCUMENT_VALIDATOR_PATHS.coi).toBe('/api/v1/validate/coi');
  });
});

describe('wire enums', () => {
  it('uses each member name as its wire value', () => {
    for (const e of [CoiRejection, CoiWarning, DocumentValidatorErrorCode]) {
      for (const [key, value] of Object.entries(e)) {
        expect(value).toBe(key);
      }
    }
  });
});
