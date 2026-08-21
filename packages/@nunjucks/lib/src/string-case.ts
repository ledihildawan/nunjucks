import { capitalize } from 'remeda';

// WHY: remeda already ships this exact primitive — re-bound under the historical
// `titleCase` export name instead of reimplemented (Rule: idiomatic library leverage).
/** Upper-cases the first character, leaving the remainder of `value` untouched (remeda `capitalize`). */
const titleCase = capitalize;

export { titleCase };
