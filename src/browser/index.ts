/**
 * Shared Cloud Run–optimized headless-Chromium launch configuration, plus the
 * desktop-browser User-Agent strings the automation services spoof.
 *
 * Two automation services (bentham-mca-api, bentham_trademark_api) independently
 * hand-rolled the same `--no-sandbox` / `--disable-dev-shm-usage` base arg set plus
 * the `PUPPETEER_EXECUTABLE_PATH` override. These flags are Cloud Run correctness/
 * stability critical and were drift-prone across repos. This module owns them as a
 * single source of truth. The same went for the spoofed User-Agent strings, which
 * had drifted to five different literals across the two services.
 *
 * Ships as PURE DATA (an arg array + a plain options builder) — `puppeteer` is
 * intentionally NOT a dependency of `@bentham/constants`. Each consumer spreads the
 * base args, appends its own extras, and hands the result to its own puppeteer.launch.
 */

/**
 * Cloud Run base Chromium args shared by every Bentham automation service.
 * Consumers spread these and append service-specific extras.
 */
export const CLOUD_RUN_CHROMIUM_BASE_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
] as const;

/**
 * Desktop Chrome UA used for Chromium automation and HTML scraping. Keep the major
 * version close to the Chromium that puppeteer bundles, since a UA/engine mismatch
 * is itself a bot signal.
 */
export const DESKTOP_CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

/**
 * Desktop Firefox UA used by mca-api's direct MCA HTTP calls (paired with
 * Firefox-session cookies). Changing it changes mca-api's MCA fingerprint.
 */
export const DESKTOP_FIREFOX_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0';

/** The `--user-agent=` launch arg for `buildChromiumLaunchOptions({ extraArgs })`. */
export const DESKTOP_CHROME_USER_AGENT_ARG = `--user-agent=${DESKTOP_CHROME_USER_AGENT}`;

/** Default launch timeout in ms (matches the value both consumers used). */
export const DEFAULT_CHROMIUM_LAUNCH_TIMEOUT_MS = 30000;

export interface ChromiumLaunchOptionsInput {
  /** puppeteer `headless` value — pass through unchanged. */
  headless: boolean | 'new' | 'shell';
  /** Service-specific args appended after the shared base args. */
  extraArgs?: string[];
  /** puppeteer `defaultViewport` — defaults to `null` (full window). */
  defaultViewport?: unknown;
  /** Launch timeout in ms — defaults to {@link DEFAULT_CHROMIUM_LAUNCH_TIMEOUT_MS}. */
  timeoutMs?: number;
}

/**
 * Build a plain puppeteer launch-options object (no puppeteer import).
 *
 * Honours `PUPPETEER_EXECUTABLE_PATH` when set (Cloud Run supplies the Chromium
 * binary path via this env var) and omits `executablePath` entirely when unset,
 * preserving each consumer's existing behaviour.
 */
export function buildChromiumLaunchOptions(
  input: ChromiumLaunchOptionsInput,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    headless: input.headless,
    defaultViewport: input.defaultViewport ?? null,
    args: [...CLOUD_RUN_CHROMIUM_BASE_ARGS, ...(input.extraArgs ?? [])],
    timeout: input.timeoutMs ?? DEFAULT_CHROMIUM_LAUNCH_TIMEOUT_MS,
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return opts;
}
