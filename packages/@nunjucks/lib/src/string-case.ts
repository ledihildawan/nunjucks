/** Upper-cases the first character, leaving the remainder of `value` untouched. */
const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export { titleCase };
