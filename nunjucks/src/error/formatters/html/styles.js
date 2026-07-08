export const CSS = `
.error-wrapper{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;max-width:800px;margin:20px auto;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);color:var(--color-text-primary);line-height:1.5;overflow:hidden;border-top:4px solid var(--color-error-border);transition:background-color 0.3s ease,color 0.3s ease}
.error-wrapper h1,.error-wrapper h2,.error-wrapper p,.error-wrapper ul,.error-wrapper pre{margin:0}
.error-wrapper h1,.error-wrapper h2{font-weight:inherit}
.error-title{font-size:24px;font-weight:600;color:var(--color-text-primary);line-height:1.3}
.error-location{margin-top:8px;font-size:14px;color:var(--color-text-secondary);word-break:break-word}
.error-header{padding:24px 32px;border-bottom:1px solid var(--color-border);background:linear-gradient(to bottom,var(--color-error-bg) 0%,var(--color-bg-panel) 100%)}
.error-header-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;font-weight:700;color:var(--color-error-text);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
.badge{padding:2px 8px;border-radius:4px;font-size:10px}
.badge-error{background:var(--color-error-bg);color:var(--color-error-text);letter-spacing:0.05em}
.badge-code{background:var(--color-code-highlight-bg);color:var(--color-code-text);text-transform:lowercase;font-family:monospace}
.code-block{background:var(--color-code-bg);color:var(--color-code-text);border-radius:8px;border:1px solid var(--color-border);font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;overflow-x:auto;padding:12px 0}
.code-line{display:flex;padding:4px 20px;min-width:max-content}
.code-line.is-error{background:var(--color-code-highlight-bg);border-left:3px solid var(--color-error-border);padding-left:17px}
.line-number{color:var(--color-code-line-number);width:24px;user-select:none;text-align:right;margin-right:20px;flex-shrink:0}
.code-content{color:var(--color-code-text)}
.error-body{padding:32px}
.text-label{font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px}
.stack-container{font-size:13px;border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
.stack-row{display:flex;padding:10px 12px;border-bottom:1px solid var(--color-border);transition:background-color 0.15s ease;word-break:break-all}
.stack-row:hover{background-color:var(--color-bg-alt)}
.stack-row:last-child{border-bottom:none}
.stack-code{font-family:'SFMono-Regular',Consolas,Menlo,monospace;color:var(--color-code-text)}
.btn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s ease;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.btn-solid{background:var(--color-btn-bg);color:var(--color-btn-text);border:1px solid transparent}
.btn-solid:hover{background:var(--color-btn-hover)}
.causes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;margin-bottom:32px}
.causes-list{list-style:none;padding:0;line-height:1.9;font-size:14px;color:var(--color-text-primary)}
.causes-list li{position:relative;padding-left:16px;margin-bottom:4px}
.causes-list li::before{content:'•';position:absolute;left:0;color:var(--color-text-secondary)}
.causes-list strong{color:var(--color-text-primary);font-weight:600}
.fix-block{margin:0;background:var(--color-bg-alt);padding:16px;border-radius:8px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;color:var(--color-text-primary);border:1px solid var(--color-border);white-space:pre-wrap;overflow-x:auto}
.render-context{margin-bottom:32px}
.ctx-row{display:flex;gap:12px;padding:6px 12px;border-bottom:1px solid var(--color-border);font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px}
.ctx-row dt{color:oklch(70% 0.15 190);min-width:120px;flex-shrink:0;margin:0}
.ctx-row dd{margin:0;color:var(--color-code-text);word-break:break-all}
.error-footer{padding:16px 32px;background:var(--color-bg-alt);border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.error-footer .meta{font-size:12px;color:var(--color-text-secondary);word-break:break-word}
.loc-link,.stack-link{color:inherit;text-decoration:underline;text-decoration-color:var(--color-text-secondary);text-underline-offset:3px;transition:color .15s}
.loc-link:hover,.stack-link:hover{color:light-dark(oklch(45% 0.15 190),oklch(72% 0.15 190));text-decoration-color:currentColor}
.syntax-comment{color:light-dark(oklch(50% 0.02 285),oklch(60% 0.02 285));font-style:italic}
.syntax-tag{color:light-dark(oklch(45% 0.15 25),oklch(72% 0.15 25))}
.syntax-attr{color:light-dark(oklch(45% 0.15 110),oklch(78% 0.14 110))}
.syntax-delimiter{color:light-dark(oklch(45% 0.15 190),oklch(72% 0.13 190));font-weight:600}
.syntax-pipe{color:light-dark(oklch(45% 0.15 190),oklch(72% 0.13 190));font-weight:600}
.syntax-string{color:light-dark(oklch(40% 0.15 145),oklch(75% 0.15 145))}
.syntax-number{color:light-dark(oklch(45% 0.16 60),oklch(78% 0.16 60))}
.syntax-keyword{color:light-dark(oklch(45% 0.18 280),oklch(70% 0.18 280));font-weight:600}
.syntax-variable{color:light-dark(oklch(25% 0.02 285),oklch(88% 0.02 285))}
.syntax-operator{color:light-dark(oklch(40% 0.04 285),oklch(70% 0.04 285))}
.md-code{font-family:'SFMono-Regular',Consolas,Menlo,monospace;background:var(--color-code-highlight-bg);color:var(--color-code-text);padding:1px 5px;border-radius:4px;font-size:12px}
`;

export const CSS_VARS = `
:root {
  color-scheme: light dark;

  --color-bg-page: light-dark(oklch(97% 0.01 285), oklch(12% 0.01 285));
  --color-bg-panel: light-dark(oklch(100% 0 0), oklch(18% 0.01 285));
  --color-bg-alt: light-dark(oklch(96% 0.01 285), oklch(22% 0.01 285));
  --color-border: light-dark(oklch(90% 0.01 285), oklch(28% 0.02 285));

  --color-text-primary: light-dark(oklch(20% 0.02 285), oklch(95% 0.01 285));
  --color-text-secondary: light-dark(oklch(45% 0.02 285), oklch(75% 0.01 285));

  --color-error-text: light-dark(oklch(45% 0.2 25), oklch(70% 0.18 25));
  --color-error-bg: light-dark(oklch(97% 0.03 25), oklch(25% 0.06 25));
  --color-error-border: light-dark(oklch(60% 0.2 25), oklch(65% 0.2 25));

  --color-code-bg: light-dark(oklch(96% 0.01 285), oklch(14% 0.01 285));
  --color-code-text: light-dark(oklch(25% 0.02 285), oklch(90% 0.01 285));
  --color-code-line-number: light-dark(oklch(65% 0.01 285), oklch(55% 0.01 285));
  --color-code-highlight-bg: light-dark(oklch(95% 0.05 25), oklch(30% 0.08 25));

  --color-btn-bg: light-dark(oklch(20% 0.02 285), oklch(90% 0.01 285));
  --color-btn-text: light-dark(oklch(98% 0.01 285), oklch(15% 0.01 285));
  --color-btn-hover: light-dark(oklch(35% 0.02 285), oklch(100% 0 0));
}
`;

export const PRODUCTION_BODY = `
<main style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;max-width:520px;margin:48px auto;padding:32px;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.15);text-align:center;">
  <div style="margin-bottom:20px;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-error-border)" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:var(--color-text-primary);margin:0 0 8px;">Rendering Interrupted</h1>
  <p style="font-size:14px;color:var(--color-text-secondary);margin:0 0 20px;">An error occurred during template rendering.</p>
  <p style="font-size:13px;color:var(--color-text-secondary);margin:0;">Check server logs for details.</p>
</main>
`;
