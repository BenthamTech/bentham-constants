import { z } from 'zod';
import { validateRequest, validateRequestDeferred, formatZodPath } from '../../src/zod-middleware/index';

function mockReq(data: Record<string, any> = {}) {
  return { body: data.body, query: data.query, params: data.params } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

describe('formatZodPath', () => {
  it('formats simple path', () => {
    expect(formatZodPath(['name'])).toBe('name');
  });

  it('formats nested path with dot notation', () => {
    expect(formatZodPath(['user', 'email'])).toBe('user.email');
  });

  it('formats array indices with bracket notation', () => {
    expect(formatZodPath(['forms', 0, 'name'])).toBe('forms[0].name');
  });

  it('formats multiple array indices', () => {
    expect(formatZodPath(['items', 2, 'tags', 1])).toBe('items[2].tags[1]');
  });

  it('returns empty string for empty path', () => {
    expect(formatZodPath([])).toBe('');
  });

  it('handles leading numeric index', () => {
    expect(formatZodPath([0, 'name'])).toBe('[0].name');
  });
});

describe('validateRequest', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().min(18, 'Must be 18+').optional(),
  });

  it('passes valid body and replaces with parsed data', () => {
    const req = mockReq({ body: { name: 'Ram', email: 'ram@bentham.legal', extra: 'ignored' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Ram', email: 'ram@bentham.legal' });
    expect(req.body.extra).toBeUndefined();
  });

  it('returns 400 with first error by default', () => {
    const req = mockReq({ body: { name: '', email: 'bad' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].field).toBe('name');
    expect(res.body.errors[0].message).toBe('Name is required');
  });

  it('returns all errors when allErrors: true', () => {
    const req = mockReq({ body: { name: '', email: 'bad' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(schema, { allErrors: true })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(1);
    const fields = res.body.errors.map((e: any) => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
  });

  it('validates query when source is "query"', () => {
    const querySchema = z.object({ page: z.coerce.number().min(1) });
    const req = mockReq({ query: { page: '3' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(querySchema, { source: 'query' })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ page: 3 });
  });

  it('validates params when source is "params"', () => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(paramsSchema, { source: 'params' })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.params).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('returns 400 for invalid query params', () => {
    const querySchema = z.object({ page: z.coerce.number().min(1) });
    const req = mockReq({ query: { page: '0' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(querySchema, { source: 'query' })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].field).toBe('page');
  });

  it('formats nested error paths correctly', () => {
    const nestedSchema = z.object({
      address: z.object({ city: z.string().min(1, 'City required') }),
    });
    const req = mockReq({ body: { address: { city: '' } } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(nestedSchema)(req, res, next);

    expect(res.body.errors[0].field).toBe('address.city');
  });

  it('formats array error paths correctly', () => {
    const arraySchema = z.object({
      items: z.array(z.object({ name: z.string().min(1, 'Item name required') })),
    });
    const req = mockReq({ body: { items: [{ name: 'ok' }, { name: '' }] } });
    const res = mockRes();
    const next = jest.fn();

    validateRequest(arraySchema)(req, res, next);

    expect(res.body.errors[0].field).toBe('items[1].name');
  });
});

describe('validateRequestDeferred', () => {
  const schema = z.object({
    message: z.string().min(1, 'Message required'),
  });

  it('stores errors on req._validationErrors and calls next', () => {
    const req = mockReq({ body: { message: '' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequestDeferred(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._validationErrors).toBeDefined();
    expect(req._validationErrors).toHaveLength(1);
    expect(req._validationErrors[0].field).toBe('message');
    expect(req._validationErrors[0].message).toBe('Message required');
  });

  it('replaces body with parsed data on success', () => {
    const req = mockReq({ body: { message: 'hello', extra: 'dropped' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequestDeferred(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._validationErrors).toBeUndefined();
    expect(req.body).toEqual({ message: 'hello' });
  });

  it('validates query when source is "query"', () => {
    const querySchema = z.object({ limit: z.coerce.number() });
    const req = mockReq({ query: { limit: 'abc' } });
    const res = mockRes();
    const next = jest.fn();

    validateRequestDeferred(querySchema, { source: 'query' })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._validationErrors).toBeDefined();
  });

  it('does not send a response on failure', () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    validateRequestDeferred(schema)(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });
});
