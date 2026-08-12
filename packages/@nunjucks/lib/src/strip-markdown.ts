const BOLD_MARKDOWN_RE = /\*\*([^*]+)\*\*/gu;
const CODE_MARKDOWN_RE = /`([^`]+)`/gu;

const stripMarkdown = (text: string): string =>
  text.replaceAll(BOLD_MARKDOWN_RE, '$1').replaceAll(CODE_MARKDOWN_RE, '$1');

export { stripMarkdown };