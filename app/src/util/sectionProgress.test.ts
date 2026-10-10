import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSectionComplete,
  moduleProgressPercent,
  readCompletedSectionIds,
  sectionCompletionKey,
} from './sectionProgress';
import type { Section } from '../types';

function section(id: string, overrides: Partial<Section> = {}): Section {
  return {
    id,
    heroImage: '',
    title: id,
    description: '',
    blocks: [],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
    ...overrides,
  };
}

describe('moduleProgressPercent', () => {
  const three = [section('a'), section('b'), section('c')];

  // The bug this replaced: every in-progress module reported a flat 60%, so
  // one section done out of ten looked the same as nine.
  it('reports the real fraction, not a fixed value', () => {
    expect(moduleProgressPercent(three, [], null, 'in_progress')).to.eq(0);
    expect(moduleProgressPercent(three, ['a'], null, 'in_progress')).to.eq(33);
    expect(moduleProgressPercent(three, ['a', 'b'], null, 'in_progress')).to.eq(67);
    expect(moduleProgressPercent(three, ['a', 'b', 'c'], null, 'in_progress')).to.eq(100);
  });

  // The server's view wins: someone who finished on another device should not
  // be told they are half way just because this browser has no local ticks.
  it('reports 100 for a completed module regardless of local state', () => {
    expect(moduleProgressPercent(three, [], null, 'completed')).to.eq(100);
  });

  it('is 0 for a module with no sections', () => {
    expect(moduleProgressPercent([], [], null, 'in_progress')).to.eq(0);
    expect(moduleProgressPercent([], [], null, 'not_started')).to.eq(0);
  });

  it('ignores ticks for sections that no longer exist', () => {
    expect(moduleProgressPercent(three, ['a', 'deleted-section'], null, 'in_progress')).to.eq(33);
  });

  // A module quiz is not something you tick off — it counts only once graded.
  it('counts the module-quiz section only when the quiz is passed', () => {
    const withQuiz = [section('a'), section('quiz', { isModuleQuiz: true })];
    expect(moduleProgressPercent(withQuiz, ['a'], null, 'in_progress')).to.eq(50);
    expect(moduleProgressPercent(withQuiz, ['a'], false, 'in_progress')).to.eq(50);
    expect(moduleProgressPercent(withQuiz, ['a'], true, 'in_progress')).to.eq(100);
    expect(moduleProgressPercent(withQuiz, ['a', 'quiz'], null, 'in_progress'), 'a local tick cannot pass a quiz').to.eq(50);
  });
});

describe('isSectionComplete', () => {
  it('uses the local ticks for an ordinary section', () => {
    expect(isSectionComplete(section('a'), ['a'], null)).to.eq(true);
    expect(isSectionComplete(section('a'), ['b'], null)).to.eq(false);
  });

  it('uses the graded result for the module quiz', () => {
    const quiz = section('q', { isModuleQuiz: true });
    expect(isSectionComplete(quiz, ['q'], null), 'pending review').to.eq(false);
    expect(isSectionComplete(quiz, [], false), 'failed').to.eq(false);
    expect(isSectionComplete(quiz, [], true), 'passed').to.eq(true);
  });
});

describe('readCompletedSectionIds', () => {
  beforeEach(() => localStorage.clear());

  it('keys storage per module', () => {
    expect(sectionCompletionKey(42)).to.eq('section-completions-42');
  });

  it('reads back what was stored', () => {
    localStorage.setItem(sectionCompletionKey(7), JSON.stringify(['s1', 's2']));
    expect(readCompletedSectionIds(7)).to.deep.eq(['s1', 's2']);
  });

  it('is empty for a module with nothing stored', () => {
    expect(readCompletedSectionIds(99)).to.deep.eq([]);
  });

  // Whatever is in storage came from a previous build, another tab, or a user
  // with devtools open. None of it should throw during the one-time read that
  // migrates these ticks onto the progress row.
  it('survives junk in storage', () => {
    localStorage.setItem(sectionCompletionKey(1), 'not json');
    expect(readCompletedSectionIds(1)).to.deep.eq([]);

    localStorage.setItem(sectionCompletionKey(2), '{"not":"an array"}');
    expect(readCompletedSectionIds(2)).to.deep.eq([]);

    localStorage.setItem(sectionCompletionKey(3), JSON.stringify(['ok', 5, null, { id: 'x' }]));
    expect(readCompletedSectionIds(3), 'non-strings dropped').to.deep.eq(['ok']);
  });
});
