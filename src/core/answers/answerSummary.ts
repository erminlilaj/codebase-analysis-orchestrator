export function answerSummary(parsed: unknown, rawOutput: string): string {
  const parsedSummary = summaryFromParsed(parsed);
  if (parsedSummary) return parsedSummary;

  const eventText = summaryFromEventStream(rawOutput);
  if (eventText) return eventText;

  return rawOutput.trim();
}

function summaryFromParsed(parsed: unknown): string | undefined {
  if (!isRecord(parsed)) return undefined;

  for (const key of ['answer', 'summary', 'purpose', 'description', 'text']) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  if (Object.keys(parsed).length === 0) return undefined;
  return JSON.stringify(parsed);
}

function summaryFromEventStream(rawOutput: string): string | undefined {
  const textParts: string[] = [];

  for (const line of rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    const event = parseRecord(trimmed);
    if (!event) continue;

    const text =
      stringFrom(event.text) ??
      stringFrom(event.message) ??
      stringFrom(event.content) ??
      stringFrom(recordFrom(event.part)?.text) ??
      stringFrom(recordFrom(event.part)?.content) ??
      stringFrom(recordFrom(event.delta)?.text) ??
      stringFrom(recordFrom(event.delta)?.content);

    if (text?.trim()) textParts.push(text.trim());
  }

  return textParts.at(-1);
}

function parseRecord(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
