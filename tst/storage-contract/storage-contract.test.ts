import {
  PLATFORM_MAX_UPLOAD_BYTES,
  SERVICE_MAX_UPLOAD_BYTES,
  UPLOADS_BUCKET,
  UPLOAD_URL_TTL_SECONDS,
  StorageUploadPath,
  UploadRefusalCode,
  UPLOAD_REFUSAL_CODES,
  UPLOAD_REFUSAL_MESSAGES,
  PASSWORD_PROTECTED_PDF_MESSAGE,
  isUploadRefusal,
  isUploadRefusalCode,
} from '../../src/storage-contract';

describe('storage contract', () => {
  // These are shared by storage-api, the app and the services: a change has to be deliberate.
  it('pins the limits, bucket and paths', () => {
    expect({
      PLATFORM_MAX_UPLOAD_BYTES,
      SERVICE_MAX_UPLOAD_BYTES,
      UPLOADS_BUCKET,
      UPLOAD_URL_TTL_SECONDS,
      StorageUploadPath,
    }).toMatchInlineSnapshot(`
      {
        "PLATFORM_MAX_UPLOAD_BYTES": 26214400,
        "SERVICE_MAX_UPLOAD_BYTES": 104857600,
        "StorageUploadPath": {
          "CHECK": "/api/v1/files/check",
          "PROMOTE": "/api/v1/files/promote",
          "UPLOAD_URL": "/api/v1/files/upload_url",
        },
        "UPLOADS_BUCKET": "bentham_storage_uploads",
        "UPLOAD_URL_TTL_SECONDS": 900,
      }
    `);
  });

  it('keeps user uploads within the service ceiling', () => {
    expect(PLATFORM_MAX_UPLOAD_BYTES).toBeLessThanOrEqual(SERVICE_MAX_UPLOAD_BYTES);
  });

  it('has a message for every refusal code', () => {
    expect(Object.keys(UPLOAD_REFUSAL_MESSAGES).sort()).toEqual([...UPLOAD_REFUSAL_CODES].sort());
    for (const message of Object.values(UPLOAD_REFUSAL_MESSAGES)) expect(message.length).toBeGreaterThan(0);
  });

  it('keeps the app’s password-protected PDF wording', () => {
    expect(UPLOAD_REFUSAL_MESSAGES.PASSWORD_PROTECTED_PDF).toBe(PASSWORD_PROTECTED_PDF_MESSAGE);
    expect(PASSWORD_PROTECTED_PDF_MESSAGE).toBe(
      'This PDF is password-protected. Open it, save or print it as a PDF without a password, and upload it again.',
    );
  });
});

describe('isUploadRefusal', () => {
  it('recognizes a 422 body', () => {
    expect(
      isUploadRefusal({ success: false, code: UploadRefusalCode.CONTENT_MISMATCH, message: 'x' }),
    ).toBe(true);
  });

  it.each([
    null,
    'TOO_LARGE',
    { success: false, message: 'Validation failed' },
    { success: false, code: 'SOMETHING_ELSE', message: 'x' },
    { success: true, code: 'TOO_LARGE' },
  ])('rejects %p', (body) => {
    expect(isUploadRefusal(body)).toBe(false);
  });

  it('isUploadRefusalCode checks the value', () => {
    expect(isUploadRefusalCode('EMPTY')).toBe(true);
    expect(isUploadRefusalCode('empty')).toBe(false);
  });
});
