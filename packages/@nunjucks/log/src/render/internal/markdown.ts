const BOLD_MARKDOWN_RE = /\*\*([^*]+)\*\*/gu;
const CODE_MARKDOWN_RE = /`([^`]+)`/gu;

const stripMarkdown = (text: string): string =>
  text.replace(BOLD_MARKDOWN_RE, '$1').replace(CODE_MARKDOWN_RE, '$1');

export { stripMarkdown };
