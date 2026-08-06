const BOLD_MARKDOWN_RE = /\*\*([^*]+)\*\*/gu;
const CODE_MARKDOWN_RE = /`([^`]+)`/gu;

// Shared by the text and ANSI renderers so both stay in sync.
const stripMarkdown = (text: string): string =>
  text.replace(BOLD_MARKDOWN_RE, '$1').replace(CODE_MARKDOWN_RE, '$1');

export { stripMarkdown };
