import { errorHandler, notFound } from '../../src/middleware/index';

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
