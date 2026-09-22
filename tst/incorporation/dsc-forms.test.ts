import { DSC_FORM_NAMES, LP_DSC_FORM_NAMES } from '../../src/incorporation';

describe('LP_DSC_FORM_NAMES', () => {
  it('is the SPICe+ Part B / INC-33 / INC-34 subset', () => {
    expect(LP_DSC_FORM_NAMES).toEqual(['SPICE + Part B', 'INC-33', 'INC-34']);
  });

  it('is a strict subset of the full DSC_FORM_NAMES', () => {
    for (const name of LP_DSC_FORM_NAMES) {
      expect(DSC_FORM_NAMES).toContain(name);
    }
    expect(LP_DSC_FORM_NAMES.length).toBeLessThan(DSC_FORM_NAMES.length);
  });

  it('excludes the admin-only forms (INC-9, AGILE PRO)', () => {
    expect(LP_DSC_FORM_NAMES).not.toContain('INC-9' as never);
    expect(LP_DSC_FORM_NAMES).not.toContain('AGILE PRO' as never);
  });
});
