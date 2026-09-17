import {
  CLOUD_RUN_CHROMIUM_BASE_ARGS,
  DEFAULT_CHROMIUM_LAUNCH_TIMEOUT_MS,
  buildChromiumLaunchOptions,
} from '../../src/browser';

describe('CLOUD_RUN_CHROMIUM_BASE_ARGS', () => {
  it('is the exact shared base arg set (order preserved)', () => {
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).toEqual([
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ]);
  });

  it('contains the Cloud Run sandbox-disable flags', () => {
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).toContain('--no-sandbox');
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).toContain('--disable-setuid-sandbox');
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).toContain('--disable-dev-shm-usage');
  });
});

describe('buildChromiumLaunchOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes headless through and applies defaults', () => {
    const opts = buildChromiumLaunchOptions({ headless: 'shell' });
    expect(opts.headless).toBe('shell');
    expect(opts.defaultViewport).toBeNull();
    expect(opts.timeout).toBe(DEFAULT_CHROMIUM_LAUNCH_TIMEOUT_MS);
  });

  it('uses the base args verbatim when no extras are given', () => {
    const opts = buildChromiumLaunchOptions({ headless: false });
    expect(opts.args).toEqual([...CLOUD_RUN_CHROMIUM_BASE_ARGS]);
  });

  it('appends extraArgs after the base args', () => {
    const opts = buildChromiumLaunchOptions({
      headless: false,
      extraArgs: ['--no-zygote', '--mute-audio'],
    });
    expect(opts.args).toEqual([
      ...CLOUD_RUN_CHROMIUM_BASE_ARGS,
      '--no-zygote',
      '--mute-audio',
    ]);
  });

  it('does not mutate CLOUD_RUN_CHROMIUM_BASE_ARGS when extras are appended', () => {
    buildChromiumLaunchOptions({ headless: false, extraArgs: ['--extra'] });
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).toHaveLength(8);
    expect(CLOUD_RUN_CHROMIUM_BASE_ARGS).not.toContain('--extra');
  });

  it('honours a custom defaultViewport and timeoutMs', () => {
    const viewport = { width: 1280, height: 720 };
    const opts = buildChromiumLaunchOptions({
      headless: 'new',
      defaultViewport: viewport,
      timeoutMs: 60000,
    });
    expect(opts.defaultViewport).toBe(viewport);
    expect(opts.timeout).toBe(60000);
  });

  it('sets executablePath when PUPPETEER_EXECUTABLE_PATH is set', () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium';
    const opts = buildChromiumLaunchOptions({ headless: 'shell' });
    expect(opts.executablePath).toBe('/usr/bin/chromium');
  });

  it('omits executablePath entirely when PUPPETEER_EXECUTABLE_PATH is unset', () => {
    const opts = buildChromiumLaunchOptions({ headless: 'shell' });
    expect(opts).not.toHaveProperty('executablePath');
  });

  it('treats an empty PUPPETEER_EXECUTABLE_PATH as unset (falsy)', () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '';
    const opts = buildChromiumLaunchOptions({ headless: 'shell' });
    expect(opts).not.toHaveProperty('executablePath');
  });
});
