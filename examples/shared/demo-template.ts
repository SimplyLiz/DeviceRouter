// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DemoTemplateOptions {
  profile: any;
  forceParam: string | undefined;
  frameworkName: string;
}

export function renderDemoPage({
  profile,
  forceParam,
  frameworkName,
}: DemoTemplateOptions): string {
  // Determine effective hints — force overrides detected profile
  const hints =
    forceParam === 'lite'
      ? {
          deferHeavyComponents: true,
          serveMinimalCSS: true,
          reduceAnimations: true,
          useImagePlaceholders: true,
          preferServerRendering: true,
          disable3dEffects: true,
        }
      : forceParam === 'full'
        ? {
            deferHeavyComponents: false,
            serveMinimalCSS: false,
            reduceAnimations: false,
            useImagePlaceholders: false,
            preferServerRendering: false,
            disable3dEffects: false,
          }
        : profile?.hints;

  // Four booleans derived from hints drive all rendering decisions
  const full = !hints?.deferHeavyComponents;
  const animate = !hints?.reduceAnimations;
  const richCSS = !hints?.serveMinimalCSS;
  const showImages = !hints?.useImagePlaceholders;

  const activeMode = forceParam === 'full' ? 'full' : forceParam === 'lite' ? 'lite' : 'auto';

  // Battery badge
  const batteryBadge = profile?.profile?.signals?.battery
    ? `${Math.round(profile.profile.signals.battery.level * 100)}%${profile.profile.signals.battery.charging ? ' ⚡' : ''}`
    : '';

  // Connection tier -> badge class
  const connClass = profile
    ? profile.tiers.connection === 'high' || profile.tiers.connection === '4g'
      ? 'high'
      : profile.tiers.connection === '3g'
        ? 'mid'
        : 'low'
    : '';

  // Hint checklist for the profile panel
  const hintEntries = profile
    ? Object.entries(profile.hints)
        .map(
          ([key, val]) =>
            `<li><span style="color:${val ? '#16a34a' : '#94a3b8'}">${val ? '\u2713' : '\u2717'}</span> ${key}</li>`,
        )
        .join('')
    : '';

  const title = frameworkName
    ? `DeviceRouter \u2014 ${frameworkName} Adaptive Demo`
    : 'DeviceRouter \u2014 Adaptive Demo';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="/device-router-probe.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;background:#f8fafc;min-height:100vh}
    .detect-banner{text-align:center;padding:0.75rem;background:#eff6ff;color:#1e40af;font-size:0.875rem;border-bottom:1px solid #dbeafe}
    .mode-strip{text-align:center;padding:0.625rem;color:#fff;font-weight:700;font-size:0.8125rem;letter-spacing:0.08em;text-transform:uppercase}
    .hero{text-align:center;padding:4rem 1.5rem 3rem;background:#4f46e5;color:#fff;position:relative}
    .hero h1{font-size:2.25rem;font-weight:800;margin-bottom:0.5rem}
    .hero p{font-size:1.125rem;opacity:0.85;margin-bottom:1.75rem}
    .cta{display:inline-block;padding:0.75rem 2rem;border-radius:8px;background:#fff;color:#4f46e5;text-decoration:none;font-weight:700;font-size:0.95rem}
    .section-title{text-align:center;font-size:1.5rem;font-weight:700;padding:2.5rem 1rem 1.5rem}
    .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;padding:0 1.5rem 2rem;max-width:960px;margin:0 auto}
    .card{background:#fff;border-radius:12px;padding:1.5rem;border:1px solid #e2e8f0}
    .card-icon{font-size:2rem;margin-bottom:0.75rem;display:block;line-height:1}
    .card h3{font-size:1.0625rem;margin-bottom:0.375rem}
    .card p{color:#64748b;font-size:0.875rem;line-height:1.6}
    .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.5rem;padding:0 1.5rem 2rem;max-width:960px;margin:0 auto}
    .gallery-tile{background:#fff;border-radius:12px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0}
    .gallery-tile h4{margin-top:0.75rem;font-size:0.8125rem;color:#64748b;font-weight:500}
    .placeholder{background:#e2e8f0;border-radius:8px;height:120px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.8rem}
    .profile-panel{max-width:960px;margin:1.5rem auto;padding:0 1.5rem}
    .profile-panel summary{cursor:pointer;font-weight:600;padding:0.75rem 0;font-size:1rem}
    .profile-panel pre{background:#f1f5f9;padding:1rem;border-radius:8px;overflow-x:auto;font-size:0.8rem;line-height:1.6}
    .tier-badge{display:inline-block;padding:0.125rem 0.5rem;border-radius:9999px;font-size:0.75rem;font-weight:600;margin-right:0.5rem}
    .tier-low{background:#fef2f2;color:#dc2626}
    .tier-mid{background:#fefce8;color:#ca8a04}
    .tier-high{background:#f0fdf4;color:#16a34a}
    .hint-list{list-style:none;padding:0.5rem 0}
    .hint-list li{padding:0.25rem 0;font-size:0.875rem;font-family:ui-monospace,monospace}
    .mode-toggle{text-align:center;padding:2rem 1rem;border-top:1px solid #e2e8f0;margin-top:1rem}
    .mode-toggle span{font-size:0.875rem;color:#64748b;margin-right:0.75rem}
    .mode-toggle a{display:inline-block;margin:0 0.25rem;padding:0.5rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:500;font-size:0.8125rem;border:1px solid #e2e8f0;color:#475569}
    .mode-toggle a:hover{background:#f1f5f9}
    .mode-toggle a.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
  </style>
${
  richCSS
    ? `  <style>
    .hero{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding-top:5rem;padding-bottom:3.5rem}
    .hero h1{font-size:3rem;text-shadow:0 2px 8px rgba(0,0,0,0.2)}
    .cta{box-shadow:0 4px 14px rgba(0,0,0,0.15)}
    .card{border:none;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 6px rgba(0,0,0,0.04);border-top:3px solid #4f46e5}
    .gallery-tile{border:none;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
  </style>`
    : ''
}
${
  animate
    ? `  <style>
    .card{transition:transform 0.2s ease,box-shadow 0.2s ease}
    .card:hover{transform:translateY(-4px);box-shadow:0 12px 24px rgba(0,0,0,0.12)}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    .cta{animation:pulse 2.5s ease-in-out infinite}
    @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .gallery-tile{opacity:0;animation:fadeInUp 0.5s ease forwards}
    .gallery-tile:nth-child(2){animation-delay:0.15s}
    .gallery-tile:nth-child(3){animation-delay:0.3s}
    @keyframes bounce{0%,100%{height:8px}50%{height:100%}}
  </style>`
    : ''
}
</head>
<body>
${!profile && !forceParam ? '  <div class="detect-banner">No device profile yet \u2014 the probe script has loaded. <strong>Refresh</strong> to see adaptive rendering.</div>' : ''}
  <div class="mode-strip" style="background:${full ? '#16a34a' : '#d97706'}">${full ? 'Full Experience' : 'Lite Experience'}</div>

  <section class="hero">
    <h1>${full ? 'Deliver the Perfect Experience' : 'Fast & Lightweight'}</h1>
    <p>${full ? 'Real-time device detection \u00b7 adaptive rendering \u00b7 zero guesswork' : 'Optimized for your device \u00b7 fast load times'}</p>
    <a href="#features" class="cta">${full ? 'Explore Features' : 'Learn More'}</a>
${full ? '    <svg style="display:block;width:100%;position:absolute;bottom:-1px;left:0" viewBox="0 0 1440 50" preserveAspectRatio="none"><path d="M0,25 C360,50 720,0 1080,25 L1440,25 L1440,50 L0,50Z" fill="#f8fafc"/></svg>' : ''}
  </section>

  <h2 class="section-title" id="features">How It Works</h2>
  <div class="features">
    <div class="card">
      <span class="card-icon">${
        full
          ? '<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="26" r="2.5" fill="#4f46e5"/><path d="M11 20.5a10 10 0 0 1 14 0" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round"/><path d="M5.5 15.5a17 17 0 0 1 25 0" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round"/></svg>'
          : '\u26A1'
      }</span>
      <h3>Real-Time Detection</h3>
      <p>A ~1 KB probe collects CPU, memory, GPU, network, and battery signals via browser APIs \u2014 no user-agent sniffing.</p>
    </div>
    <div class="card">
      <span class="card-icon">${
        full
          ? '<svg width="36" height="36" viewBox="0 0 36 36" fill="#4f46e5"><rect x="4" y="20" width="8" height="12" rx="2"/><rect x="14" y="12" width="8" height="20" rx="2"/><rect x="24" y="6" width="8" height="26" rx="2"/></svg>'
          : '\u25C6'
      }</span>
      <h3>Smart Classification</h3>
      <p>Devices are classified into CPU, memory, GPU, and connection tiers. Thresholds are fully customizable.</p>
    </div>
    <div class="card">
      <span class="card-icon">${
        full
          ? '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round"><path d="M14 32h8"/><path d="M15 28h6"/><path d="M15 28c-1.5-2.5-5-5.5-5-10.5a8 8 0 1 1 16 0c0 5-3.5 8-5 10.5"/></svg>'
          : '\u2726'
      }</span>
      <h3>Adaptive Hints</h3>
      <p>Boolean rendering hints like <code>deferHeavyComponents</code> let your server respond appropriately.</p>
    </div>
  </div>

  <h2 class="section-title">Analytics</h2>
  <div class="gallery">
${
  showImages
    ? `    <div class="gallery-tile">
      <svg viewBox="0 0 80 80" style="width:100%;max-width:120px"><circle cx="40" cy="40" r="36" fill="#e0e7ff"/><path d="M40 4 A36 36 0 1 1 11 61 L40 40Z" fill="#4f46e5"/><path d="M40 40 L11 61 A36 36 0 0 1 40 4Z" fill="#818cf8"/></svg>
      <h4>Usage Distribution</h4>
    </div>
    <div class="gallery-tile">
      <svg viewBox="0 0 130 75" style="width:100%;max-width:160px"><rect x="5" y="35" width="20" height="40" rx="3" fill="#4f46e5"/><rect x="30" y="15" width="20" height="60" rx="3" fill="#818cf8"/><rect x="55" y="45" width="20" height="30" rx="3" fill="#c7d2fe"/><rect x="80" y="8" width="20" height="67" rx="3" fill="#4f46e5"/><rect x="105" y="25" width="20" height="50" rx="3" fill="#818cf8"/></svg>
      <h4>Device Tiers</h4>
    </div>
    <div class="gallery-tile">
      <svg viewBox="0 0 120 75" style="width:100%;max-width:160px"><polyline points="5,60 25,35 50,45 75,15 95,28 115,8" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="60" r="3.5" fill="#4f46e5"/><circle cx="25" cy="35" r="3.5" fill="#818cf8"/><circle cx="50" cy="45" r="3.5" fill="#4f46e5"/><circle cx="75" cy="15" r="3.5" fill="#818cf8"/><circle cx="95" cy="28" r="3.5" fill="#4f46e5"/><circle cx="115" cy="8" r="3.5" fill="#818cf8"/></svg>
      <h4>Response Times</h4>
    </div>`
    : `    <div class="gallery-tile">
      <div class="placeholder">Loaded on demand</div>
      <h4>Usage Distribution</h4>
    </div>
    <div class="gallery-tile">
      <div class="placeholder">Loaded on demand</div>
      <h4>Device Tiers</h4>
    </div>
    <div class="gallery-tile">
      <div class="placeholder">Loaded on demand</div>
      <h4>Response Times</h4>
    </div>`
}
  </div>

  <details class="profile-panel">
    <summary>Device Profile</summary>
${
  profile
    ? `    <p style="margin:0.75rem 0">
      CPU <span class="tier-badge tier-${profile.tiers.cpu}">${profile.tiers.cpu}</span>
      Memory <span class="tier-badge tier-${profile.tiers.memory}">${profile.tiers.memory}</span>
      Connection <span class="tier-badge tier-${connClass}">${profile.tiers.connection}</span>
      GPU <span class="tier-badge tier-${profile.tiers.gpu === 'none' || profile.tiers.gpu === 'low' ? 'low' : profile.tiers.gpu === 'mid' ? 'mid' : 'high'}">${profile.tiers.gpu}</span>${batteryBadge ? `\n      Battery <span class="tier-badge tier-${profile.profile.signals.battery.level < 0.15 && !profile.profile.signals.battery.charging ? 'low' : profile.profile.signals.battery.level < 0.5 ? 'mid' : 'high'}">${batteryBadge}</span>` : ''}
    </p>
    <ul class="hint-list">${hintEntries}</ul>
    <details style="margin-top:0.5rem"><summary style="font-size:0.875rem;cursor:pointer">Raw Signals</summary>
    <pre>${JSON.stringify(profile.profile.signals, null, 2)}</pre></details>`
    : '    <p style="padding:1rem 0;color:#64748b">No device profile detected yet. Refresh the page after the probe collects signals.</p>'
}
  </details>

  <nav class="mode-toggle">
    <span>Preview mode:</span>
    <a href="?force=full"${activeMode === 'full' ? ' class="active"' : ''}>Full</a>
    <a href="?force=lite"${activeMode === 'lite' ? ' class="active"' : ''}>Lite</a>
    <a href="/"${activeMode === 'auto' ? ' class="active"' : ''}>Auto</a>
  </nav>
</body>
</html>`;
}
