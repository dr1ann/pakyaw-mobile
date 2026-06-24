import type { FareInput, FareOutput } from './types';

// Placeholder. Pricing is deferred (architecture §4 hard rule).
// Returns null so MVP code that calls this never receives a number.
export function computeFare(_input: FareInput): FareOutput {
  return null;
}
