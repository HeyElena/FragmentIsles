const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const KEYWORDS = ["deadline", "due", "submission", "meeting", "seminar", "before"] as const;

export type TimeKeyword = (typeof KEYWORDS)[number];

export interface TimeDetectionInput {
  title: string;
  content: string;
}

export interface TimeDetectionResult {
  detectedDateLabel: string;
  eventTime: string;
  possibleEventTitle: string;
  sourceText: string;
  matchedText: string;
  keyword: TimeKeyword | null;
}

type ParsedDateMatch = {
  eventTime: string;
  matchedText: string;
  sourceIndex: number;
  detectedDateLabel: string;
};

function createIsoDate(year: number, monthIndex: number, day: number, hours = 9, minutes = 0) {
  return new Date(year, monthIndex, day, hours, minutes, 0, 0).toISOString();
}

function normalizeTimeLabel(eventTime: string) {
  const date = new Date(eventTime);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  if (hours === "09" && minutes === "00") {
    return `${year}-${month}-${day}`;
  }

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function findKeyword(text: string) {
  const lower = text.toLowerCase();

  for (const keyword of KEYWORDS) {
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      return {
        keyword,
        index,
      };
    }
  }

  return null;
}

function extractSourceText(text: string, anchorIndex: number) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (anchorIndex < 0) {
      break;
    }

    if (text.indexOf(line) <= anchorIndex && anchorIndex <= text.indexOf(line) + line.length) {
      return line;
    }
  }

  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (anchorIndex < 0) {
      break;
    }

    if (
      text.indexOf(sentence) <= anchorIndex &&
      anchorIndex <= text.indexOf(sentence) + sentence.length
    ) {
      return sentence;
    }
  }

  return text.trim().slice(0, 180);
}

function detectDate(text: string): ParsedDateMatch | null {
  const numericPattern = /\b(\d{4})([-/])(\d{2})\2(\d{2})(?:\s+(\d{1,2}):(\d{2}))?\b/;
  const monthPattern =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/i;

  const numericMatch = text.match(numericPattern);
  const monthMatch = text.match(monthPattern);

  if (!numericMatch && !monthMatch) {
    return null;
  }

  const numericIndex = numericMatch?.index ?? Number.POSITIVE_INFINITY;
  const monthIndex = monthMatch?.index ?? Number.POSITIVE_INFINITY;

  if (numericIndex <= monthIndex && numericMatch) {
    const year = Number(numericMatch[1]);
    const month = Number(numericMatch[3]) - 1;
    const day = Number(numericMatch[4]);
    const hours = numericMatch[5] ? Number(numericMatch[5]) : 9;
    const minutes = numericMatch[6] ? Number(numericMatch[6]) : 0;
    const eventTime = createIsoDate(year, month, day, hours, minutes);

    return {
      eventTime,
      matchedText: numericMatch[0],
      sourceIndex: numericMatch.index ?? 0,
      detectedDateLabel: normalizeTimeLabel(eventTime),
    };
  }

  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[1].toLowerCase()];
    const day = Number(monthMatch[2]);
    const year = Number(monthMatch[3]);
    const hours = monthMatch[4] ? Number(monthMatch[4]) : 9;
    const minutes = monthMatch[5] ? Number(monthMatch[5]) : 0;
    const eventTime = createIsoDate(year, month, day, hours, minutes);

    return {
      eventTime,
      matchedText: monthMatch[0],
      sourceIndex: monthMatch.index ?? 0,
      detectedDateLabel: normalizeTimeLabel(eventTime),
    };
  }

  return null;
}

function buildPossibleEventTitle(title: string, sourceText: string, keyword: TimeKeyword | null) {
  if (title.trim()) {
    return title.trim();
  }

  if (keyword) {
    return sourceText.slice(0, 72);
  }

  return sourceText.slice(0, 72) || "Detected time event";
}

export function detectTimeInformation(input: TimeDetectionInput): TimeDetectionResult | null {
  const mergedText = [input.title.trim(), input.content.trim()].filter(Boolean).join("\n");
  if (!mergedText) {
    return null;
  }

  const dateMatch = detectDate(mergedText);
  const keywordMatch = findKeyword(mergedText);

  if (!dateMatch) {
    return null;
  }

  const anchorIndex = Math.min(
    dateMatch.sourceIndex,
    keywordMatch?.index ?? Number.POSITIVE_INFINITY,
  );
  const sourceText = extractSourceText(mergedText, Number.isFinite(anchorIndex) ? anchorIndex : 0);

  return {
    detectedDateLabel: dateMatch.detectedDateLabel,
    eventTime: dateMatch.eventTime,
    possibleEventTitle: buildPossibleEventTitle(input.title, sourceText, keywordMatch?.keyword ?? null),
    sourceText,
    matchedText: dateMatch.matchedText,
    keyword: keywordMatch?.keyword ?? null,
  };
}
