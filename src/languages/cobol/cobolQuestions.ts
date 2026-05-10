// Seed data for COBOL questions. Used by prisma/seed.ts.
// IDs are assigned by the database on first seed; these are not DB IDs.
export const COBOL_QUESTION_SEEDS: ReadonlyArray<{ key: string; text: string }> = [
  {
    key: 'purpose',
    text: 'What is the primary purpose of this COBOL program? Describe what it does in plain language.',
  },
  {
    key: 'data-structures',
    text: 'What are the main data structures (working storage, file definitions) used in this program and what do they represent?',
  },
  {
    key: 'business-rules',
    text: 'What business rules or calculations does this program implement? List each rule with a brief explanation.',
  },
];
