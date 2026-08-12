import { CompanyType, COMPANY_TYPE_CONFIG } from '../../src/incorporation';
import type { CompanyTypeConfig } from '../../src/incorporation';

describe('CompanyType', () => {
  it('has PRIVATE_LIMITED and LLP values', () => {
    expect(CompanyType.PRIVATE_LIMITED).toBe('PRIVATE_LIMITED');
    expect(CompanyType.LLP).toBe('LLP');
  });

  it('has exactly 2 members', () => {
    const values = Object.values(CompanyType);
    expect(values).toHaveLength(2);
  });
});

describe('COMPANY_TYPE_CONFIG', () => {
  it('has an entry for every CompanyType', () => {
    for (const type of Object.values(CompanyType)) {
      expect(COMPANY_TYPE_CONFIG[type]).toBeDefined();
    }
  });

  it('each entry has label, suffix, and description', () => {
    for (const config of Object.values(COMPANY_TYPE_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.suffix).toBeTruthy();
      expect(config.description).toBeTruthy();
    }
  });

  it('PRIVATE_LIMITED config is correct', () => {
    const config: CompanyTypeConfig = COMPANY_TYPE_CONFIG[CompanyType.PRIVATE_LIMITED];
    expect(config.label).toBe('Private Limited Company');
    expect(config.suffix).toBe('PRIVATE LIMITED');
    expect(config.description).toContain('startups');
  });

  it('LLP config is correct', () => {
    const config: CompanyTypeConfig = COMPANY_TYPE_CONFIG[CompanyType.LLP];
    expect(config.label).toBe('Limited Liability Partnership');
    expect(config.suffix).toBe('LLP');
    expect(config.description).toContain('professional services');
  });
});
