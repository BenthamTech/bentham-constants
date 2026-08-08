import { errorHandler, notFound, validateOnlyGuard } from '../../src/middleware/index';

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

describe('errorHandler', () => {
  const handler = errorHandler();
  const prodHandler = errorHandler({ exposeStack: false });
  const devHandler = errorHandler({ exposeStack: true });

  it('returns 500 with INTERNAL_ERROR for unknown errors', () => {
    const res = mockRes();
    handler(new Error('boom'), {} as any, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('boom');
    expect(res.body.timestamp).toBeDefined();
  });

  it('uses statusCode and code from error when present', () => {
    const err: any = new Error('not found');
    err.statusCode = 404;
    err.code = 'RESOURCE_NOT_FOUND';
    const res = mockRes();
    handler(err, {} as any, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('includes details when present on error', () => {
    const err: any = new Error('validation');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.details = [{ field: 'email', message: 'required' }];
    const res = mockRes();
    handler(err, {} as any, res, () => {});
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'required' }]);
  });

  it('exposes stack trace only in development', () => {
    const err = new Error('fail');
    const res1 = mockRes();
    devHandler(err, {} as any, res1, () => {});
    expect(res1.body.error.stack).toBeDefined();

    const res2 = mockRes();
    prodHandler(err, {} as any, res2, () => {});
    expect(res2.body.error.stack).toBeUndefined();
  });

  it('notFound returns 404 with route info', () => {
    const handler = notFound();
    const req: any = { method: 'GET', originalUrl: '/api/missing' };
    const res = mockRes();
    handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('GET /api/missing');
  });
});

describe('validateOnlyGuard', () => {
  function mockReq(headerValue?: string) {
    return {
      get: (name: string) => name === 'X-Validate-Only' ? headerValue : undefined,
    } as any;
  }

  it('short-circuits with 200 when header is "true"', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq('true'), res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, valid: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('short-circuits with 200 when header is "1"', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq('1'), res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, valid: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('short-circuits with 200 when header is "yes"', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq('yes'), res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, valid: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('is case-insensitive (TRUE, Yes, 1)', () => {
    for (const val of ['TRUE', 'True', 'YES', 'Yes']) {
      const res = mockRes();
      const next = jest.fn();
      validateOnlyGuard(mockReq(val), res, next);
      expect(res.statusCode).toBe(200);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('calls next() when header is "false"', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq('false'), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.body).toBeNull();
  });

  it('calls next() when header is "0"', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq('0'), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.body).toBeNull();
  });

  it('calls next() when header is empty string', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq(''), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.body).toBeNull();
  });

  it('calls next() when header is missing (undefined)', () => {
    const res = mockRes();
    const next = jest.fn();
    validateOnlyGuard(mockReq(undefined), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.body).toBeNull();
  });
});
