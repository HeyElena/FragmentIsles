import {
  createApiUsageLog,
  getAIProviderSettings,
  getRelationList,
  type AIProviderSettings,
  type RelationListItem,
} from "@/db";

export interface AIFragmentPayload {
  id?: string;
  title: string;
  content: string;
  summary?: string;
  category_name?: string | null;
  tags?: string[];
}

export interface AIEstimate {
  modelName: string;
  estimatedInputLength: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTokenUsage: number;
  estimatedCost: number;
}

export interface AITaskEstimateInput {
  fragments?: AIFragmentPayload[];
  extraText?: string;
}

export interface AnalyzeFragmentResult {
  suggested_title: string;
  summary: string;
  suggested_category: string;
  suggested_tags: string[];
  detected_time_info: string[];
  research_usage: string;
}

export interface AITaxonomyContext {
  existing_categories: string[];
  existing_tags: string[];
}

export type RelationAnalysisType =
  | "similar_only"
  | "support_contradiction_extension"
  | "build_relation_list"
  | "duplicates_only";

export interface RelationSuggestion {
  source_fragment_id: string;
  source_fragment_title: string;
  target_fragment_id: string;
  target_fragment_title: string;
  relation_type:
    | "supports"
    | "contradicts"
    | "extends"
    | "same_topic"
    | "evidence_for"
    | "limitation_of"
    | "method_for"
    | "dataset_for"
    | "duplicate_or_similar";
  reason: string;
  confidence: number;
}

export interface AnalyzeRelationsOptions {
  focusFragmentIds?: string[];
}

export interface MarkdownSummaryOptions {
  customInstruction?: string;
}

export interface KeywordMatchingOptions {
  categoryNames?: string[];
  maxFragments?: number;
  query: string;
  tagNames?: string[];
  timeRangeLabel?: string;
}

export interface KeywordMatchedFragment {
  confidence: number;
  fragment_id: string;
  fragment_title: string;
  reason: string;
}

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type RelationAnalysisResponse = {
  relations?: Array<{
    source_fragment_id?: unknown;
    target_fragment_id?: unknown;
    relation_type?: unknown;
    reason?: unknown;
    confidence?: unknown;
  }>;
};

type KeywordMatchingResponse = {
  matches?: Array<{
    confidence?: unknown;
    fragment_id?: unknown;
    reason?: unknown;
  }>;
};

type RelationCandidatePair = {
  overlap: number;
  sameCategory: boolean;
  score: number;
  sharedTags: string[];
  source: AIFragmentPayload;
  sourceMode: "compressed" | "full";
  target: AIFragmentPayload;
  targetMode: "compressed" | "full";
};

type RelationPromptBatch = {
  estimateText: string;
  prompt: string;
};

type RelationAnalysisPlan = {
  batches: RelationPromptBatch[];
  candidatePairs: RelationCandidatePair[];
  systemPrompt: string;
};

const RELATION_TYPES: RelationSuggestion["relation_type"][] = [
  "supports",
  "contradicts",
  "extends",
  "same_topic",
  "evidence_for",
  "limitation_of",
  "method_for",
  "dataset_for",
  "duplicate_or_similar",
];

const SYMMETRIC_RELATION_TYPES = new Set<RelationSuggestion["relation_type"]>([
  "contradicts",
  "duplicate_or_similar",
  "same_topic",
]);

function buildFragmentText(fragment: AIFragmentPayload) {
  return [
    `Title: ${fragment.title.trim() || "Untitled Fragment"}`,
    fragment.summary?.trim() ? `Summary: ${fragment.summary.trim()}` : "",
    fragment.category_name?.trim() ? `Current Category: ${fragment.category_name.trim()}` : "",
    fragment.tags?.length ? `Current Tags: ${fragment.tags.join(", ")}` : "",
    "Content:",
    fragment.content.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSummaryFragmentText(fragment: AIFragmentPayload) {
  const summary = fragment.summary?.trim() || truncateText(fragment.content, 220);
  const excerpt = truncateText(fragment.content, 820);

  return [
    `Fragment ID: ${fragment.id ?? fragment.title}`,
    `Title: ${fragment.title.trim() || "Untitled Fragment"}`,
    fragment.category_name?.trim() ? `Category: ${fragment.category_name.trim()}` : "Category: Uncategorized",
    fragment.tags?.length ? `Tags: ${fragment.tags.join(", ")}` : "Tags: None",
    `Summary: ${summary}`,
    `Content Excerpt: ${excerpt}`,
  ].join("\n");
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function computeOverlapScore(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / union.size;
}

function estimateOutputTokens(inputTokens: number) {
  return Math.max(160, Math.round(inputTokens * 0.45));
}

function computeEstimatedCost(
  inputTokens: number,
  outputTokens: number,
  provider: AIProviderSettings,
) {
  return (
    (inputTokens / 1000) * provider.input_token_price +
    (outputTokens / 1000) * provider.output_token_price
  );
}

function buildEstimateFromText(provider: AIProviderSettings, text: string): AIEstimate {
  const estimatedInputLength = text.length;
  const estimatedInputTokens = Math.max(32, Math.ceil(estimatedInputLength / 4));
  const estimatedOutputTokens = estimateOutputTokens(estimatedInputTokens);
  const estimatedTokenUsage = estimatedInputTokens + estimatedOutputTokens;
  const estimatedCost = computeEstimatedCost(
    estimatedInputTokens,
    estimatedOutputTokens,
    provider,
  );

  return {
    modelName: provider.model_name.trim() || "unconfigured-model",
    estimatedInputLength,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTokenUsage,
    estimatedCost,
  };
}

function combineEstimates(estimates: AIEstimate[], modelName: string) {
  return estimates.reduce<AIEstimate>(
    (combined, current) => ({
      modelName,
      estimatedCost: combined.estimatedCost + current.estimatedCost,
      estimatedInputLength: combined.estimatedInputLength + current.estimatedInputLength,
      estimatedInputTokens: combined.estimatedInputTokens + current.estimatedInputTokens,
      estimatedOutputTokens: combined.estimatedOutputTokens + current.estimatedOutputTokens,
      estimatedTokenUsage: combined.estimatedTokenUsage + current.estimatedTokenUsage,
    }),
    {
      modelName,
      estimatedCost: 0,
      estimatedInputLength: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTokenUsage: 0,
    },
  );
}

function getChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function getMessageContent(content: ChatCompletionsResponse["choices"]) {
  const rawContent = content?.[0]?.message?.content;
  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item) => item.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractJsonText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AI 返回为空，无法解析 JSON。");
  }

  const candidates: string[] = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  let lastParseError: string | null = null;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      JSON.parse(candidate);
      return candidate;
    } catch (error) {
      lastParseError = error instanceof Error ? error.message : String(error);
    }
  }

  const detail = lastParseError ? `\n\n解析错误：\n${lastParseError}` : "";
  throw new Error(`模型返回的内容不是合法 JSON。${detail}\n\n原始返回全文：\n${trimmed}`);
}

function escapeJsonString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function repairAnalyzeFragmentJson(text: string) {
  const title = text.match(/"suggested_title"\s*:\s*"([\s\S]*?)"/);
  const summary = text.match(/"summary"\s*:\s*"([\s\S]*?)"/);
  const category = text.match(/"suggested_category"\s*:\s*"([\s\S]*?)"/);
  const usage = text.match(/"research_usage"\s*:\s*"([\s\S]*?)"/);
  const tags = text.match(/"suggested_tags"\s*:\s*\[([\s\S]*?)\]/);
  const times = text.match(/"detected_time_info"\s*:\s*\[([\s\S]*?)\]/);

  if (!title || !summary || !category || !usage || !tags || !times) {
    return null;
  }

  const parseArrayValues = (input: string) =>
    [...input.matchAll(/"([\s\S]*?)"/g)].map((match) => match[1].trim()).filter(Boolean);

  return JSON.stringify({
    suggested_title: title[1].trim(),
    summary: escapeJsonString(summary[1].trim()),
    suggested_category: category[1].trim(),
    suggested_tags: parseArrayValues(tags[1]),
    detected_time_info: parseArrayValues(times[1]),
    research_usage: usage[1].trim(),
  })
    .replace(/\\\\/g, "\\")
    .replace(/"summary":"([\s\S]*?)"/, (_, value: string) => `"summary":"${value}"`);
}

function parseAnalyzeFragmentResult(text: string) {
  try {
    const jsonText = extractJsonText(text);
    return normalizeAnalyzeFragmentResult(JSON.parse(jsonText));
  } catch (error) {
    const repaired = repairAnalyzeFragmentJson(text);
    if (repaired) {
      try {
        return normalizeAnalyzeFragmentResult(JSON.parse(repaired));
      } catch {
        throw error;
      }
    }

    throw error;
  }
}

function normalizeAnalyzeFragmentResult(value: unknown): AnalyzeFragmentResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 返回 JSON 结构不正确。");
  }

  const record = value as Record<string, unknown>;
  const suggestedTitle =
    typeof record.suggested_title === "string" ? record.suggested_title.trim() : "";
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const suggestedCategory =
    typeof record.suggested_category === "string" ? record.suggested_category.trim() : "";
  const suggestedTags = Array.isArray(record.suggested_tags)
    ? record.suggested_tags
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const detectedTimeInfo = Array.isArray(record.detected_time_info)
    ? record.detected_time_info
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const researchUsage =
    typeof record.research_usage === "string" ? record.research_usage.trim() : "";

  if (!suggestedTitle || !summary || !suggestedCategory || !researchUsage) {
    throw new Error("AI 返回 JSON 缺少必要字段。");
  }

  return {
    suggested_title: suggestedTitle,
    summary,
    suggested_category: suggestedCategory,
    suggested_tags: [...new Set(suggestedTags)],
    detected_time_info: [...new Set(detectedTimeInfo)],
    research_usage: researchUsage,
  };
}

async function buildEstimate(input: AITaskEstimateInput): Promise<AIEstimate> {
  const provider = await getAIProviderSettings();
  const fragmentText = (input.fragments ?? []).map(buildFragmentText).join("\n\n");
  const extraText = input.extraText?.trim() ?? "";
  const mergedText = [fragmentText, extraText].filter(Boolean).join("\n\n");
  return buildEstimateFromText(provider, mergedText);
}

async function logUsage(
  featureName: string,
  provider: AIProviderSettings,
  estimate: AIEstimate,
  usage?: ChatCompletionsResponse["usage"],
) {
  const inputTokens = usage?.prompt_tokens ?? estimate.estimatedInputTokens;
  const outputTokens = usage?.completion_tokens ?? estimate.estimatedOutputTokens;
  const estimatedCost = computeEstimatedCost(inputTokens, outputTokens, provider);

  await createApiUsageLog({
    feature_name: featureName,
    model: provider.model_name.trim() || estimate.modelName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: estimatedCost,
  });
}

async function logEstimatedUsage(featureName: string, estimate: AIEstimate) {
  await createApiUsageLog({
    feature_name: featureName,
    model: estimate.modelName,
    input_tokens: estimate.estimatedInputTokens,
    output_tokens: estimate.estimatedOutputTokens,
    estimated_cost: estimate.estimatedCost,
  });
}

async function logTokenTotals(
  featureName: string,
  provider: AIProviderSettings,
  inputTokens: number,
  outputTokens: number,
) {
  await createApiUsageLog({
    feature_name: featureName,
    model: provider.model_name.trim() || "unconfigured-model",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: computeEstimatedCost(inputTokens, outputTokens, provider),
  });
}

function ensureProviderConfigured(provider: AIProviderSettings) {
  if (!provider.api_base_url.trim()) {
    throw new Error("请先在 Settings 中填写 API base URL。");
  }

  if (!provider.api_key.trim()) {
    throw new Error("请先在 Settings 中填写 API key。");
  }

  if (!provider.model_name.trim()) {
    throw new Error("请先在 Settings 中填写 model name。");
  }
}

async function postChatCompletions(
  provider: AIProviderSettings,
  body: Record<string, unknown>,
) {
  const response = await fetch(getChatCompletionsUrl(provider.api_base_url.trim()), {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.api_key.trim()}`,
    },
    method: "POST",
  });

  const rawText = await response.text();
  let json: ChatCompletionsResponse | null = null;
  try {
    json = rawText ? (JSON.parse(rawText) as ChatCompletionsResponse) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`AI 请求失败：HTTP ${response.status}\n\n接口返回全文：\n${rawText || "(empty response)"}`);
    }

    throw new Error(`AI 接口返回内容无法解析为 JSON。\n\n接口返回全文：\n${rawText || "(empty response)"}`);
  }

  if (!response.ok) {
    throw new Error(
      `${json?.error?.message || `AI 请求失败：HTTP ${response.status}`}\n\n接口返回全文：\n${rawText || "(empty response)"}`,
    );
  }

  return json ?? {};
}

async function postAnalyzeFragmentRequest(
  provider: AIProviderSettings,
  systemPrompt: string,
  userPrompt: string,
) {
  const baseBody = {
    model: provider.model_name.trim(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  };

  try {
    return await postChatCompletions(provider, {
      ...baseBody,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const unsupportedResponseFormat =
      message.includes("response_format") ||
      message.includes("json_object") ||
      message.includes("json schema") ||
      message.includes("unsupported");

    if (!unsupportedResponseFormat) {
      throw error;
    }

    return postChatCompletions(provider, baseBody);
  }
}

async function postStrictJsonRequest(
  provider: AIProviderSettings,
  systemPrompt: string,
  userPrompt: string,
) {
  return postAnalyzeFragmentRequest(provider, systemPrompt, userPrompt);
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}


function buildSourceFragmentsMarkdown(fragments: AIFragmentPayload[]) {
  return [
    "## Source Fragments",
    "",
    ...fragments.map(
      (fragment) => `- ${fragment.id ?? "unknown-id"} - ${fragment.title.trim() || "Untitled Fragment"}`,
    ),
  ].join("\n");
}

function normalizeKeywordMatchingResponse(
  value: unknown,
  fragmentMap: Map<string, AIFragmentPayload>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 返回的匹配结果结构不正确。");
  }

  const matches: NonNullable<KeywordMatchingResponse["matches"]> = Array.isArray(
    (value as KeywordMatchingResponse).matches,
  )
    ? (value as KeywordMatchingResponse).matches ?? []
    : [];

  const normalized = matches.flatMap((item) => {
    const fragmentId = typeof item.fragment_id === "string" ? item.fragment_id.trim() : "";
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    const confidenceValue =
      typeof item.confidence === "number"
        ? item.confidence
        : typeof item.confidence === "string"
          ? Number(item.confidence)
          : NaN;
    const fragment = fragmentMap.get(fragmentId);

    if (!fragment || !reason) {
      return [];
    }

    const confidence = Number.isFinite(confidenceValue)
      ? Math.max(0, Math.min(1, confidenceValue))
      : 0.72;

    return [
      {
        confidence: Number(confidence.toFixed(2)),
        fragment_id: fragmentId,
        fragment_title: fragment.title.trim() || "Untitled Fragment",
        reason,
      } satisfies KeywordMatchedFragment,
    ];
  });

  const seen = new Set<string>();
  return normalized.filter((match) => {
    if (seen.has(match.fragment_id)) {
      return false;
    }

    seen.add(match.fragment_id);
    return true;
  });
}

function buildRelationPairKey(
  sourceId: string,
  targetId: string,
  relationType: RelationSuggestion["relation_type"],
) {
  if (SYMMETRIC_RELATION_TYPES.has(relationType)) {
    const [left, right] = [sourceId, targetId].sort();
    return `${left}:${right}:${relationType}`;
  }

  return `${sourceId}:${targetId}:${relationType}`;
}

function buildRelevantExistingRelationSet(relations: RelationListItem[]) {
  return new Set(
    relations.map((relation) =>
      buildRelationPairKey(
        relation.source_fragment_id,
        relation.target_fragment_id,
        relation.relation_type,
      ),
    ),
  );
}

function buildRelationFragmentText(
  fragment: AIFragmentPayload,
  mode: "compressed" | "full",
) {
  const summary = fragment.summary?.trim();
  const safeSummary = summary || truncateText(fragment.content, 240);
  const contentExcerpt =
    mode === "full"
      ? truncateText(fragment.content, 1600)
      : truncateText(summary || fragment.content, 360);

  return [
    `Title: ${fragment.title.trim() || "Untitled Fragment"}`,
    fragment.category_name?.trim() ? `Category: ${fragment.category_name.trim()}` : "Category: Uncategorized",
    fragment.tags?.length ? `Tags: ${fragment.tags.join(", ")}` : "Tags: None",
    `Summary: ${safeSummary}`,
    `Content Excerpt: ${contentExcerpt}`,
  ].join("\n");
}

function normalizePairOrdering(
  source: AIFragmentPayload,
  target: AIFragmentPayload,
) {
  const sourceId = source.id ?? source.title;
  const targetId = target.id ?? target.title;

  return sourceId.localeCompare(targetId) <= 0
    ? { source, target }
    : { source: target, target: source };
}

function buildRelationScore(
  left: AIFragmentPayload,
  right: AIFragmentPayload,
  focusSet: Set<string>,
  adjacencyMap: Map<string, number>,
) {
  const leftTokens = tokenize([left.title, left.summary, left.content].join(" "));
  const rightTokens = tokenize([right.title, right.summary, right.content].join(" "));
  const overlap = computeOverlapScore(leftTokens, rightTokens);
  const leftTagSet = new Set(left.tags ?? []);
  const rightTagSet = new Set(right.tags ?? []);
  const sharedTags = [...leftTagSet].filter((tag) => rightTagSet.has(tag));
  const sameCategory =
    Boolean(left.category_name?.trim()) &&
    Boolean(right.category_name?.trim()) &&
    left.category_name?.trim() === right.category_name?.trim();
  const focusBoost =
    focusSet.size > 0 &&
    (focusSet.has(left.id ?? "") || focusSet.has(right.id ?? "")) ? 1.6 : 0;
  const adjacencyBoost =
    (adjacencyMap.get(left.id ?? "") ?? 0) * 0.12 + (adjacencyMap.get(right.id ?? "") ?? 0) * 0.12;
  const score =
    overlap * 5.2 +
    sharedTags.length * 1.9 +
    (sameCategory ? 1.35 : 0) +
    focusBoost +
    adjacencyBoost;

  return {
    overlap,
    sameCategory,
    score,
    sharedTags,
  };
}

function buildRelationPromptBatches(
  candidatePairs: RelationCandidatePair[],
  analysisType: RelationAnalysisType,
  existingRelations: RelationListItem[],
  focusFragmentIds: string[],
) {
  const systemPrompt = [
    "You are a relation analysis assistant for Fragment Isles.",
    "Return strict JSON only.",
    "JSON schema:",
    "{",
    '  "relations": [',
    "    {",
    '      "source_fragment_id": "string",',
    '      "target_fragment_id": "string",',
    '      "relation_type": "supports | contradicts | extends | same_topic | evidence_for | limitation_of | method_for | dataset_for | duplicate_or_similar",',
    '      "reason": "string",',
    '      "confidence": 0.0',
    "    }",
    "  ]",
    "}",
    "Only output relations that are meaningfully supported by the provided fragment material.",
    "Do not repeat an already existing relation of the same normalized pair and relation_type.",
    "If no relation is strong enough, return an empty relations array.",
    "Keep reasons concise and evidence-based.",
  ].join("\n");

  const batchSize = focusFragmentIds.length > 0 ? 5 : 4;
  const batches: RelationPromptBatch[] = [];

  for (let index = 0; index < candidatePairs.length; index += batchSize) {
    const chunk = candidatePairs.slice(index, index + batchSize);
    const chunkFragmentIds = new Set<string>();
    for (const pair of chunk) {
      if (pair.source.id) {
        chunkFragmentIds.add(pair.source.id);
      }
      if (pair.target.id) {
        chunkFragmentIds.add(pair.target.id);
      }
    }

    const relevantExistingRelations = existingRelations
      .filter(
        (relation) =>
          chunkFragmentIds.has(relation.source_fragment_id) ||
          chunkFragmentIds.has(relation.target_fragment_id),
      )
      .slice(0, 10)
      .map(
        (relation) =>
          `- ${relation.source_fragment_title} -> ${relation.target_fragment_title} · ${relation.relation_type}`,
      );

    const chunkBody = chunk
      .map((pair, pairIndex) =>
        [
          `Pair ${pairIndex + 1}`,
          `source_fragment_id: ${pair.source.id ?? pair.source.title}`,
          buildRelationFragmentText(pair.source, pair.sourceMode),
          "",
          `target_fragment_id: ${pair.target.id ?? pair.target.title}`,
          buildRelationFragmentText(pair.target, pair.targetMode),
          "",
          `Shared Tags: ${pair.sharedTags.length > 0 ? pair.sharedTags.join(", ") : "None"}`,
          `Same Category: ${pair.sameCategory ? "yes" : "no"}`,
          `Lexical Overlap Score: ${pair.overlap.toFixed(2)}`,
        ].join("\n"),
      )
      .join("\n\n");

    const userPrompt = [
      `Analysis Type: ${analysisType}`,
      focusFragmentIds.length > 0 ? `Focus Fragment IDs: ${focusFragmentIds.join(", ")}` : "",
      relevantExistingRelations.length > 0
        ? `Relevant Existing Relations:\n${relevantExistingRelations.join("\n")}`
        : "Relevant Existing Relations:\n- None",
      "",
      "Evaluate the following candidate fragment pairs.",
      "The provided summaries and excerpts are intentionally compressed to save tokens.",
      "Only keep relations that are useful enough to show in a user review step.",
      "",
      chunkBody,
    ]
      .filter(Boolean)
      .join("\n");

    batches.push({
      estimateText: `${systemPrompt}\n\n${userPrompt}`,
      prompt: userPrompt,
    });
  }

  return {
    batches,
    systemPrompt,
  };
}

function buildRelationAnalysisPlan(
  fragments: AIFragmentPayload[],
  existingRelations: RelationListItem[],
  analysisType: RelationAnalysisType,
  options: AnalyzeRelationsOptions,
): RelationAnalysisPlan {
  const focusSet = new Set(options.focusFragmentIds ?? []);
  const adjacencyMap = new Map<string, number>();
  for (const relation of existingRelations) {
    adjacencyMap.set(
      relation.source_fragment_id,
      (adjacencyMap.get(relation.source_fragment_id) ?? 0) + 1,
    );
    adjacencyMap.set(
      relation.target_fragment_id,
      (adjacencyMap.get(relation.target_fragment_id) ?? 0) + 1,
    );
  }

  const scoredPairs: RelationCandidatePair[] = [];

  for (let index = 0; index < fragments.length; index += 1) {
    const current = fragments[index];
    for (let nestedIndex = index + 1; nestedIndex < fragments.length; nestedIndex += 1) {
      const target = fragments[nestedIndex];
      if (
        focusSet.size > 0 &&
        !focusSet.has(current.id ?? "") &&
        !focusSet.has(target.id ?? "")
      ) {
        continue;
      }

      const ordering = normalizePairOrdering(current, target);
      const scoreMeta = buildRelationScore(ordering.source, ordering.target, focusSet, adjacencyMap);
      const includePair =
        scoreMeta.sharedTags.length > 0 ||
        scoreMeta.sameCategory ||
        scoreMeta.overlap >= 0.1 ||
        scoreMeta.score >= 1.45;

      if (!includePair) {
        continue;
      }

      const sourceMode =
        focusSet.has(ordering.source.id ?? "") ||
        scoreMeta.sharedTags.length > 0 ||
        scoreMeta.sameCategory
          ? "full"
          : "compressed";
      const targetMode =
        focusSet.has(ordering.target.id ?? "") ||
        scoreMeta.sharedTags.length > 0 ||
        scoreMeta.sameCategory
          ? "full"
          : "compressed";

      scoredPairs.push({
        ...scoreMeta,
        source: ordering.source,
        sourceMode,
        target: ordering.target,
        targetMode,
      });
    }
  }

  scoredPairs.sort((left, right) => right.score - left.score);

  const maxPairs = focusSet.size > 0 ? 12 : Math.min(18, Math.max(8, fragments.length));
  const candidatePairs =
    scoredPairs.length > 0
      ? scoredPairs.slice(0, maxPairs)
      : [];

  const { batches, systemPrompt } = buildRelationPromptBatches(
    candidatePairs,
    analysisType,
    existingRelations,
    [...focusSet],
  );

  return {
    batches,
    candidatePairs,
    systemPrompt,
  };
}

function normalizeRelationAnalysisResponse(
  value: unknown,
  fragmentMap: Map<string, AIFragmentPayload>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 返回的关系 JSON 结构不正确。");
  }

  const response = value as RelationAnalysisResponse;
  if (!Array.isArray(response.relations)) {
    throw new Error('AI 返回缺少 "relations" 数组。');
  }

  return response.relations.flatMap((item) => {
    const sourceId = typeof item.source_fragment_id === "string" ? item.source_fragment_id.trim() : "";
    const targetId = typeof item.target_fragment_id === "string" ? item.target_fragment_id.trim() : "";
    const relationType =
      typeof item.relation_type === "string"
        ? (item.relation_type.trim() as RelationSuggestion["relation_type"])
        : null;
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    const confidenceRaw = typeof item.confidence === "number" ? item.confidence : Number(item.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : 0;

    if (
      !sourceId ||
      !targetId ||
      sourceId === targetId ||
      !relationType ||
      !RELATION_TYPES.includes(relationType) ||
      !reason ||
      !fragmentMap.has(sourceId) ||
      !fragmentMap.has(targetId)
    ) {
      return [];
    }

    let normalizedSourceId = sourceId;
    let normalizedTargetId = targetId;
    if (SYMMETRIC_RELATION_TYPES.has(relationType)) {
      [normalizedSourceId, normalizedTargetId] = [sourceId, targetId].sort();
    }

    return [
      {
        confidence: Number(confidence.toFixed(2)),
        reason,
        relation_type: relationType,
        source_fragment_id: normalizedSourceId,
        source_fragment_title:
          fragmentMap.get(normalizedSourceId)?.title || "Untitled Fragment",
        target_fragment_id: normalizedTargetId,
        target_fragment_title:
          fragmentMap.get(normalizedTargetId)?.title || "Untitled Fragment",
      } satisfies RelationSuggestion,
    ];
  });
}

export async function estimateAIRequest(input: AITaskEstimateInput) {
  return buildEstimate(input);
}

export async function estimateRelationAnalysisRequest(
  fragments: AIFragmentPayload[],
  analysisType: RelationAnalysisType = "build_relation_list",
  options: AnalyzeRelationsOptions = {},
) {
  const provider = await getAIProviderSettings();
  const existingRelations = await getRelationList();
  const plan = buildRelationAnalysisPlan(fragments, existingRelations, analysisType, options);

  if (plan.batches.length === 0) {
    return buildEstimateFromText(
      provider,
      `Relation analysis fallback\nFragments: ${fragments.length}\nAnalysis Type: ${analysisType}`,
    );
  }

  return combineEstimates(
    plan.batches.map((batch) => buildEstimateFromText(provider, batch.estimateText)),
    provider.model_name.trim() || "unconfigured-model",
  );
}

export async function analyzeFragment(fragment: AIFragmentPayload) {
  return analyzeFragmentWithContext(fragment, {
    existing_categories: [],
    existing_tags: [],
  });
}

export async function analyzeFragmentWithContext(
  fragment: AIFragmentPayload,
  taxonomy: AITaxonomyContext,
) {
  const provider = await getAIProviderSettings();
  ensureProviderConfigured(provider);

  const taxonomyText = [
    taxonomy.existing_categories.length > 0
      ? `Existing categories:\n- ${taxonomy.existing_categories.join("\n- ")}`
      : "Existing categories:\n- None",
    taxonomy.existing_tags.length > 0
      ? `Existing tags:\n- ${taxonomy.existing_tags.join("\n- ")}`
      : "Existing tags:\n- None",
  ].join("\n\n");
  const estimate = await buildEstimate({
    fragments: [fragment],
    extraText: taxonomyText,
  });
  const systemPrompt = [
    "You are a research assistant for Fragment Isles.",
    "Analyze the fragment and return strict JSON only.",
    "Do not wrap the JSON in markdown fences.",
    "JSON schema:",
    "{",
    '  "suggested_title": "string",',
    '  "summary": "string",',
    '  "suggested_category": "string",',
    '  "suggested_tags": ["string"],',
    '  "detected_time_info": ["string"],',
    '  "research_usage": "string"',
    "}",
    "Keep suggested_tags concise and practical for research workflows.",
    "When choosing category and tags, prefer the existing categories and tags if they fit.",
    "If the existing categories or tags are not suitable, you may suggest a new one.",
  ].join("\n");
  const userPrompt = [
    "Please analyze this fragment for a local research workspace.",
    "Return JSON only. Do not add any explanation before or after the JSON object.",
    "",
    taxonomyText,
    "",
    buildFragmentText(fragment),
  ].join("\n");

  const responseJson = await postAnalyzeFragmentRequest(
    provider,
    systemPrompt,
    userPrompt,
  );

  const content = getMessageContent(responseJson.choices);
  const result = parseAnalyzeFragmentResult(content);

  await logUsage("analyze_fragment", provider, estimate, responseJson.usage);

  return {
    result,
    estimate,
    usage: responseJson.usage,
  };
}


export async function estimateKeywordFragmentMatchingRequest(
  fragments: AIFragmentPayload[],
  options: KeywordMatchingOptions,
) {
  const filterText = [
    `Query: ${options.query.trim()}`,
    options.categoryNames?.length ? `Categories: ${options.categoryNames.join(", ")}` : "",
    options.tagNames?.length ? `Tags: ${options.tagNames.join(", ")}` : "",
    options.timeRangeLabel ? `Time Range: ${options.timeRangeLabel}` : "",
    `Max Fragments: ${options.maxFragments ?? 8}`,
  ]
    .filter(Boolean)
    .join("\n");

  return buildEstimate({
    fragments,
    extraText: filterText,
  });
}

export async function findMatchingFragmentsWithAI(
  fragments: AIFragmentPayload[],
  options: KeywordMatchingOptions,
) {
  if (!options.query.trim()) {
    throw new Error("Keyword / query is required.");
  }

  const provider = await getAIProviderSettings();
  ensureProviderConfigured(provider);

  const estimate = await estimateKeywordFragmentMatchingRequest(fragments, options);
  const fragmentMap = new Map(
    fragments
      .filter((fragment): fragment is AIFragmentPayload & { id: string } => Boolean(fragment.id))
      .map((fragment) => [fragment.id, fragment]),
  );

  const candidateText = fragments
    .map((fragment) => buildSummaryFragmentText(fragment))
    .join("\n\n---\n\n");

  const systemPrompt = [
    "You help users of Fragment Isles match fragments relevant to a research question.",
    "Return strict JSON only. Do not use markdown fences.",
    "JSON schema:",
    "{",
    '  "matches": [',
    "    {",
    '      "fragment_id": "string",',
    '      "reason": "string",',
    '      "confidence": 0.0',
    "    }",
    "  ]",
    "}",
    "Only select fragments that are clearly relevant to the user query.",
    "Keep reasons concise and specific.",
  ].join("\n");

  const userPrompt = [
    `Query: ${options.query.trim()}`,
    options.categoryNames?.length ? `Category Filter: ${options.categoryNames.join(", ")}` : "",
    options.tagNames?.length ? `Tag Filter: ${options.tagNames.join(", ")}` : "",
    options.timeRangeLabel ? `Time Range: ${options.timeRangeLabel}` : "",
    `Return at most ${options.maxFragments ?? 8} matches.`,
    "",
    "Candidate fragments:",
    candidateText,
  ]
    .filter(Boolean)
    .join("\n");

  const responseJson = await postStrictJsonRequest(provider, systemPrompt, userPrompt);
  const content = getMessageContent(responseJson.choices);
  const jsonText = extractJsonText(content);
  const matches = normalizeKeywordMatchingResponse(JSON.parse(jsonText), fragmentMap)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, options.maxFragments ?? 8);

  await logUsage("match_fragments_for_summary", provider, estimate, responseJson.usage);

  return {
    estimate,
    matches,
  };
}

export async function analyzeRelations(
  fragments: AIFragmentPayload[],
  analysisType: RelationAnalysisType = "build_relation_list",
  options: AnalyzeRelationsOptions = {},
) {
  const provider = await getAIProviderSettings();
  ensureProviderConfigured(provider);
  const existingRelations = await getRelationList();
  const plan = buildRelationAnalysisPlan(fragments, existingRelations, analysisType, options);
  const estimate =
    plan.batches.length > 0
      ? combineEstimates(
          plan.batches.map((batch) => buildEstimateFromText(provider, batch.estimateText)),
          provider.model_name.trim() || "unconfigured-model",
        )
      : buildEstimateFromText(
          provider,
          `Relation analysis fallback\nFragments: ${fragments.length}\nAnalysis Type: ${analysisType}`,
        );

  if (plan.batches.length === 0) {
    return {
      relations: [],
      estimate,
    };
  }

  const fragmentMap = new Map(
    fragments
      .filter((fragment): fragment is AIFragmentPayload & { id: string } => Boolean(fragment.id))
      .map((fragment) => [fragment.id, fragment]),
  );
  const existingPairSet = buildRelevantExistingRelationSet(existingRelations);
  const seenSuggestionKeys = new Set<string>();
  const suggestions: RelationSuggestion[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const batch of plan.batches) {
    const response = await postStrictJsonRequest(
      provider,
      plan.systemPrompt,
      batch.prompt,
    );
    const content = getMessageContent(response.choices);
    const jsonText = extractJsonText(content);
    const batchSuggestions = normalizeRelationAnalysisResponse(
      JSON.parse(jsonText),
      fragmentMap,
    );

    for (const suggestion of batchSuggestions) {
      const relationKey = buildRelationPairKey(
        suggestion.source_fragment_id,
        suggestion.target_fragment_id,
        suggestion.relation_type,
      );
      if (existingPairSet.has(relationKey) || seenSuggestionKeys.has(relationKey)) {
        continue;
      }

      suggestions.push(suggestion);
      seenSuggestionKeys.add(relationKey);
    }

    totalPromptTokens += response.usage?.prompt_tokens ?? 0;
    totalCompletionTokens += response.usage?.completion_tokens ?? 0;
  }

  if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
    await logTokenTotals(
      "analyze_relations",
      provider,
      totalPromptTokens || estimate.estimatedInputTokens,
      totalCompletionTokens || estimate.estimatedOutputTokens,
    );
  } else {
    await logEstimatedUsage("analyze_relations", estimate);
  }

  return {
    relations: suggestions,
    estimate,
  };
}

export async function estimateMarkdownSummaryRequest(
  fragments: AIFragmentPayload[],
  options: MarkdownSummaryOptions = {},
) {
  const customInstruction = options.customInstruction?.trim() ?? "";

  return buildEstimate({
    fragments,
    extraText: [
      "Output format: 总结 + Digest + 新Idea",
      customInstruction ? `Custom Instruction: ${customInstruction}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function generateMarkdownSummary(
  fragments: AIFragmentPayload[],
  options: MarkdownSummaryOptions = {},
) {
  if (fragments.length === 0) {
    throw new Error("At least one fragment is required to generate a summary.");
  }

  const provider = await getAIProviderSettings();
  ensureProviderConfigured(provider);
  const customInstruction = options.customInstruction?.trim() ?? "";

  const estimate = await estimateMarkdownSummaryRequest(fragments, options);

  const systemPrompt = [
    "You are a research synthesis assistant for Fragment Isles.",
    "Write the result in Markdown only. Do not wrap the output in code fences.",
    "Generate a structured summary with exactly three sections:",
    "",
    "## 总结",
    "A concise overview that synthesizes the key themes and conclusions from all source fragments.",
    "",
    "## Digest",
    "Bullet-point extraction of the most important facts, findings, arguments, and data points.",
    "",
    "## 新Idea",
    "Novel insights, connections, or research directions that emerge from reading these fragments together. These should be ideas not explicitly stated in any single fragment but inspired by their combination.",
    "",
    "The output should be readable, well-structured, and useful for a researcher continuing work later.",
    "Do not include a Source Fragments section; that will be appended separately.",
  ].join("\n");

  const userPrompt = [
    customInstruction ? `Additional instruction: ${customInstruction}` : "",
    "",
    "Use the following fragments as source material:",
    fragments.map((fragment) => buildSummaryFragmentText(fragment)).join("\n\n---\n\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const responseJson = await postChatCompletions(provider, {
    model: provider.model_name.trim(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.25,
  });
  const content = getMessageContent(responseJson.choices).trim();
  if (!content) {
    throw new Error("AI returned an empty markdown summary.");
  }

  await logUsage("generate_markdown_summary", provider, estimate, responseJson.usage);

  const markdown = `${content}\n\n${buildSourceFragmentsMarkdown(fragments)}`;

  return {
    markdown,
    estimate,
  };
}

