import { EmitterObj } from '../object.js';
import { resolve, dirname } from 'node:path';

export default class Loader extends EmitterObj {
  resolve(from, to) {
    return resolve(dirname(from), to);
  }

  isRelative(filename) {
    return (filename.indexOf('./') === 0 || filename.indexOf('../') === 0);
  }
}
