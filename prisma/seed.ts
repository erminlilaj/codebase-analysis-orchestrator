import { PrismaClient } from '@prisma/client';
import { COBOL_QUESTION_SEEDS } from '../src/languages/cobol/cobolQuestions';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const q of COBOL_QUESTION_SEEDS) {
    await prisma.question.upsert({
      where: { key: q.key },
      update: {},
      create: { key: q.key, text: q.text, language: 'cobol' },
    });
  }
  console.log(`Seeded ${COBOL_QUESTION_SEEDS.length} COBOL questions.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
