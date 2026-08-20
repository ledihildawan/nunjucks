import { describe, expect, test } from 'bun:test';
import picocolors from 'picocolors';
import { getSeverityLabel } from './stack-helpers.ts';

// WHY: picocolors ships no strip() — a local SGR-only strip keeps label-text
// assertions readable independently of the exact color-code composition.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching the ESC SGR sequence IS the entire point of this strip helper.
const stripAnsi = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, '');

// WHY: the label text was historically hardcoded to 'Error:' for every severity —
// warnings rendered as yellow "Error: …" in full-verbosity ANSI reports. These
// assertions pin BOTH the stripped text and the per-severity color.
describe('getSeverityLabel', () => {
  test("renders 'Error:' bold red for the error level", () => {
    const label = getSeverityLabel('error');
    expect(stripAnsi(label)).toBe('Error:');
    expect(label).toBe(picocolors.bold(picocolors.red('Error:')));
  });

  test("renders 'Warning:' bold yellow for the warning level", () => {
    const label = getSeverityLabel('warning');
    expect(stripAnsi(label)).toBe('Warning:');
    expect(label).toBe(picocolors.bold(picocolors.yellow('Warning:')));
  });

  test("renders 'Info:' bold blue for the info level", () => {
    const label = getSeverityLabel('info');
    expect(stripAnsi(label)).toBe('Info:');
    expect(label).toBe(picocolors.bold(picocolors.blue('Info:')));
  });

  test("defaults to the 'Error:' label and red color for an absent severity", () => {
    const label = getSeverityLabel(undefined);
    expect(stripAnsi(label)).toBe('Error:');
    expect(label).toBe(picocolors.bold(picocolors.red('Error:')));
  });
});
