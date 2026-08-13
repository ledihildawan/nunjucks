import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WHY: single shell-level owner of the views directory resolution. Every route and demo module
// imports VIEWS from here instead of re-computing __dirname independently (was duplicated 6×).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = path.resolve(currentDir, '..', '..', 'views');

export { VIEWS };
