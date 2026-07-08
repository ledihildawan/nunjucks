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
  }
}

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, p, ul, pre { margin-block: 0; }
  h1, h2 { font-weight: inherit; }
  ul { padding-inline-start: 0; }
}

@layer base {
  body {
    margin: 0;
    min-block-size: 100dvh;
    padding: 1rem;
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    font-family: system-ui, -apple-system, sans-serif;

    @media (width >= 40rem) { padding: 2.5rem 1.25rem; }
  }
}

@layer layout {
  .error-wrapper {
    inline-size: 100%;
    max-inline-size: 50rem;
    margin-inline: auto;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 1.25rem 1.5rem -0.3125rem rgba(0,0,0,0.1);
    line-height: 1.5;
    overflow: hidden;
    border-block-start: 0.25rem solid var(--color-error-border);
    transition: background-color 0.3s ease, color 0.3s ease;

    .error-header {
      padding: 1rem;
      border-block-end: 1px solid var(--color-border);
      background: linear-gradient(to bottom, var(--color-error-bg) 0%, var(--color-bg-panel) 100%);
      @media (width >= 40rem) { padding: 1.5rem 2rem; }
    }

    .error-body {
      padding: 1rem;
      @media (width >= 40rem) { padding: 2rem; }
    }

    .error-footer {
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
  }

  .causes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-block-end: 2rem;
    @media (width >= 40rem) { grid-template-columns: repeat(2, 1fr); gap: 2rem; }
  }
}

@layer components {
  .error-title {
    font-size: 1.25rem; font-weight: 600; line-height: 1.3;
    @media (width >= 40rem) { font-size: 1.5rem; }
  }

  .text-label {
    font-size: 0.6875rem; font-weight: 700; color: var(--color-text-secondary);
    text-transform: uppercase; letter-spacing: 0.05em; margin-block-end: 0.75rem;
  }

  .badge { padding: 0.2em 0.6em; border-radius: 0.25rem; font-size: 0.625rem; }
  .badge-error { background: var(--color-error-bg); color: var(--color-error-text); letter-spacing: 0.05em; }
  .badge-code { background: var(--color-code-highlight-bg); color: var(--color-code-text); text-transform: lowercase; font-family: monospace; }

  .error-header-title {
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem;
    font-size: 0.6875rem; font-weight: 700; color: var(--color-error-text);
    text-transform: uppercase; letter-spacing: 0.05em; margin-block-end: 0.5rem;
    @media (width >= 40rem) { font-size: 0.75rem; gap: 0.5rem; }
  }

  .code-block {
    background: var(--color-code-bg); color: var(--color-code-text);
    border-radius: 0.5rem; border: 1px solid var(--color-border);
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem; overflow-x: auto; padding-block: 0.75rem;
    @media (width >= 40rem) { font-size: 0.8125rem; }

    .code-line {
      display: flex; padding-inline: 0.75rem; min-inline-size: max-content;
      @media (width >= 40rem) { padding-inline: 1.25rem; }

      &.is-error {
        background: var(--color-code-highlight-bg);
        border-inline-start: 3px solid var(--color-error-border);
        padding-inline-start: 0.5625rem;
        @media (width >= 40rem) { padding-inline-start: 1.0625rem; }
      }
    }

    .line-number {
      color: var(--color-code-line-number); inline-size: 1.25rem;
      user-select: none; text-align: end; margin-inline-end: 0.75rem; flex-shrink: 0;
      @media (width >= 40rem) { inline-size: 1.5rem; margin-inline-end: 1.25rem; }
    }
  }

  .code-content { color: var(--color-code-text); }

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
    li {
      position: relative; padding-inline-start: 1rem; margin-block-end: 0.375rem;
      &::before { content: '•'; position: absolute; inset-inline-start: 0; color: var(--color-text-secondary); }
    }
    strong { color: var(--color-text-primary); font-weight: 600; }
  }

  .fix-block {
    background: var(--color-bg-alt); padding: 1rem; border-radius: 0.5rem;
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem; border: 1px solid var(--color-border);
    white-space: pre-wrap; overflow-x: auto;
    @media (width >= 40rem) { font-size: 0.8125rem; }
  }

  .render-context { margin-block-end: 2rem; }
  .ctx-row {
    display: flex; gap: 0.75rem; padding: 0.375rem 0.75rem;
    border-block-end: 1px solid var(--color-border);
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace; font-size: 0.8125rem;
    dt { color: oklch(70% 0.15 190); min-inline-size: 7.5rem; flex-shrink: 0; margin: 0; }
    dd { margin: 0; color: var(--color-code-text); overflow-wrap: anywhere; }
  }

    .stack-container {
      font-size: 0.75rem; border: 1px solid var(--color-border);
      border-radius: 0.5rem; overflow: hidden;
      @media (width >= 40rem) { font-size: 0.8125rem; }

      .stack-content {
        display: flex; flex-direction: column;
        max-height: 205px;
        overflow: hidden;
        transition: max-height 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        mask-image: linear-gradient(to bottom, transparent 0px, var(--color-code-bg) 20px, var(--color-code-bg) calc(100% - 20px), transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0px, var(--color-code-bg) 20px, var(--color-code-bg) calc(100% - 20px), transparent 100%);

        &.is-expanded {
          max-height: 40rem;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
        }
      }

      .stack-row {
        display: flex; padding: 0.625rem 0.75rem;
        border-block-end: 1px solid var(--color-border);
        border-block-start: 1px solid var(--color-border);
        transition: background-color 0.15s ease;
        &:hover { background-color: var(--color-bg-alt); }
        &:first-child { border-block-start: none; }
        &:last-child { border-block-end: none; }
      }

      .stack-toggle-btn {
        display: flex; align-items: center; justify-content: center;
        inline-size: 100%; padding: 0.625rem 0.75rem;
        background: var(--color-bg-alt); color: var(--color-text-secondary);
        border: none; border-block-start: 1px solid var(--color-border);
        font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
        font-size: 0.75rem; font-weight: 600; cursor: pointer;
        transition: background-color 0.15s, color 0.15s;
        &:hover {
          background-color: var(--color-code-highlight-bg);
          color: var(--color-text-primary);
        }
      }
    }

  .stack-code {
    font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    color: var(--color-code-text);
  }

  .loc-link, .stack-link {
    color: inherit; text-decoration: underline;
    text-decoration-color: var(--color-text-secondary);
    text-underline-offset: 3px; transition: color .15s;
    &:hover {
      color: light-dark(oklch(45% 0.15 190), oklch(72% 0.15 190));
      text-decoration-color: currentColor;
    }
  }

  .error-location {
    margin-block-start: 0.5rem; font-size: 0.8125rem;
    color: var(--color-text-secondary); overflow-wrap: anywhere;
    @media (width >= 40rem) { font-size: 0.875rem; }
  }

  .meta {
    font-size: 0.6875rem; color: var(--color-text-secondary);
    text-align: center; overflow-wrap: anywhere;
    @media (width >= 40rem) { font-size: 0.75rem; text-align: start; }
  }

  .btn {
    padding: 0.8em 1.2em; border-radius: 0.375rem; font-size: 0.8125rem;
    font-weight: 600; cursor: pointer; transition: all 0.2s ease;
    text-decoration: none; display: flex; align-items: center;
    justify-content: center; inline-size: 100%; gap: 0.5rem;
    @media (width >= 40rem) {
      inline-size: max-content; font-size: 0.75rem; justify-content: flex-start;
    }

    &.btn-solid {
      background: var(--color-btn-bg); color: var(--color-btn-text);
      border: 1px solid transparent;
      &:hover { background: var(--color-btn-hover); }
    }
  }
}
`;

export const CSS_VARS = '';

export const PRODUCTION_BODY = `
<main style="font-family:system-ui,-apple-system,sans-serif;max-width:32.5rem;margin:3rem auto;padding:2rem;background:var(--color-bg-panel);border:1px solid var(--color-border);border-radius:0.75rem;box-shadow:0 1.5rem 3rem -0.75rem rgba(0,0,0,0.15);text-align:center;">
  <div style="margin-bottom:1.25rem;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-error-border)" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
  </div>
  <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-text-primary);margin:0 0 0.5rem;">Rendering Interrupted</h1>
  <p style="font-size:0.875rem;color:var(--color-text-secondary);margin:0 0 1.25rem;">An error occurred during template rendering.</p>
  <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin:0;">Check server logs for details.</p>
</main>
`;
