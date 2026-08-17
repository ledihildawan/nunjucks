declare module '*.css' {
  /** Raw text of the imported stylesheet, inlined by `with { type: 'text' }` imports. */
  const content: string;
  export default content;
}
