import { describe, expect, it } from 'vitest';
import { motion, useReduceMotion } from './motion';

describe('motion system and reduced-motion accessibility', () => {
  it('exports valid motion duration, easing, and spring tokens', () => {
    expect(motion.duration.fast).toBe(180);
    expect(motion.duration.normal).toBe(260);
    expect(motion.spring.subtle).toBeDefined();
    expect(motion.spring.button).toBeDefined();
  });

  it('provides useReduceMotion hook function', () => {
    expect(typeof useReduceMotion).toBe('function');
  });
});
