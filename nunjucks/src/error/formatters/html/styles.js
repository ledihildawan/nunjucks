export const CSS = `
.error-wrapper{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;max-width:800px;margin:40px auto;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);color:var(--color-text-primary);line-height:1.5;overflow:hidden;border-top:4px solid var(--color-error-border);transition:background-color 0.3s ease,color 0.3s ease}
.error-wrapper h1,.error-wrapper h2,.error-wrapper p,.error-wrapper ul,.error-wrapper pre{margin:0}
.error-wrapper h1,.error-wrapper h2{font-weight:inherit}
.error-title{font-size:24px;font-weight:600;color:var(--color-text-primary);line-height:1.3}
.error-location{margin-top:8px;font-size:15px;color:var(--color-text-secondary)}
.error-footer{padding:16px 32px;background:light-dark(oklch(96% 0.01 285), oklch(16% 0.01 285));border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.error-footer .meta{font-size:12px;color:var(--color-text-secondary);word-break:break-all}
.fix-block{margin:0;background:light-dark(oklch(96% 0.01 285), oklch(22% 0.01 285));padding:16px;border-radius:8px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;color:var(--color-text-primary);border:1px solid var(--color-border);white-space:pre-wrap;overflow-x:auto}
.text-label{font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px}
.error-header{padding:24px 32px;border-bottom:1px solid var(--color-border);background:linear-gradient(to bottom,var(--color-error-bg) 0%,var(--color-bg-panel) 100%)}
.error-header-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--color-error-text);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
.code-block{background:var(--color-code-bg);color:var(--color-code-text);border-radius:8px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;overflow:hidden;padding:12px 0}
.code-line{display:flex;padding:4px 20px}
.code-line.is-error{background:var(--color-code-highlight-bg);border-left:3px solid var(--color-error-border);padding-left:17px}
.line-number{color:var(--color-code-line-number);width:24px;user-select:none;text-align:right;margin-right:20px}
.stack-container{font-size:13px;border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
.stack-row{display:flex;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--color-border);transition:background-color 0.15s ease}
.stack-row:hover{background-color:light-dark(oklch(95% 0.01 285), oklch(22% 0.02 285))}
.stack-row:last-child{border-bottom:none}
.btn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s ease;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-solid{background:light-dark(oklch(20% 0.02 285), oklch(90% 0.01 285));color:light-dark(oklch(98% 0.01 285), oklch(10% 0.01 285));border:1px solid transparent}
.btn-solid:hover{background:light-dark(oklch(35% 0.02 285), oklch(100% 0 0))}
.causes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;margin-bottom:32px}
.syntax-comment{color:oklch(60% 0.02 285);font-style:italic}
.syntax-tag{color:oklch(72% 0.15 25)}
.syntax-attr{color:oklch(78% 0.14 110)}
.syntax-delimiter{color:oklch(72% 0.13 190);font-weight:600}
.syntax-pipe{color:oklch(72% 0.13 190);font-weight:600}
.syntax-string{color:oklch(75% 0.15 145)}
.syntax-number{color:oklch(78% 0.16 60)}
.syntax-keyword{color:oklch(70% 0.18 280);font-weight:600}
.syntax-variable{color:oklch(88% 0.02 285)}
.syntax-operator{color:oklch(70% 0.04 285)}
.code-content{color:oklch(65% 0.01 285)}
.code-line.is-error .code-content{color:var(--color-code-text)}
.md-code{font-family:'SFMono-Regular',Consolas,Menlo,monospace;background:var(--color-code-highlight-bg);color:var(--color-code-text);padding:1px 5px;border-radius:4px;font-size:12px}
.causes-list{list-style:none;padding:0;line-height:1.9;font-size:14px;color:var(--color-text-primary)}
.causes-list li{position:relative;padding-left:16px;margin-bottom:4px}
.causes-list li::before{content:'•';position:absolute;left:0;color:var(--color-text-secondary)}
.causes-list strong{color:var(--color-text-primary);font-weight:600}
.loc-link,.stack-link{color:inherit;text-decoration:underline;text-decoration-color:var(--color-text-secondary);text-underline-offset:2px;cursor:pointer;transition:color .15s}
.loc-link:hover,.stack-link:hover{color:oklch(72% .15 190);text-decoration-color:oklch(72% .15 190)}
`;

export const CSS_VARS = `
:root {
  color-scheme: light dark;
  --color-bg-panel: light-dark(oklch(99% 0.005 285), oklch(18% 0.01 285));
  --color-bg-page: light-dark(oklch(97% 0.01 285), oklch(12% 0.01 285));
  --color-text-primary: light-dark(oklch(15% 0.02 285), oklch(95% 0.01 285));
  --color-text-secondary: light-dark(oklch(45% 0.02 285), oklch(75% 0.01 285));
  --color-border: light-dark(oklch(90% 0.01 285), oklch(25% 0.02 285));
  --color-error-text: oklch(60% 0.18 25);
  --color-error-bg: light-dark(oklch(95% 0.03 25), oklch(25% 0.06 25));
  --color-error-border: oklch(65% 0.2 25);
  --color-code-bg: light-dark(oklch(20% 0.01 285), oklch(10% 0.01 285));
  --color-code-text: oklch(90% 0.01 285);
  --color-code-line-number: oklch(55% 0.01 285);
  --color-code-highlight-bg: oklch(30% 0.08 25);
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
