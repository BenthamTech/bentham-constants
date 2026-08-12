import { FEE_ENQUIRY_OPTIONS, FeeEnquiryOptions } from '../../src/index';
import type {
  FeeEnquiryData,
  FeeEnquiryEntityType,
  CompanyFeeEnquiryInput,
  LlpFeeEnquiryInput,
  FeeEnquiryInput,
} from '../../src/incorporation';

describe('FEE_ENQUIRY_OPTIONS', () => {
  it('exports a non-empty object', () => {
    expect(FEE_ENQUIRY_OPTIONS).toBeDefined();
    expect(Object.keys(FEE_ENQUIRY_OPTIONS).length).toBeGreaterThan(0);
  });

  it('has correct hierarchical structure: enquireFeeFor → natureOfService → subService[]', () => {
    for (const [enquireFeeFor, services] of Object.entries(FEE_ENQUIRY_OPTIONS)) {
      expect(typeof enquireFeeFor).toBe('string');
      expect(typeof services).toBe('object');

      for (const [natureOfService, subServices] of Object.entries(services)) {
        expect(typeof natureOfService).toBe('string');
        expect(Array.isArray(subServices)).toBe(true);
        expect(subServices.length).toBeGreaterThan(0);

        for (const subService of subServices) {
          expect(typeof subService).toBe('string');
        }
      }
    }
  });

  it('contains the Company / SPICe+ incorporation entry', () => {
    expect(FEE_ENQUIRY_OPTIONS['Company']).toBeDefined();
    expect(FEE_ENQUIRY_OPTIONS['Company']['Name reservation and Company Incorporation']).toContain(
      'Incorporation of a company (SPICe+ Part B)'
    );
  });

  it('contains the LLP / FilliP incorporation entry', () => {
    expect(FEE_ENQUIRY_OPTIONS['LLP']).toBeDefined();
    expect(FEE_ENQUIRY_OPTIONS['LLP']['Name reservation and LLP incorporation']).toContain(
      'LLP incorporation (FilliP)'
    );
  });

  it('matches the FeeEnquiryOptions type shape', () => {
    const typed: FeeEnquiryOptions = FEE_ENQUIRY_OPTIONS;
    expect(typed).toBe(FEE_ENQUIRY_OPTIONS);
  });
});

describe('Fee Enquiry Types', () => {
  it('CompanyFeeEnquiryInput discriminates on enquireFeeFor=Company', () => {
    const input: CompanyFeeEnquiryInput = {
      enquireFeeFor: 'Company',
      state: 'KARNATAKA',
      hasAuthorisedCapital: true,
      authorisedCapital: 100000,
    };
    expect(input.enquireFeeFor).toBe('Company');
  });

  it('LlpFeeEnquiryInput discriminates on enquireFeeFor=LLP', () => {
    const input: LlpFeeEnquiryInput = {
      enquireFeeFor: 'LLP',
      contribution: 100000,
    };
    expect(input.enquireFeeFor).toBe('LLP');
  });

  it('FeeEnquiryInput union accepts both Company and LLP', () => {
    const companyInput: FeeEnquiryInput = {
      enquireFeeFor: 'Company',
      state: 'TELANGANA',
      hasAuthorisedCapital: true,
      authorisedCapital: 500000,
    };
    const llpInput: FeeEnquiryInput = {
      enquireFeeFor: 'LLP',
      contribution: 200000,
    };
    expect(companyInput.enquireFeeFor).toBe('Company');
    expect(llpInput.enquireFeeFor).toBe('LLP');
  });

  it('CompanyFeeEnquiryData has Company-specific fields', () => {
    const data: FeeEnquiryData = {
      normalFee: '500',
      additionalFee: '0',
      MoARegFee: '200',
      AoARegFee: '200',
      panTanFees: '131',
      total: '1031',
      stampDutyMoA: '100',
      stampDutyAoA: '100',
      stampDutySpicePlusPartB: '500',
      stampDuty: '700',
    };
    expect(data.total).toBe('1031');
    expect(data.MoARegFee).toBe('200');
  });

  it('LLP response uses same interface with only guaranteed fields', () => {
    const data: FeeEnquiryData = {
      normalFee: '643',
      additionalFee: '0',
      total: '643',
    };
    expect(data.total).toBe('643');
    expect(data.MoARegFee).toBeUndefined();
  });

  it('FeeEnquiryEntityType is Company or LLP', () => {
    const types: FeeEnquiryEntityType[] = ['Company', 'LLP'];
    expect(types).toHaveLength(2);
  });
});
