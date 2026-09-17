/**
 * Shared Cloud Run–optimized headless-Chromium launch configuration.
 *
 * Two automation services (bentham-mca-api, bentham_trademark_api) independently
 * hand-rolled the same `--no-sandbox` / `--disable-dev-shm-usage` base arg set plus
 * the `PUPPETEER_EXECUTABLE_PATH` override. These flags are Cloud Run correctness/
 * stability critical and were drift-prone across repos. This module owns them as a
 * single source of truth.
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
