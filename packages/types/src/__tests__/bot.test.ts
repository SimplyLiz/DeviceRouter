import { describe, it, expect } from 'vitest';
import { isBotSignals } from '../bot.js';
import type { RawSignals } from '../profile.js';

const realSignals: RawSignals = {
  hardwareConcurrency: 8,
  deviceMemory: 16,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  pixelRatio: 2,
  gpuRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
};

describe('isBotSignals', () => {
  it('returns false for real browser signals', () => {
    expect(isBotSignals(realSignals)).toBe(false);
  });

  it('returns false for minimal but real signals', () => {
    expect(isBotSignals({ hardwareConcurrency: 4 })).toBe(false);
    expect(isBotSignals({ viewport: { width: 375, height: 812 } })).toBe(false);
    expect(isBotSignals({ deviceMemory: 2 })).toBe(false);
    expect(isBotSignals({ userAgent: 'Mozilla/5.0 Safari/537.36' })).toBe(false);
  });

  describe('user-agent detection', () => {
    it.each([
      // Search engine crawlers
      ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
      ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
      ['YandexBot', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'],
      ['Baiduspider', 'Mozilla/5.0 (compatible; Baiduspider/2.0)'],
      ['DuckDuckBot', 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)'],
      ['Slurp', 'Mozilla/5.0 (compatible; Yahoo! Slurp)'],
      // AI crawlers & fetchers
      ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0)'],
      ['ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 ChatGPT-User/1.0'],
      ['OAI-SearchBot', 'Mozilla/5.0 AppleWebKit/537.36 OAI-SearchBot/1.0'],
      ['ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (compatible; ClaudeBot/1.0)'],
      ['Claude-Web', 'Claude-Web/1.0'],
      ['Claude-User', 'Claude-User/1.0'],
      ['anthropic-ai', 'anthropic-ai/1.0'],
      ['Google-Extended', 'Mozilla/5.0 (compatible; Google-Extended)'],
      ['Gemini-Deep-Research', 'Gemini-Deep-Research/1.0'],
      ['PerplexityBot', 'Mozilla/5.0 PerplexityBot/1.0'],
      ['Perplexity-User', 'Perplexity-User/1.0'],
      ['MistralAI-User', 'MistralAI-User/1.0'],
      ['Cohere', 'cohere-ai/1.0'],
      ['Meta-ExternalAgent', 'Mozilla/5.0 (compatible; meta-externalagent/1.0)'],
      ['Meta-WebIndexer', 'Mozilla/5.0 (compatible; Meta-WebIndexer/1.0)'],
      ['Amazonbot', 'Mozilla/5.0 (compatible; Amazonbot/0.1)'],
      ['CCBot', 'CCBot/2.0'],
      ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider)'],
      ['ByteDance', 'Bytedance/1.0'],
      ['Diffbot', 'Mozilla/5.0 (compatible; Diffbot/0.1)'],
      ['webzio', 'webzio/1.0'],
      ['DeepSeek', 'DeepSeek/1.0'],
      ['GrokBot', 'GrokBot/1.0'],
      ['xAI-Grok', 'xAI-Grok/1.0'],
      ['Grok-DeepSearch', 'Grok-DeepSearch/1.0'],
      ['AI2Bot', 'Mozilla/5.0 (compatible; AI2Bot/1.0)'],
      ['GoogleAgent-Mariner', 'Mozilla/5.0 GoogleAgent-Mariner/1.0'],
      ['omgili', 'omgili/0.5'],
      // Social previews
      ['Facebook', 'facebookexternalhit/1.1'],
      ['Twitter', 'Twitterbot/1.0'],
      ['LinkedIn', 'LinkedInBot/1.0'],
      ['WhatsApp', 'WhatsApp/2.21.4.22'],
      // Generic patterns
      ['generic crawler', 'MyCrawler/1.0'],
      ['generic spider', 'SuperSpider/2.0'],
      ['generic bot', 'SomeBot/1.0'],
      // Headless & automation
      ['HeadlessChrome', 'Mozilla/5.0 HeadlessChrome/120.0.0.0'],
      ['Puppeteer', 'Mozilla/5.0 Puppeteer/1.0'],
      ['Playwright', 'Mozilla/5.0 Playwright/1.40.0'],
      ['PhantomJS', 'Mozilla/5.0 (Unknown; Linux x86_64) PhantomJS/2.1.1'],
      ['Selenium', 'Mozilla/5.0 Selenium/4.15.0'],
      // HTTP clients
      ['curl', 'curl/7.81.0'],
      ['wget', 'Wget/1.21'],
      ['python-requests', 'python-requests/2.28.0'],
      ['Go http', 'Go-http-client/2.0'],
      ['Scrapy', 'Scrapy/2.11.0'],
      ['Apache-HttpClient', 'Apache-HttpClient/4.5.14'],
      ['Java', 'Java/17.0.1'],
      ['libwww-perl', 'libwww-perl/6.67'],
      ['Ruby', 'Ruby/3.2.0'],
      ['httpie', 'HTTPie/3.2.2'],
    ])('detects %s', (_name, ua) => {
      expect(isBotSignals({ ...realSignals, userAgent: ua })).toBe(true);
    });
  });

  describe('headless GPU detection', () => {
    it('detects SwiftShader', () => {
      expect(isBotSignals({ ...realSignals, gpuRenderer: 'Google SwiftShader' })).toBe(true);
    });

    it('detects llvmpipe', () => {
      expect(
        isBotSignals({ ...realSignals, gpuRenderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' }),
      ).toBe(true);
    });

    it('detects Software Rasterizer', () => {
      expect(isBotSignals({ ...realSignals, gpuRenderer: 'Software Rasterizer' })).toBe(true);
    });

    it('allows real GPU renderers', () => {
      expect(isBotSignals({ ...realSignals, gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 3080)' })).toBe(
        false,
      );
    });
  });

  describe('empty signal detection', () => {
    it('detects fully empty signals', () => {
      expect(isBotSignals({})).toBe(true);
    });

    it('detects signals with only non-substantive fields', () => {
      expect(
        isBotSignals({
          pixelRatio: 1,
          prefersReducedMotion: false,
          prefersColorScheme: 'light',
        }),
      ).toBe(true);
    });

    it('allows signals with at least one substantive field', () => {
      expect(isBotSignals({ userAgent: 'Mozilla/5.0 Safari/537.36' })).toBe(false);
      expect(isBotSignals({ hardwareConcurrency: 4 })).toBe(false);
      expect(isBotSignals({ deviceMemory: 8 })).toBe(false);
      expect(isBotSignals({ viewport: { width: 1024, height: 768 } })).toBe(false);
    });
  });
});
