import type { RawSignals } from './profile.js';

const BOT_UA_PATTERNS =
  /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|twitterbot|linkedinbot|whatsapp|headlesschrome|phantomjs|puppeteer|playwright|wget|curl|httpie|python-requests|go-http-client|java\/|perl|ruby/i;

const HEADLESS_GPU_PATTERNS = /swiftshader|llvmpipe|software rasterizer/i;

export function isBotSignals(signals: RawSignals): boolean {
  if (signals.userAgent && BOT_UA_PATTERNS.test(signals.userAgent)) {
    return true;
  }

  if (signals.gpuRenderer && HEADLESS_GPU_PATTERNS.test(signals.gpuRenderer)) {
    return true;
  }

  const hasNoSubstance =
    signals.viewport === undefined &&
    signals.hardwareConcurrency === undefined &&
    signals.deviceMemory === undefined &&
    signals.userAgent === undefined;

  if (hasNoSubstance) {
    return true;
  }

  return false;
}
