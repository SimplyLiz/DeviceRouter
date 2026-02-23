import type { RawSignals } from './profile.js';

// Generic: bot, crawl, spider, slurp
// AI fetchers: chatgpt, anthropic, claude[-_], google-extended, googleagent, gemini,
//              perplexity, mistralai, cohere, deepseek, xai-grok,
//              grok-deepsearch, meta-externalagent, meta-webindexer,
//              webzio, bytedance, omgili
// Social previews: facebookexternalhit, whatsapp
// Headless & automation: headlesschrome, phantomjs, puppeteer, playwright, selenium
// HTTP clients: wget, curl, httpie, python-requests, go-http-client,
//               java\/, perl, ruby, scrapy, apache-httpclient
const BOT_UA_PATTERNS =
  /bot|crawl|spider|slurp|chatgpt|anthropic|claude[-_]|google-extended|googleagent|gemini|perplexity|mistralai|cohere|deepseek|xai-grok|grok-deepsearch|meta-externalagent|meta-webindexer|webzio|bytedance|omgili|facebookexternalhit|whatsapp|headlesschrome|phantomjs|puppeteer|playwright|selenium|wget|curl|httpie|python-requests|go-http-client|java\/|perl|ruby|scrapy|apache-httpclient/i;

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
