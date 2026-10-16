import {
  FilingWebhookPath,
  MarkType,
  MARK_TYPES,
  FILING_WEBHOOK_LIMITS,
  type CompanyFilingStatusPayload,
  type TrademarkFilingStatusPayload,
} from '../../src/filing-webhook';

describe('FilingWebhookPath', () => {
  // A path rename has to be a deliberate act: every sender and the app route move with it.
  it('matches the routes bentham-app serves', () => {
    expect(FilingWebhookPath).toMatchInlineSnapshot(`
      {
        "COMPANY_OTP_PROGRESS": "/api/webhooks/company-filing/otp-progress",
        "COMPANY_REFERENCE_ID": "/api/webhooks/company-filing/reference-id",
        "COMPANY_STATUS": "/api/webhooks/company-filing/status",
        "TRADEMARK_STATUS": "/api/webhooks/trademark-filing/status",
      }
    `);
  });
});

describe('MarkType', () => {
  it('has WORD and LOGO', () => {
    expect(MarkType.WORD).toBe('WORD');
    expect(MarkType.LOGO).toBe('LOGO');
  });

  it('MARK_TYPES lists every value', () => {
    expect(MARK_TYPES).toEqual(['WORD', 'LOGO']);
  });
});

describe('FILING_WEBHOOK_LIMITS', () => {
  it('matches the receiver limits', () => {
    expect(FILING_WEBHOOK_LIMITS).toEqual({ ERROR_MAX: 1000, FAILED_STEP_MAX: 100 });
  });
});

describe('payload types', () => {
  it('accept both the success and the error shape', () => {
    const companyStatus: CompanyFilingStatusPayload[] = [
      { applicationId: 'a1', status: 'OTP_VERIFICATION_COMPLETE' },
      { applicationId: 'a1', error: 'boom', failedStep: 'login' },
    ];
    const trademarkStatus: TrademarkFilingStatusPayload[] = [
      { applicationId: 'a1', applicationNumber: '123', markType: MarkType.WORD },
      { applicationId: 'a1', error: 'boom', markType: MarkType.LOGO },
    ];
    expect(companyStatus).toHaveLength(2);
    expect(trademarkStatus).toHaveLength(2);
  });
});
