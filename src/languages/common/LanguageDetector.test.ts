import { describe, it, expect } from 'vitest';
import { detectLanguage } from './LanguageDetector';

describe('detectLanguage', () => {
  it('detects all COBOL extensions', () => {
    expect(detectLanguage('MAIN.cob')).toBe('cobol');
    expect(detectLanguage('MAIN.cbl')).toBe('cobol');
    expect(detectLanguage('COPY.cpy')).toBe('cobol');
    expect(detectLanguage('COPY.copy')).toBe('cobol');
    expect(detectLanguage('PROG.pco')).toBe('cobol');
  });

  it('is case-insensitive for extensions', () => {
    expect(detectLanguage('MAIN.COB')).toBe('cobol');
    expect(detectLanguage('MAIN.CBL')).toBe('cobol');
    expect(detectLanguage('App.TS')).toBe('typescript');
  });

  it('detects common languages', () => {
    expect(detectLanguage('index.ts')).toBe('typescript');
    expect(detectLanguage('App.tsx')).toBe('typescript');
    expect(detectLanguage('main.py')).toBe('python');
    expect(detectLanguage('Main.java')).toBe('java');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('main.rs')).toBe('rust');
    expect(detectLanguage('script.sh')).toBe('shell');
    expect(detectLanguage('query.sql')).toBe('sql');
  });

  it('falls back to generic for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('generic');
    expect(detectLanguage('file.unknown')).toBe('generic');
  });

  it('falls back to generic when there is no extension', () => {
    expect(detectLanguage('Makefile')).toBe('generic');
    expect(detectLanguage('Dockerfile')).toBe('generic');
  });
});
