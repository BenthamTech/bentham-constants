import { validateEnv } from '../../src/env';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not throw when all vars are present', () => {
    process.env.FOO = 'bar';
    process.env.BAZ = 'qux';
    expect(() => validateEnv(['FOO', 'BAZ'])).not.toThrow();
  });

  it('throws listing one missing var', () => {
    process.env.FOO = 'bar';
    delete process.env.BAZ;
    expect(() => validateEnv(['FOO', 'BAZ'])).toThrow(
      'Missing required environment variables: BAZ'
    );
  });

  it('throws listing multiple missing vars', () => {
    delete process.env.A;
    delete process.env.B;
    expect(() => validateEnv(['A', 'B'])).toThrow(
      'Missing required environment variables: A, B'
    );
  });

  it('treats empty string as missing', () => {
    process.env.EMPTY = '';
    expect(() => validateEnv(['EMPTY'])).toThrow(
      'Missing required environment variables: EMPTY'
    );
  });

  it('treats whitespace-only as missing', () => {
    process.env.SPACES = '   ';
    expect(() => validateEnv(['SPACES'])).toThrow(
      'Missing required environment variables: SPACES'
    );
  });
});
