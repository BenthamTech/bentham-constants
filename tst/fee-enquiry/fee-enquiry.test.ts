import { FEE_ENQUIRY_OPTIONS, FeeEnquiryOptions } from '../../src/index';

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

  it('matches the FeeEnquiryOptions type shape', () => {
    const typed: FeeEnquiryOptions = FEE_ENQUIRY_OPTIONS;
    expect(typed).toBe(FEE_ENQUIRY_OPTIONS);
  });
});
