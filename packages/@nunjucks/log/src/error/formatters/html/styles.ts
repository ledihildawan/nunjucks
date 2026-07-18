export const CSS = `
@layer reset, theme, base, layout, components;

@layer theme {
  :root {
    color-scheme: light dark;
    interpolate-size: allow-keywords;

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

    --color-scrollbar-thumb: light-dark(oklch(65% 0.01 285), oklch(45% 0.02 285));
    --color-scrollbar-track: light-dark(oklch(92% 0.01 285), oklch(20% 0.01 285));

    --scrollbar-width: 8px;
  }
}

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, p, ul, pre { margin-block: 0; }
  h1, h2 { font-weight: inherit; }
  ul { padding-inline-start: 0; }
  ::selection { background: oklch(0.55 0.15 285 / 0.3); color: inherit; }

  :root {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
  }

  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
}

@layer base {
  body, .code-block, .stack-code {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    min-block-size: 100dvh;
    padding: 1rem;
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    font-family: system-ui, -apple-system, sans-serif;

    &:has(.error-wrapper), &:has(.prod-main) {
      display: grid;
      place-items: center;
      padding: 0;
    }

    @media (width >= 40rem) { padding: 2.5rem 1.25rem; }
  }
}

@layer layout {
  .error-wrapper {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    max-inline-size: 54rem;
    margin-inline: auto;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 2px 4px -1px oklch(0 0 0 / 0.06),
      0 4px 8px 0 oklch(0 0 0 / 0.04),
      0 8px 16px 0 oklch(0 0 0 / 0.03);
    line-height: 1.5;
    border-block-start: 0.25rem solid var(--color-error-border);
  }

  .error-header {
    flex-shrink: 0;
    padding: 1rem;
    border-block-end: 1px solid var(--color-border);
    background: linear-gradient(to bottom, var(--color-error-bg) 0%, var(--color-bg-panel) 100%);
    @media (width >= 40rem) { padding: 1.5rem 2rem; }
  }

  .error-body {
    flex: 1;
    padding: 1rem;
    @media (width >= 40rem) { padding: 2rem; }
  }

  .source-section { margin-block-end: 2rem; }

  .error-footer {
    flex-shrink: 0;
    padding: 1rem;
    background: var(--color-bg-alt);
    border-block-start: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    @media (width >= 40rem) {
      padding: 1rem 2rem;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  .error-footer-actions { display: flex; align-items: center; }

  .causes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem 2rem;
    margin-block-end: 2rem;
    align-items: start;
    @media (width >= 40rem) { grid-template-columns: repeat(2, 1fr); }
  }

  .causes-grid section {
    min-height: 0;
    overflow: hidden;
  }
}

@layer components {
  .error-title {
    font-size: 1.25rem; font-weight: 600; line-height: 1.3;
    text-wrap: balance;
    @media (width >= 40rem) { font-size: 1.5rem; }
  }

  .text-label {
    font-size: 0.6875rem; font-weight: 700; color: var(--color-text-secondary);
    text-transform: uppercase; letter-spacing: 0.05em; margin-block-end: 0.75rem;
  }
  .section-heading {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    flex-wrap: wrap; margin-block-end: 0.75rem;
  }
  .section-heading .text-label { margin-block-end: 0; }

  .badge { padding: 0.2em 0.6em; border-radius: 0.25rem; font-size: 0.625rem; }
  .badge-error { background: var(--color-error-bg); color: var(--color-error-text); letter-spacing: 0.05em; }
  .badge-code { background: var(--color-code-highlight-bg); color: var(--color-code-text); text-transform: lowercase; font-family: monospace; }
  .badge-dev { background: var(--color-bg-alt); border: 1px solid var(--color-border); text-transform: uppercase; letter-spacing: 0.05em; }

  .prod-ref { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; opacity: 0.7; }

  .error-header-title {
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem;
    font-size: 0.6875rem; font-weight: 700; color: var(--color-error-text);
    text-transform: uppercase; letter-spacing: 0.05em; margin-block-end: 0.5rem;
    @media (width >= 40rem) { font-size: 0.75rem; gap: 0.5rem; }
    .badge-dev { margin-inline-start: auto; }
  }

  .code-block {
    background: var(--color-code-bg); color: var(--color-code-text);
    border-radius: 0.5rem;
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 1px 2px -1px oklch(0 0 0 / 0.06),
      0 2px 4px 0 oklch(0 0 0 / 0.04);
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem; overflow-x: auto; padding-block: 0.75rem;
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
    @media (width >= 40rem) { font-size: 0.8125rem; }
  }

  .code-block::-webkit-scrollbar { height: var(--scrollbar-width); }
  .code-block::-webkit-scrollbar-track { background: transparent; }
  .code-block::-webkit-scrollbar-thumb {
    background-color: var(--color-scrollbar-thumb);
    border-radius: 9999px;
  }

    .code-line {
      display: flex; padding-inline: 0.75rem; min-inline-size: max-content;
      line-height: 1.5; padding-block: 0.25rem;
      @media (width >= 40rem) { padding-inline: 1.25rem; }

      &.is-error {
        background: var(--color-code-highlight-bg);
        box-shadow: inset 3px 0 0 var(--color-error-border);
      }
    }

    .error-marker {
      .line-number {
        inline-size: 1.25rem;
        margin-inline-end: 0.75rem;
        @media (width >= 40rem) { inline-size: 1.5rem; margin-inline-end: 1.25rem; }
      }
    }

    .line-number {
      color: var(--color-code-line-number); inline-size: 1.25rem;
      font-variant-numeric: tabular-nums;
      user-select: none; text-align: end; margin-inline-end: 0.75rem; flex-shrink: 0;
      @media (width >= 40rem) { inline-size: 1.5rem; margin-inline-end: 1.25rem; }
    }
  }

  .code-content { color: var(--color-code-text); line-height: inherit; white-space: pre; }
  .code-content.error-marker-content { color: var(--color-error-text); }

  .syntax-tag { color: light-dark(oklch(45% 0.15 25), oklch(72% 0.15 25)); }
  .syntax-attr { color: light-dark(oklch(45% 0.15 110), oklch(78% 0.14 110)); }
  .syntax-delimiter { color: light-dark(oklch(45% 0.15 190), oklch(72% 0.13 190)); font-weight: 600; }
  .syntax-pipe { color: light-dark(oklch(45% 0.15 190), oklch(72% 0.13 190)); font-weight: 600; }
  .syntax-string { color: light-dark(oklch(40% 0.15 145), oklch(75% 0.15 145)); }
  .syntax-number { color: light-dark(oklch(45% 0.16 60), oklch(78% 0.16 60)); }
  .syntax-keyword { color: light-dark(oklch(45% 0.18 280), oklch(70% 0.18 280)); font-weight: 600; }
  .syntax-variable { color: light-dark(oklch(25% 0.02 285), oklch(88% 0.02 285)); }
  .syntax-operator { color: light-dark(oklch(40% 0.04 285), oklch(70% 0.04 285)); }
  .syntax-comment { color: light-dark(oklch(50% 0.02 285), oklch(60% 0.02 285)); font-style: italic; }

  .md-code {
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    background: var(--color-code-highlight-bg); color: var(--color-code-text);
    padding: 0.125em 0.375em; border-radius: 0.25rem; font-size: 0.75rem;
  }

  .causes-list {
    list-style: none; line-height: 1.8; font-size: 0.875rem;
    text-wrap: pretty;
    li {
      position: relative; padding-inline-start: 1rem; margin-block-end: 0.375rem;
      &::before { content: '•'; position: absolute; inset-inline-start: 0; color: var(--color-text-secondary); }
    }
    strong { color: var(--color-text-primary); font-weight: 600; }
  }

  .fix-block {
    background: var(--color-bg-alt); padding: 1rem; border-radius: 0.5rem;
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem;
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 1px 2px -1px oklch(0 0 0 / 0.06),
      0 2px 4px 0 oklch(0 0 0 / 0.04);
    width: 100%;
    max-width: 100%;
    white-space: pre; overflow-x: auto; overflow-y: auto; line-height: 1.5;
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
    scrollbar-gutter: stable;
    @media (width >= 40rem) { font-size: 0.8125rem; }
  }

  .fix-block::-webkit-scrollbar { width: var(--scrollbar-width); }
  .fix-block::-webkit-scrollbar-track { background: transparent; }
  .fix-block::-webkit-scrollbar-thumb {
    background-color: var(--color-scrollbar-thumb);
    border-radius: 9999px;
  }

  .render-context { margin-block-end: 2rem; }
  .stack-trace { margin-block-end: 2rem; }
  .ctx-toolbar {
    display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;
  }
  .ctx-action {
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    background: var(--color-bg-panel);
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
  }
  .ctx-action:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-secondary);
  }
  .ctx-tree {
    margin: 0; background: var(--color-code-bg);
    border-radius: 0.5rem;
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 1px 2px -1px oklch(0 0 0 / 0.06),
      0 2px 4px 0 oklch(0 0 0 / 0.04);
    overflow: hidden; padding: 0.5rem 0;
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem; line-height: 1.5;
    @media (width >= 40rem) { font-size: 0.8125rem; }
  }
  .ctx-row {
    display: flex; align-items: flex-start;
    padding: 2px 0.75rem;
    user-select: none;
  }
  .ctx-row.is-expandable { cursor: pointer; }
  .ctx-row:hover, .ctx-row:focus-visible { background: var(--color-bg-alt); outline: none; }
  .ctx-row.is-empty { color: var(--color-text-secondary); font-style: italic; }
  .ctx-toggle {
    width: 16px; color: var(--color-text-secondary);
    font-size: 12px; line-height: 18px; text-align: center;
    flex-shrink: 0;
  }
  .ctx-key { color: oklch(70% 0.15 190); font-weight: 600; margin-right: 5px; }
  .ctx-label { color: var(--color-text-secondary); font-style: italic; }
  .ctx-indent { margin-left: 20px; box-shadow: inset 1px 0 0 var(--color-border); padding-left: 5px; }
  .ctx-indent.hidden { display: none; }
  .ctx-string { color: light-dark(oklch(40% 0.15 145), oklch(75% 0.15 145)); }
  .ctx-number { color: light-dark(oklch(45% 0.16 60), oklch(78% 0.16 60)); }
  .ctx-boolean { color: oklch(70% 0.15 280); font-style: italic; }
  .ctx-null, .ctx-undefined { color: oklch(60% 0.15 25); font-style: italic; }

  .stack-container {
    font-size: 0.75rem;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--color-border),
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 1px 2px -1px oklch(0 0 0 / 0.06),
      0 2px 4px 0 oklch(0 0 0 / 0.04);
    @media (width >= 40rem) { font-size: 0.8125rem; }

    .stack-content {
      display: flex; flex-direction: column;
    }

    .stack-row {
      display: flex; padding: 0.625rem 0.75rem;
      overflow-x: auto;
      border-block-end: 1px solid var(--color-border);
      transition: background-color 0.2s ease-out;
      &:hover { background-color: var(--color-bg-alt); }
      &:last-child { border-block-end: none; }
    }

    .stack-toggle-btn {
      display: flex; align-items: center; justify-content: center;
      inline-size: 100%; padding: 0.625rem 0.75rem;
      background: var(--color-bg-alt); color: var(--color-text-secondary);
      border: none; border-block-start: 1px solid var(--color-border);
      font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
      font-size: 0.75rem; font-weight: 600; cursor: pointer;
      transition: background-color 0.2s ease-out, color 0.2s ease-out;
      &:hover {
        background-color: var(--color-code-highlight-bg);
        color: var(--color-text-primary);
      }
      &:focus-visible {
        outline: 2px solid var(--color-error-border);
        outline-offset: -2px;
      }
    }
  }

  .stack-code {
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-variant-numeric: tabular-nums;
    color: var(--color-code-text);
  }

  .stack-at { color: var(--color-text-secondary); font-style: italic; }
  .stack-fn { color: light-dark(oklch(45% 0.15 25), oklch(72% 0.15 25)); font-weight: 600; }

  .loc-link, .stack-link {
    color: inherit; text-decoration: underline;
    text-decoration-color: var(--color-text-secondary);
    text-underline-offset: 3px; transition: color 0.2s ease-out;
    &:hover {
      color: light-dark(oklch(45% 0.15 190), oklch(72% 0.15 190));
      text-decoration-color: currentColor;
    }
  }

  .error-location {
    margin-block-start: 0.5rem; font-size: 0.8125rem;
    color: var(--color-text-secondary); overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
    @media (width >= 40rem) { font-size: 0.875rem; }
  }
  .error-location-link { font-weight: 600; color: var(--color-text-primary); }
  .error-location-text { font-weight: 600; color: var(--color-text-primary); }

  .meta {
    font-size: 0.6875rem; color: var(--color-text-secondary);
    text-align: center; overflow-wrap: anywhere; line-height: 1.4;
    font-variant-numeric: tabular-nums;
    @media (width >= 40rem) { font-size: 0.75rem; text-align: start; }
  }

  .btn {
    padding: 0.8em 1.2em; border-radius: 0.375rem; font-size: 0.8125rem;
    font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-out, color 0.2s ease-out, transform 0.15s ease;
    text-decoration: none; display: flex; align-items: center;
    justify-content: center; inline-size: 100%; gap: 0.5rem;
    @media (width >= 40rem) {
      inline-size: max-content; font-size: 0.75rem; justify-content: flex-start;
    }
    svg { flex-shrink: 0; }
    &:active { transform: scale(0.98); }

    &.btn-solid {
      background: var(--color-btn-bg); color: var(--color-btn-text);
      border: 1px solid transparent;
      box-shadow:
        0 0 0 0.5px oklch(0 0 0 / 0.3),
        inset 0 0 0 1px oklch(100% 0 0 / 0.04),
        inset 0 1px 0 oklch(100% 0 0 / 0.07),
        0 1px 2px oklch(0 0 0 / 0.1),
        0 2px 4px oklch(0 0 0 / 0.06),
        0 4px 8px oklch(0 0 0 / 0.03);
      text-shadow: 0 1px 1px oklch(0 0 0 / 0.15);
      &:hover { background: var(--color-btn-hover); }
    }

    &.btn-disabled { opacity: 0.5; pointer-events: none; }
  }

  .prod-main {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 32.5rem; margin: 3rem auto;
    padding: 2rem; background: var(--color-bg-panel);
    border: 1px solid var(--color-border); border-radius: 0.75rem;
    box-shadow:
      0 0 0 1px oklch(0 0 0 / 0.06),
      0 2px 4px -1px oklch(0 0 0 / 0.06),
      0 4px 8px 0 oklch(0 0 0 / 0.04),
      0 8px 16px 0 oklch(0 0 0 / 0.03);
    text-align: center;
  }
  .prod-icon { margin-block-end: 1.25rem; }
  .prod-title {
    font-size: 1.375rem; font-weight: 700; color: var(--color-text-primary);
    margin: 0 0 0.5rem; text-wrap: balance;
  }
  .prod-desc { font-size: 0.875rem; color: var(--color-text-secondary); margin: 0 0 1.25rem; text-wrap: pretty; }
  .prod-status { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 1.25rem; opacity: 0.8; font-variant-numeric: tabular-nums; }
  .prod-btn {
    display: inline-block; padding: 0.6em 1.5em; border-radius: 0.375rem;
    font-size: 0.8125rem; font-weight: 600; text-decoration: none;
    background: var(--color-btn-bg); color: var(--color-btn-text);
    margin-block-end: 1.25rem; border: none; cursor: pointer;
  }
}
`;

export const CSS_VARS = '';

export const PRODUCTION_BODY = `
<main class="prod-main">
  <div class="prod-icon">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-error-border)" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <h1 class="prod-title">Rendering Interrupted</h1>
  <p class="prod-desc">An error occurred during template rendering.</p>
  <p class="prod-status">500 · Internal Server Error</p>
  <a href="" class="prod-btn">Try Again</a>
</main>
`;
