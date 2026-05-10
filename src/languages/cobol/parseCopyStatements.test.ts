import { describe, it, expect } from 'vitest';
import { parseCopyStatements } from './parseCopyStatements';

describe('parseCopyStatements', () => {
  it('parses a bare COPY statement', () => {
    expect(parseCopyStatements('       COPY UTILS.')).toEqual(['UTILS']);
  });

  it('parses a double-quoted copybook name', () => {
    expect(parseCopyStatements('       COPY "HEADER-REC".')).toEqual(['HEADER-REC']);
  });

  it('parses a single-quoted copybook name', () => {
    expect(parseCopyStatements("       COPY 'FOOTER'.")).toEqual(['FOOTER']);
  });

  it('parses a COPY IN library clause', () => {
    expect(parseCopyStatements('       COPY UTILS IN MYLIB.')).toEqual(['UTILS']);
  });

  it('parses multiple COPY statements', () => {
    const source = `
       COPY HEADER.
       COPY TRAILER.
       COPY UTILS.
    `;
    expect(parseCopyStatements(source)).toEqual(['HEADER', 'TRAILER', 'UTILS']);
  });

  it('deduplicates repeated copybook names', () => {
    const source = `
       COPY UTILS.
       COPY UTILS.
    `;
    expect(parseCopyStatements(source)).toEqual(['UTILS']);
  });

  it('normalises names to uppercase', () => {
    expect(parseCopyStatements('       COPY utils.')).toEqual(['UTILS']);
  });

  it('returns empty array when there are no COPY statements', () => {
    expect(parseCopyStatements('       MOVE 1 TO WS-COUNT.')).toEqual([]);
  });
});
