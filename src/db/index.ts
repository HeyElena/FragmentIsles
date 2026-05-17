import Dexie, { type Table } from "dexie";

export type ContentType = "text" | "image" | "markdown" | "code" | "link" | "mixed";
export type SourceType =
  | "manual"
  | "clipboard"
  | "image"
  | "markdown"
  | "generated_summary"
  | "webpage"
  | "zotero"
  | "local_file";
export type AIStatus =
  | "not_analyzed"
  | "analyzed"
  | "user_modified"
  | "needs_review";
export type CreatedBy = "ai" | "user" | "system";
export type RelationType =
  | "supports"
  | "contradicts"
  | "extends"
  | "same_topic"
  | "evidence_for"
  | "limitation_of"
  | "method_for"
  | "dataset_for"
  | "duplicate_or_similar";
export type ReminderStatus =
  | "active"
  | "timeline_only"
  | "completed"
  | "dismissed"
  | "expired";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export interface FragmentRecord {
  id: string;
  title: string;
  content: string;
  content_type: ContentType;
  source_type: SourceType;
  source_url: string | null;
  category_id: string | null;
  summary: string;
  created_at: string;
  updated_at: string;
  ai_status: AIStatus;
}

export interface CategoryRecord {
  id: string;
  name: string;
  description: string;
  rules: string;
  created_by: CreatedBy;
  updated_by: CreatedBy;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TagRecord {
  id: string;
  name: string;
  description: string;
  created_by: CreatedBy;
  is_user_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface FragmentTagRecord {
  id: string;
  fragment_id: string;
  tag_id: string;
}

export interface RelationRecord {
  id: string;
  source_fragment_id: string;
  target_fragment_id: string;
  relation_type: RelationType;
  reason: string;
  created_by: CreatedBy;
  confidence: number;
  created_at: string;
}

export interface ReminderRecord {
  id: string;
  fragment_id: string;
  title: string;
  event_time: string;
  remind_at: string[];
  status: ReminderStatus;
  source_text: string;
  created_at: string;
  updated_at: string;
}

export interface ApiUsageLogRecord {
  id: string;
  feature_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  created_at: string;
}

export interface SettingRecord {
  key: string;
  value: JsonValue;
  updated_at: string;
}

export interface DatabaseOverview {
  fragments: number;
  categories: number;
  tags: number;
  relations: number;
  reminders: number;
  api_usage_logs: number;
  settings: number;
}

export interface FragmentPreviewItem {
  id: string;
  title: string;
  summary: string;
}

export interface ReminderPreviewItem {
  id: string;
  title: string;
  event_time: string;
  status: ReminderStatus;
}

export type TimelineFilter = "all" | "upcoming" | "no_reminder" | "completed" | "expired";

export interface TimelineSummary {
  next7Days: number;
  next30Days: number;
  noReminder: number;
  completed: number;
  expired: number;
}

export interface TimelineItem {
  id: string;
  fragment_id: string;
  title: string;
  event_time: string;
  remind_at: string[];
  status: ReminderStatus;
  effective_status: ReminderStatus;
  source_text: string;
  source_fragment_title: string;
  created_at: string;
  updated_at: string;
}

export interface RelationPreviewItem {
  id: string;
  source_fragment_id: string;
  target_fragment_id: string;
  relation_type: RelationType;
}

export interface RelationListItem {
  id: string;
  source_fragment_id: string;
  source_fragment_title: string;
  target_fragment_id: string;
  target_fragment_title: string;
  relation_type: RelationType;
  reason: string;
  created_by: CreatedBy;
  confidence: number;
  created_at: string;
}

export interface SettingPreviewItem {
  key: string;
  value: JsonValue;
}

export interface AIProviderSettings {
  api_base_url: string;
  api_key: string;
  model_name: string;
  input_token_price: number;
  output_token_price: number;
}

export interface ApiUsageLogInput {
  feature_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
}

export interface ApiUsageFeatureSummary {
  feature_name: string;
  calls: number;
  total_tokens: number;
  estimated_cost: number;
}

export interface ApiUsagePanelData {
  today_calls: number;
  today_tokens: number;
  estimated_cost: number;
  usage_by_feature: ApiUsageFeatureSummary[];
}

export interface FragmentListItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  content_type: ContentType;
  category_id: string | null;
  category_name: string | null;
  tags: TagRecord[];
  created_at: string;
  updated_at: string;
  ai_status: AIStatus;
}

export interface FragmentDetailRecord extends FragmentListItem {
  source_type: SourceType;
  source_url: string | null;
}

export interface FragmentQueryOptions {
  search?: string;
  categoryId?: string;
  tagId?: string;
}

export interface FragmentInput {
  title: string;
  content: string;
  content_type: ContentType;
  category_id: string | null;
  summary: string;
  tag_names: string[];
  source_type?: SourceType;
  source_url?: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface TagOption {
  id: string;
  name: string;
}

export interface TagListItem {
  id: string;
  name: string;
  description: string;
  created_by: CreatedBy;
  fragment_count: number;
  is_user_locked: boolean;
}

export interface TagInput {
  name: string;
  description: string;
}

export interface CategoryListItem {
  id: string;
  name: string;
  description: string;
  rules: string;
  created_by: CreatedBy;
  fragment_count: number;
  is_active: boolean;
  is_system: boolean;
}

export interface CategoryInput {
  name: string;
  description: string;
  rules: string;
}

export interface DeleteCategoryOptions {
  mode: "uncategorized" | "move";
  targetCategoryId?: string;
}

export interface ReminderInput {
  fragment_id: string;
  title: string;
  event_time: string;
  remind_at: string[];
  status: ReminderStatus;
  source_text: string;
}

export interface ReminderUpdateInput {
  title: string;
  event_time: string;
  remind_at: string[];
  status: ReminderStatus;
}

export interface RelationInput {
  source_fragment_id: string;
  target_fragment_id: string;
  relation_type: RelationType;
  reason: string;
  confidence: number;
  created_by: CreatedBy;
}

export interface RelationUpdateInput {
  relation_type: RelationType;
  reason: string;
  confidence: number;
}

export interface RelatedFragmentRelationItem {
  id: string;
  source_fragment_id: string;
  source_fragment_title: string;
  target_fragment_id: string;
  target_fragment_title: string;
  related_fragment_id: string;
  related_fragment_title: string;
  related_fragment_summary: string;
  relation_type: RelationType;
  relation_direction: "outgoing" | "incoming";
  reason: string;
  created_by: CreatedBy;
  confidence: number;
  created_at: string;
}

export interface AIAnalyzeFragmentApplyInput {
  suggested_title: string;
  summary: string;
  suggested_category: string;
  suggested_tags: string[];
}

export class FragmentIslesDB extends Dexie {
  fragments!: Table<FragmentRecord, string>;
  categories!: Table<CategoryRecord, string>;
  tags!: Table<TagRecord, string>;
  fragment_tags!: Table<FragmentTagRecord, string>;
  relations!: Table<RelationRecord, string>;
  reminders!: Table<ReminderRecord, string>;
  api_usage_logs!: Table<ApiUsageLogRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("FragmentIslesDB");

    this.version(2).stores({
      fragments:
        "id, title, category_id, content_type, source_type, created_at, updated_at, ai_status",
      categories:
        "id, name, created_by, updated_by, is_active, created_at, updated_at",
      tags: "id, name, created_by, is_user_locked, created_at, updated_at",
      fragment_tags: "id, fragment_id, tag_id, [fragment_id+tag_id]",
      relations:
        "id, source_fragment_id, target_fragment_id, relation_type, created_by, confidence, created_at, [source_fragment_id+target_fragment_id]",
      reminders: "id, fragment_id, event_time, *remind_at, status, created_at, updated_at",
      api_usage_logs: "id, feature_name, model, created_at",
      settings: "key, updated_at",
    });
  }
}

export const db = new FragmentIslesDB();

const DEMO_SEEDED_SETTING_KEY = "meta.demo_seeded";
const AI_PROVIDER_SETTING_KEY = "ai.provider";
export const UNCATEGORIZED_CATEGORY_ID = "C-UNCATEGORIZED";

function nowIso() {
  return new Date().toISOString();
}

function isUncategorizedCategory(categoryId: string | null | undefined) {
  return categoryId === UNCATEGORIZED_CATEGORY_ID;
}

function buildId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random.toUpperCase()}`;
}

function isObjectValue(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSameLocalDay(left: string, rightDate: Date) {
  const leftDate = new Date(left);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function sanitizeTagNames(tagNames: string[]) {
  return [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];
}

async function getTagsForFragmentIds(fragmentIds: string[]) {
  if (fragmentIds.length === 0) {
    return new Map<string, TagRecord[]>();
  }

  const links = await db.fragment_tags.where("fragment_id").anyOf(fragmentIds).toArray();
  const tagIds = [...new Set(links.map((link) => link.tag_id))];
  const tags = await db.tags.where("id").anyOf(tagIds).toArray();
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const result = new Map<string, TagRecord[]>();

  for (const fragmentId of fragmentIds) {
    result.set(fragmentId, []);
  }

  for (const link of links) {
    const tag = tagMap.get(link.tag_id);
    if (!tag) {
      continue;
    }

    const current = result.get(link.fragment_id) ?? [];
    current.push(tag);
    result.set(link.fragment_id, current);
  }

  return result;
}

async function ensureTagsByNames(tagNames: string[], createdBy: CreatedBy = "user") {
  const normalizedNames = sanitizeTagNames(tagNames);

  if (normalizedNames.length === 0) {
    return [];
  }

  const existingTags = await db.tags.toArray();
  const existingMap = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]));
  const now = nowIso();
  const resolvedTags: TagRecord[] = [];
  const newTags: TagRecord[] = [];

  for (const name of normalizedNames) {
    const existing = existingMap.get(name.toLowerCase());
    if (existing) {
      resolvedTags.push(existing);
      continue;
    }

    const created: TagRecord = {
      id: buildId("T"),
      name,
      description: "",
      created_by: createdBy,
      is_user_locked: false,
      created_at: now,
      updated_at: now,
    };

    existingMap.set(name.toLowerCase(), created);
    resolvedTags.push(created);
    newTags.push(created);
  }

  if (newTags.length > 0) {
    await db.tags.bulkPut(newTags);
  }

  return resolvedTags;
}

async function ensureSingleTagByName(tagName: string) {
  const [tag] = await ensureTagsByNames([tagName]);
  if (!tag) {
    throw new Error("Tag creation failed");
  }
  return tag;
}

async function ensureCategoryByName(categoryName: string, createdBy: CreatedBy = "user") {
  const normalizedName = categoryName.trim();
  if (!normalizedName) {
    return UNCATEGORIZED_CATEGORY_ID;
  }

  await ensureUncategorizedCategory();
  const existingCategories = await db.categories.toArray();
  const existing = existingCategories.find(
    (category) => category.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existing) {
    return existing.id;
  }

  const now = nowIso();
  const category: CategoryRecord = {
    id: buildId("C"),
    name: normalizedName,
    description: "",
    rules: "",
    created_by: createdBy,
    updated_by: createdBy,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await db.categories.put(category);
  return category.id;
}

async function replaceFragmentTags(fragmentId: string, tagIds: string[]) {
  const currentLinks = await db.fragment_tags.where("fragment_id").equals(fragmentId).toArray();
  const nextTagIds = [...new Set(tagIds)];

  if (currentLinks.length > 0) {
    await db.fragment_tags.bulkDelete(currentLinks.map((link) => link.id));
  }

  if (nextTagIds.length === 0) {
    return;
  }

  const nextLinks: FragmentTagRecord[] = nextTagIds.map((tagId) => ({
    id: buildId("FT"),
    fragment_id: fragmentId,
    tag_id: tagId,
  }));

  await db.fragment_tags.bulkPut(nextLinks);
}

function buildFragmentMarkdown(
  fragment: FragmentDetailRecord,
  tagNames: string[],
) {
  const lines = [
    `# ${fragment.title || "Untitled Fragment"}`,
    "",
    `- ID: ${fragment.id}`,
    `- Content Type: ${fragment.content_type}`,
    `- Category: ${fragment.category_name ?? "Uncategorized"}`,
    `- Tags: ${tagNames.length > 0 ? tagNames.map((tag) => `#${tag}`).join(" ") : "None"}`,
    `- Created At: ${fragment.created_at}`,
    `- Updated At: ${fragment.updated_at}`,
    "",
    "## Summary",
    "",
    fragment.summary || "No summary.",
    "",
    "## Content",
    "",
    fragment.content || "No content.",
  ];

  if (fragment.source_url) {
    lines.push("", "## Source URL", "", fragment.source_url);
  }

  return lines.join("\n");
}

function getEffectiveReminderStatus(reminder: ReminderRecord, now = new Date()) {
  if (reminder.status === "completed" || reminder.status === "dismissed" || reminder.status === "expired") {
    return reminder.status;
  }

  const eventDate = new Date(reminder.event_time);
  if (eventDate.getTime() < now.getTime()) {
    return "expired" satisfies ReminderStatus;
  }

  return reminder.status;
}

export async function seedDemoData() {
  const seeded = await db.settings.get(DEMO_SEEDED_SETTING_KEY);

  if (seeded?.value === true) {
    return false;
  }

  const timestamp = nowIso();

  const categories: CategoryRecord[] = [
    {
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      description: "Default category for fragments that are not yet assigned to a user-managed category.",
      rules: "Use this category when a fragment has not been deliberately classified yet.",
      created_by: "system",
      updated_by: "system",
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "C-001",
      name: "Agent Memory Evaluation",
      description: "Fragments about memory benchmarks, memory reasoning, and evaluation gaps.",
      rules:
        "Use this category for fragments discussing memory benchmarks, reasoning evaluation, retrieval-vs-reasoning gaps, or evaluation design.",
      created_by: "ai",
      updated_by: "user",
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "C-002",
      name: "Deadlines / Events",
      description: "Time-sensitive research milestones, meetings, and submission deadlines.",
      rules: "Use this category when a fragment contains a deadline, meeting, or event note.",
      created_by: "user",
      updated_by: "user",
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "C-003",
      name: "Writing Materials",
      description: "Useful wording, framing, and paper-writing related fragments.",
      rules: "Use this category for writing snippets, argument framing, and paper drafting materials.",
      created_by: "user",
      updated_by: "user",
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  const tags: TagRecord[] = [
    {
      id: "T-001",
      name: "memory-benchmark",
      description: "Fragments related to memory benchmark design or analysis.",
      created_by: "ai",
      is_user_locked: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "T-002",
      name: "retrieval-vs-reasoning",
      description: "Fragments about whether a benchmark tests retrieval or reasoning.",
      created_by: "ai",
      is_user_locked: true,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: "T-003",
      name: "paper-writing",
      description: "Fragments useful for paper wording and framing.",
      created_by: "user",
      is_user_locked: false,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  const fragments: FragmentRecord[] = [
    {
      id: "F-000101",
      title: "LoCoMo evaluation note",
      content:
        "LoCoMo is useful for long-context memory evaluation, but many tasks still mostly reward retrieval fidelity rather than multi-step reasoning over memory.",
      content_type: "text",
      source_type: "manual",
      source_url: null,
      category_id: "C-001",
      summary:
        "A critique note arguing that long-context memory benchmarks still over-index on retrieval instead of reasoning.",
      created_at: timestamp,
      updated_at: timestamp,
      ai_status: "analyzed",
    },
    {
      id: "F-000102",
      title: "AAAI 2026 submission deadline",
      content:
        "AAAI 2026 abstract deadline draft note. Submission deadline: 2026-08-15 23:59. Need benchmark framing and intro draft ready one week earlier.",
      content_type: "markdown",
      source_type: "markdown",
      source_url: null,
      category_id: "C-002",
      summary:
        "A deadline fragment recording the AAAI 2026 submission time and internal prep milestones.",
      created_at: timestamp,
      updated_at: timestamp,
      ai_status: "analyzed",
    },
    {
      id: "F-000103",
      title: "Benchmark intro wording",
      content:
        "Existing evaluations primarily assess retrieval accuracy rather than reasoning capability. This line could be adapted for the motivation section of a memory benchmark paper.",
      content_type: "text",
      source_type: "clipboard",
      source_url: null,
      category_id: "C-003",
      summary:
        "A reusable sentence for framing why current memory evaluation is insufficient.",
      created_at: timestamp,
      updated_at: timestamp,
      ai_status: "user_modified",
    },
    {
      id: "F-000104",
      title: "Graph memory skepticism",
      content:
        "If graph memory improves benchmark scores, we need to separate gains from better retrieval structure versus actual reasoning gains. This is likely a relation candidate with the retrieval-vs-reasoning notes.",
      content_type: "text",
      source_type: "manual",
      source_url: null,
      category_id: "C-001",
      summary:
        "A research question about whether graph memory boosts reasoning or only retrieval organization.",
      created_at: timestamp,
      updated_at: timestamp,
      ai_status: "not_analyzed",
    },
  ];

  const fragmentTags: FragmentTagRecord[] = [
    { id: "FT-001", fragment_id: "F-000101", tag_id: "T-001" },
    { id: "FT-002", fragment_id: "F-000101", tag_id: "T-002" },
    { id: "FT-003", fragment_id: "F-000102", tag_id: "T-001" },
    { id: "FT-004", fragment_id: "F-000103", tag_id: "T-003" },
    { id: "FT-005", fragment_id: "F-000104", tag_id: "T-002" },
  ];

  const relations: RelationRecord[] = [
    {
      id: "R-001",
      source_fragment_id: "F-000101",
      target_fragment_id: "F-000104",
      relation_type: "supports",
      reason:
        "The LoCoMo note supports the graph-memory skepticism fragment by emphasizing that many benchmarks still measure retrieval more than reasoning.",
      created_by: "ai",
      confidence: 0.86,
      created_at: timestamp,
    },
  ];

  const reminders: ReminderRecord[] = [
    {
      id: "REM-001",
      fragment_id: "F-000102",
      title: "AAAI 2026 submission deadline",
      event_time: "2026-08-15T23:59:00.000Z",
      remind_at: ["2026-08-08T09:00:00.000Z", "2026-08-14T09:00:00.000Z"],
      status: "active",
      source_text: "Submission deadline: 2026-08-15 23:59",
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];

  const apiUsageLogs: ApiUsageLogRecord[] = [
    {
      id: "API-001",
      feature_name: "Fragment Analysis",
      model: "gpt-4.1-mini",
      input_tokens: 1840,
      output_tokens: 420,
      estimated_cost: 0.0124,
      created_at: "2026-01-12T09:30:00.000Z",
    },
    {
      id: "API-002",
      feature_name: "Relation Analysis",
      model: "gpt-4.1",
      input_tokens: 3920,
      output_tokens: 760,
      estimated_cost: 0.0416,
      created_at: "2026-01-19T14:10:00.000Z",
    },
  ];

  const settings: SettingRecord[] = [
    {
      key: "ai.usage_mode",
      value: "ask_before_every_ai_call",
      updated_at: timestamp,
    },
    {
      key: "ui.language",
      value: "zh-CN",
      updated_at: timestamp,
    },
    {
      key: DEMO_SEEDED_SETTING_KEY,
      value: true,
      updated_at: timestamp,
    },
  ];

  await db.transaction(
    "rw",
    [
      db.fragments,
      db.categories,
      db.tags,
      db.fragment_tags,
      db.relations,
      db.reminders,
      db.api_usage_logs,
      db.settings,
    ],
    async () => {
      await db.categories.bulkPut(categories);
      await db.tags.bulkPut(tags);
      await db.fragments.bulkPut(fragments);
      await db.fragment_tags.bulkPut(fragmentTags);
      await db.relations.bulkPut(relations);
      await db.reminders.bulkPut(reminders);
      await db.api_usage_logs.bulkPut(apiUsageLogs);
      await db.settings.bulkPut(settings);
    },
  );

  return true;
}

export async function initializeDatabase() {
  await db.open();
  await ensureUncategorizedCategory();
  await seedDemoData();
  await normalizeDemoApiUsageLogs();
  return db;
}

export async function ensureUncategorizedCategory() {
  const existing = await db.categories.get(UNCATEGORIZED_CATEGORY_ID);
  const timestamp = nowIso();

  if (!existing) {
    await db.categories.put({
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      description: "Default category for fragments that are not yet assigned to a user-managed category.",
      rules: "Use this category when a fragment has not been deliberately classified yet.",
      created_by: "system",
      updated_by: "system",
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  const uncategorizedFragments = await db.fragments
    .filter((fragment) => fragment.category_id === null)
    .toArray();
  if (uncategorizedFragments.length > 0) {
    await db.fragments.bulkPut(
      uncategorizedFragments.map((fragment) => ({
        ...fragment,
        category_id: UNCATEGORIZED_CATEGORY_ID,
        updated_at: fragment.updated_at || timestamp,
      })),
    );
  }
}

async function normalizeDemoApiUsageLogs() {
  const logs = await db.api_usage_logs.toArray();
  const demoDateMap = new Map<string, string>([
    ["API-001", "2026-01-12T09:30:00.000Z"],
    ["API-002", "2026-01-19T14:10:00.000Z"],
  ]);

  const needsUpdate = logs.filter((log) => demoDateMap.has(log.id));
  if (needsUpdate.length === 0) {
    return;
  }

  await db.api_usage_logs.bulkPut(
    needsUpdate.map((log) => ({
      ...log,
      created_at: demoDateMap.get(log.id) ?? log.created_at,
    })),
  );
}

export async function getDatabaseOverview(): Promise<DatabaseOverview> {
  const [
    fragments,
    categories,
    tags,
    relations,
    reminders,
    api_usage_logs,
    settings,
  ] = await Promise.all([
    db.fragments.count(),
    db.categories.count(),
    db.tags.count(),
    db.relations.count(),
    db.reminders.count(),
    db.api_usage_logs.count(),
    db.settings.count(),
  ]);

  return {
    fragments,
    categories,
    tags,
    relations,
    reminders,
    api_usage_logs,
    settings,
  };
}

export async function getLatestFragments(limit = 3): Promise<FragmentPreviewItem[]> {
  const items = await db.fragments.orderBy("updated_at").reverse().limit(limit).toArray();
  return items.map(({ id, title, summary }) => ({ id, title, summary }));
}

export async function getUpcomingReminders(limit = 3): Promise<ReminderPreviewItem[]> {
  const items = await db.reminders.orderBy("event_time").limit(limit).toArray();
  return items.map(({ id, title, event_time, status }) => ({
    id,
    title,
    event_time,
    status,
  }));
}

export async function getTimelineSummary(): Promise<TimelineSummary> {
  const reminders = await db.reminders.toArray();
  const now = new Date();
  const next7Boundary = new Date(now);
  next7Boundary.setDate(next7Boundary.getDate() + 7);
  const next30Boundary = new Date(now);
  next30Boundary.setDate(next30Boundary.getDate() + 30);

  let next7Days = 0;
  let next30Days = 0;
  let noReminder = 0;
  let completed = 0;
  let expired = 0;

  for (const reminder of reminders) {
    const effectiveStatus = getEffectiveReminderStatus(reminder, now);
    const eventDate = new Date(reminder.event_time);
    const isUpcoming =
      (effectiveStatus === "active" || effectiveStatus === "timeline_only") &&
      eventDate.getTime() >= now.getTime();

    if (isUpcoming && eventDate.getTime() <= next7Boundary.getTime()) {
      next7Days += 1;
    }

    if (isUpcoming && eventDate.getTime() <= next30Boundary.getTime()) {
      next30Days += 1;
    }

    if (
      reminder.remind_at.length === 0 &&
      (effectiveStatus === "active" || effectiveStatus === "timeline_only")
    ) {
      noReminder += 1;
    }

    if (effectiveStatus === "completed") {
      completed += 1;
    }

    if (effectiveStatus === "expired") {
      expired += 1;
    }
  }

  return {
    next7Days,
    next30Days,
    noReminder,
    completed,
    expired,
  };
}

export async function getTimelineItems(filter: TimelineFilter = "all"): Promise<TimelineItem[]> {
  const [reminders, fragments] = await Promise.all([
    db.reminders.orderBy("event_time").toArray(),
    db.fragments.toArray(),
  ]);
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const now = new Date();

  const items = reminders.map((reminder) => {
    const sourceFragment = fragmentMap.get(reminder.fragment_id);
    return {
      id: reminder.id,
      fragment_id: reminder.fragment_id,
      title: reminder.title,
      event_time: reminder.event_time,
      remind_at: reminder.remind_at,
      status: reminder.status,
      effective_status: getEffectiveReminderStatus(reminder, now),
      source_text: reminder.source_text,
      source_fragment_title: sourceFragment?.title || "Unknown Fragment",
      created_at: reminder.created_at,
      updated_at: reminder.updated_at,
    } satisfies TimelineItem;
  });

  const filtered = items.filter((item) => {
    if (filter === "all") {
      return true;
    }

    if (filter === "upcoming") {
      return (
        (item.effective_status === "active" || item.effective_status === "timeline_only") &&
        new Date(item.event_time).getTime() >= now.getTime()
      );
    }

    if (filter === "no_reminder") {
      return (
        item.remind_at.length === 0 &&
        (item.effective_status === "active" || item.effective_status === "timeline_only")
      );
    }

    if (filter === "completed") {
      return item.effective_status === "completed";
    }

    if (filter === "expired") {
      return item.effective_status === "expired";
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const timeA = new Date(a.event_time).getTime();
    const timeB = new Date(b.event_time).getTime();
    return timeA - timeB;
  });
}

export async function getLatestRelations(limit = 3): Promise<RelationPreviewItem[]> {
  const items = await db.relations.orderBy("created_at").reverse().limit(limit).toArray();
  return items.map(
    ({ id, source_fragment_id, target_fragment_id, relation_type }) => ({
      id,
      source_fragment_id,
      target_fragment_id,
      relation_type,
    }),
  );
}

export async function getRelationList(): Promise<RelationListItem[]> {
  const [relations, fragments] = await Promise.all([
    db.relations.orderBy("created_at").reverse().toArray(),
    db.fragments.toArray(),
  ]);
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.id, fragment]));

  return relations.map((relation) => ({
    id: relation.id,
    source_fragment_id: relation.source_fragment_id,
    source_fragment_title:
      fragmentMap.get(relation.source_fragment_id)?.title ?? "Unknown Fragment",
    target_fragment_id: relation.target_fragment_id,
    target_fragment_title:
      fragmentMap.get(relation.target_fragment_id)?.title ?? "Unknown Fragment",
    relation_type: relation.relation_type,
    reason: relation.reason,
    created_by: relation.created_by,
    confidence: relation.confidence,
    created_at: relation.created_at,
  }));
}

export async function getRelationsForFragment(
  fragmentId: string,
): Promise<RelatedFragmentRelationItem[]> {
  const [relations, fragments] = await Promise.all([
    db.relations
      .filter(
        (relation) =>
          relation.source_fragment_id === fragmentId || relation.target_fragment_id === fragmentId,
      )
      .reverse()
      .sortBy("created_at"),
    db.fragments.toArray(),
  ]);
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.id, fragment]));

  return relations
    .reverse()
    .map((relation) => {
      const isOutgoing = relation.source_fragment_id === fragmentId;
      const relatedFragmentId = isOutgoing ? relation.target_fragment_id : relation.source_fragment_id;
      const relatedFragment = fragmentMap.get(relatedFragmentId);

      return {
        id: relation.id,
        source_fragment_id: relation.source_fragment_id,
        source_fragment_title:
          fragmentMap.get(relation.source_fragment_id)?.title ?? "Unknown Fragment",
        target_fragment_id: relation.target_fragment_id,
        target_fragment_title:
          fragmentMap.get(relation.target_fragment_id)?.title ?? "Unknown Fragment",
        related_fragment_id: relatedFragmentId,
        related_fragment_title: relatedFragment?.title ?? "Unknown Fragment",
        related_fragment_summary: relatedFragment?.summary ?? "",
        relation_type: relation.relation_type,
        relation_direction: isOutgoing ? "outgoing" : "incoming",
        reason: relation.reason,
        created_by: relation.created_by,
        confidence: relation.confidence,
        created_at: relation.created_at,
      };
    });
}

export async function getSettingsPreview(limit = 3): Promise<SettingPreviewItem[]> {
  const items = await db.settings.orderBy("updated_at").reverse().limit(limit).toArray();
  return items.map(({ key, value }) => ({ key, value }));
}

export async function getAIProviderSettings(): Promise<AIProviderSettings> {
  const existing = await db.settings.get(AI_PROVIDER_SETTING_KEY);
  if (!existing || !isObjectValue(existing.value)) {
    return {
      api_base_url: "",
      api_key: "",
      model_name: "",
      input_token_price: 0,
      output_token_price: 0,
    };
  }

  const value = existing.value;
  return {
    api_base_url: typeof value.api_base_url === "string" ? value.api_base_url : "",
    api_key: typeof value.api_key === "string" ? value.api_key : "",
    model_name: typeof value.model_name === "string" ? value.model_name : "",
    input_token_price:
      typeof value.input_token_price === "number" ? value.input_token_price : 0,
    output_token_price:
      typeof value.output_token_price === "number" ? value.output_token_price : 0,
  };
}

export async function saveAIProviderSettings(input: AIProviderSettings) {
  await db.settings.put({
    key: AI_PROVIDER_SETTING_KEY,
    value: {
      api_base_url: input.api_base_url.trim(),
      api_key: input.api_key.trim(),
      model_name: input.model_name.trim(),
      input_token_price: Number.isFinite(input.input_token_price) ? input.input_token_price : 0,
      output_token_price: Number.isFinite(input.output_token_price) ? input.output_token_price : 0,
    },
    updated_at: nowIso(),
  });
}

export async function createApiUsageLog(input: ApiUsageLogInput) {
  await db.api_usage_logs.put({
    id: buildId("API"),
    feature_name: input.feature_name,
    model: input.model,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    estimated_cost: input.estimated_cost,
    created_at: nowIso(),
  });
}

export async function clearApiUsageLogs() {
  await db.api_usage_logs.clear();
}

export async function getApiUsagePanelData(): Promise<ApiUsagePanelData> {
  const logs = await db.api_usage_logs.toArray();
  const today = new Date();
  const todayLogs = logs.filter((log) => isSameLocalDay(log.created_at, today));
  const featureMap = new Map<string, ApiUsageFeatureSummary>();

  for (const log of todayLogs) {
    const existing = featureMap.get(log.feature_name) ?? {
      feature_name: log.feature_name,
      calls: 0,
      total_tokens: 0,
      estimated_cost: 0,
    };

    existing.calls += 1;
    existing.total_tokens += log.input_tokens + log.output_tokens;
    existing.estimated_cost += log.estimated_cost;
    featureMap.set(log.feature_name, existing);
  }

  return {
    today_calls: todayLogs.length,
    today_tokens: todayLogs.reduce((sum, log) => sum + log.input_tokens + log.output_tokens, 0),
    estimated_cost: todayLogs.reduce((sum, log) => sum + log.estimated_cost, 0),
    usage_by_feature: [...featureMap.values()].sort((a, b) => b.calls - a.calls),
  };
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const categories = await db.categories.orderBy("name").toArray();
  const normalized = categories
    .filter((category) => category.is_active)
    .map(({ id, name }) => ({ id, name }));

  return normalized.sort((a, b) => {
    if (a.id === UNCATEGORIZED_CATEGORY_ID) {
      return -1;
    }
    if (b.id === UNCATEGORIZED_CATEGORY_ID) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function getTagOptions(): Promise<TagOption[]> {
  const tags = await db.tags.orderBy("name").toArray();
  return tags.map(({ id, name }) => ({ id, name }));
}

export async function getTagList(): Promise<TagListItem[]> {
  const [tags, links] = await Promise.all([db.tags.orderBy("name").toArray(), db.fragment_tags.toArray()]);
  const countMap = new Map<string, number>();

  for (const link of links) {
    countMap.set(link.tag_id, (countMap.get(link.tag_id) ?? 0) + 1);
  }

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    description: tag.description,
    created_by: tag.created_by,
    fragment_count: countMap.get(tag.id) ?? 0,
    is_user_locked: tag.is_user_locked,
  }));
}

export async function createTag(input: TagInput) {
  const created = await ensureSingleTagByName(input.name.trim());

  if (input.description.trim() && created.description !== input.description.trim()) {
    await db.tags.put({
      ...created,
      description: input.description.trim(),
      updated_at: nowIso(),
    });
  }

  return created.id;
}

export async function ensureAITagIds(tagNames: string[]) {
  const tags = await ensureTagsByNames(tagNames, "ai");
  return tags.map((tag) => tag.id);
}

export async function updateTag(tagId: string, input: TagInput) {
  const existing = await db.tags.get(tagId);
  if (!existing) {
    throw new Error("Tag not found");
  }

  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Tag name is required");
  }

  const duplicate = await db.tags
    .filter((tag) => tag.id !== tagId && tag.name.toLowerCase() === normalizedName.toLowerCase())
    .first();

  if (duplicate) {
    throw new Error("A tag with the same name already exists");
  }

  await db.tags.put({
    ...existing,
    name: normalizedName,
    description: input.description.trim(),
    updated_at: nowIso(),
  });
}

export async function toggleTagLock(tagId: string, nextLocked: boolean) {
  const existing = await db.tags.get(tagId);
  if (!existing) {
    throw new Error("Tag not found");
  }

  await db.tags.put({
    ...existing,
    is_user_locked: nextLocked,
    updated_at: nowIso(),
  });
}

export async function deleteTag(tagId: string, forceLocked = false) {
  const existing = await db.tags.get(tagId);
  if (!existing) {
    throw new Error("Tag not found");
  }

  if (existing.is_user_locked && !forceLocked) {
    throw new Error("Locked tag requires explicit confirmation before deletion");
  }

  const links = await db.fragment_tags.where("tag_id").equals(tagId).toArray();

  await db.transaction("rw", [db.tags, db.fragment_tags], async () => {
    await db.tags.delete(tagId);
    if (links.length > 0) {
      await db.fragment_tags.bulkDelete(links.map((link) => link.id));
    }
  });
}

export async function mergeTags(sourceTagId: string, targetTagId: string, forceLocked = false) {
  if (sourceTagId === targetTagId) {
    throw new Error("Source and target tags must be different");
  }

  const [source, target] = await Promise.all([db.tags.get(sourceTagId), db.tags.get(targetTagId)]);
  if (!source || !target) {
    throw new Error("Tag not found");
  }

  if (source.is_user_locked && !forceLocked) {
    throw new Error("Locked tag requires explicit confirmation before merge");
  }

  const sourceLinks = await db.fragment_tags.where("tag_id").equals(sourceTagId).toArray();
  const targetLinks = await db.fragment_tags.where("tag_id").equals(targetTagId).toArray();
  const existingPairs = new Set(targetLinks.map((link) => `${link.fragment_id}:${link.tag_id}`));

  await db.transaction("rw", [db.tags, db.fragment_tags], async () => {
    for (const link of sourceLinks) {
      const pair = `${link.fragment_id}:${targetTagId}`;
      if (!existingPairs.has(pair)) {
        await db.fragment_tags.put({
          ...link,
          id: buildId("FT"),
          tag_id: targetTagId,
        });
        existingPairs.add(pair);
      }
    }

    if (sourceLinks.length > 0) {
      await db.fragment_tags.bulkDelete(sourceLinks.map((link) => link.id));
    }

    await db.tags.delete(sourceTagId);
  });
}

export async function getFragments(options: FragmentQueryOptions = {}): Promise<FragmentListItem[]> {
  const fragments = await db.fragments.orderBy("updated_at").reverse().toArray();
  const categoryMap = new Map((await db.categories.toArray()).map((category) => [category.id, category]));
  const tagMap = await getTagsForFragmentIds(fragments.map((fragment) => fragment.id));

  let items: FragmentListItem[] = fragments.map((fragment) => ({
    id: fragment.id,
    title: fragment.title,
    summary: fragment.summary,
    content: fragment.content,
    content_type: fragment.content_type,
    category_id: fragment.category_id,
    category_name: fragment.category_id ? (categoryMap.get(fragment.category_id)?.name ?? null) : "Uncategorized",
    tags: tagMap.get(fragment.id) ?? [],
    created_at: fragment.created_at,
    updated_at: fragment.updated_at,
    ai_status: fragment.ai_status,
  }));

  const search = options.search?.trim().toLowerCase();
  if (search) {
    items = items.filter((item) =>
      [item.title, item.summary, item.content, item.category_name ?? "", item.tags.map((tag) => tag.name).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }

  if (options.categoryId) {
    items = items.filter((item) => item.category_id === options.categoryId);
  }

  if (options.tagId) {
    items = items.filter((item) => item.tags.some((tag) => tag.id === options.tagId));
  }

  return items;
}

export async function getFragmentById(fragmentId: string): Promise<FragmentDetailRecord | null> {
  const fragment = await db.fragments.get(fragmentId);
  if (!fragment) {
    return null;
  }

  const category = fragment.category_id ? await db.categories.get(fragment.category_id) : null;
  const tags = await getTagsForFragmentIds([fragment.id]);

  return {
    id: fragment.id,
    title: fragment.title,
    summary: fragment.summary,
    content: fragment.content,
    content_type: fragment.content_type,
    category_id: fragment.category_id,
    category_name: category?.name ?? "Uncategorized",
    tags: tags.get(fragment.id) ?? [],
    created_at: fragment.created_at,
    updated_at: fragment.updated_at,
    ai_status: fragment.ai_status,
    source_type: fragment.source_type,
    source_url: fragment.source_url,
  };
}

export async function getFragmentsByIds(fragmentIds: string[]): Promise<FragmentListItem[]> {
  const uniqueIds = [...new Set(fragmentIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const allFragments = await getFragments();
  const itemMap = new Map(allFragments.map((fragment) => [fragment.id, fragment]));

  return uniqueIds
    .map((fragmentId) => itemMap.get(fragmentId))
    .filter((fragment): fragment is FragmentListItem => Boolean(fragment));
}

export async function createFragment(input: FragmentInput) {
  const now = nowIso();
  const id = buildId("F");
  const tags = await ensureTagsByNames(input.tag_names);
  const categoryId = input.category_id ?? UNCATEGORIZED_CATEGORY_ID;

  const fragment: FragmentRecord = {
    id,
    title: input.title.trim() || "Untitled Fragment",
    content: input.content.trim(),
    content_type: input.content_type,
    source_type: input.source_type ?? "manual",
    source_url: input.source_url ?? null,
    category_id: categoryId,
    summary: input.summary.trim(),
    created_at: now,
    updated_at: now,
    ai_status: "not_analyzed",
  };

  await db.transaction("rw", [db.fragments, db.fragment_tags], async () => {
    await db.fragments.put(fragment);
    await replaceFragmentTags(id, tags.map((tag) => tag.id));
  });

  return id;
}

export async function updateFragment(fragmentId: string, input: FragmentInput) {
  const existing = await db.fragments.get(fragmentId);
  if (!existing) {
    throw new Error("Fragment not found");
  }

  const tags = await ensureTagsByNames(input.tag_names);
  const categoryId = input.category_id ?? UNCATEGORIZED_CATEGORY_ID;
  const updated: FragmentRecord = {
    ...existing,
    title: input.title.trim() || "Untitled Fragment",
    content: input.content.trim(),
    content_type: input.content_type,
    category_id: categoryId,
    summary: input.summary.trim(),
    source_type: input.source_type ?? existing.source_type,
    source_url: input.source_url ?? existing.source_url,
    updated_at: nowIso(),
    ai_status: existing.ai_status === "analyzed" ? "user_modified" : existing.ai_status,
  };

  await db.transaction("rw", [db.fragments, db.fragment_tags], async () => {
    await db.fragments.put(updated);
    await replaceFragmentTags(fragmentId, tags.map((tag) => tag.id));
  });
}

export async function deleteFragment(fragmentId: string) {
  const [fragmentTagLinks, relations, reminders] = await Promise.all([
    db.fragment_tags.where("fragment_id").equals(fragmentId).toArray(),
    db.relations
      .filter(
        (relation) =>
          relation.source_fragment_id === fragmentId || relation.target_fragment_id === fragmentId,
      )
      .toArray(),
    db.reminders.where("fragment_id").equals(fragmentId).toArray(),
  ]);

  await db.transaction(
    "rw",
    [db.fragments, db.fragment_tags, db.relations, db.reminders],
    async () => {
      await db.fragments.delete(fragmentId);
      if (fragmentTagLinks.length > 0) {
        await db.fragment_tags.bulkDelete(fragmentTagLinks.map((link) => link.id));
      }
      if (relations.length > 0) {
        await db.relations.bulkDelete(relations.map((relation) => relation.id));
      }
      if (reminders.length > 0) {
        await db.reminders.bulkDelete(reminders.map((reminder) => reminder.id));
      }
    },
  );
}

export async function saveReminder(input: ReminderInput) {
  const now = nowIso();
  const existingReminders = await db.reminders.where("fragment_id").equals(input.fragment_id).sortBy("created_at");
  const existing = existingReminders[0];
  const duplicates = existingReminders.slice(1);

  const nextReminder: ReminderRecord = existing
    ? {
        ...existing,
        title: input.title.trim() || existing.title,
        event_time: input.event_time,
        remind_at: [...input.remind_at],
        status: input.status,
        source_text: input.source_text.trim(),
        updated_at: now,
      }
    : {
        id: buildId("REM"),
        fragment_id: input.fragment_id,
        title: input.title.trim() || "Detected reminder",
        event_time: input.event_time,
        remind_at: [...input.remind_at],
        status: input.status,
        source_text: input.source_text.trim(),
        created_at: now,
        updated_at: now,
      };

  await db.transaction("rw", db.reminders, async () => {
    await db.reminders.put(nextReminder);
    if (duplicates.length > 0) {
      await db.reminders.bulkDelete(duplicates.map((reminder) => reminder.id));
    }
  });

  return nextReminder.id;
}

export async function getReminderByFragmentId(fragmentId: string) {
  const reminders = await db.reminders.where("fragment_id").equals(fragmentId).sortBy("created_at");
  return reminders[0] ?? null;
}

export async function updateReminder(reminderId: string, input: ReminderUpdateInput) {
  const existing = await db.reminders.get(reminderId);
  if (!existing) {
    throw new Error("Reminder not found");
  }

  await db.reminders.put({
    ...existing,
    title: input.title.trim() || existing.title,
    event_time: input.event_time,
    remind_at: [...input.remind_at],
    status: input.status,
    updated_at: nowIso(),
  });
}

export async function updateReminderStatus(reminderId: string, status: ReminderStatus) {
  const existing = await db.reminders.get(reminderId);
  if (!existing) {
    throw new Error("Reminder not found");
  }

  await db.reminders.put({
    ...existing,
    status,
    updated_at: nowIso(),
  });
}

export async function deleteReminder(reminderId: string) {
  await db.reminders.delete(reminderId);
}

export async function saveRelations(inputs: RelationInput[]) {
  if (inputs.length === 0) {
    return [];
  }

  const now = nowIso();
  const symmetricRelationTypes = new Set<RelationType>([
    "contradicts",
    "duplicate_or_similar",
    "same_topic",
  ]);
  const buildRelationKey = (
    sourceFragmentId: string,
    targetFragmentId: string,
    relationType: RelationType,
  ) => {
    if (symmetricRelationTypes.has(relationType)) {
      const [left, right] = [sourceFragmentId, targetFragmentId].sort();
      return `${left}:${right}:${relationType}`;
    }

    return `${sourceFragmentId}:${targetFragmentId}:${relationType}`;
  };
  const existingRelations = await db.relations.toArray();
  const existingPairs = new Set(
    existingRelations.map(
      (relation) =>
        buildRelationKey(
          relation.source_fragment_id,
          relation.target_fragment_id,
          relation.relation_type,
        ),
    ),
  );

  const nextRelations: RelationRecord[] = [];

  for (const input of inputs) {
    const normalizedSourceId = symmetricRelationTypes.has(input.relation_type)
      ? [input.source_fragment_id, input.target_fragment_id].sort()[0]
      : input.source_fragment_id;
    const normalizedTargetId = symmetricRelationTypes.has(input.relation_type)
      ? [input.source_fragment_id, input.target_fragment_id].sort()[1]
      : input.target_fragment_id;
    const pairKey = buildRelationKey(
      normalizedSourceId,
      normalizedTargetId,
      input.relation_type,
    );
    if (existingPairs.has(pairKey)) {
      continue;
    }

    nextRelations.push({
      id: buildId("R"),
      source_fragment_id: normalizedSourceId,
      target_fragment_id: normalizedTargetId,
      relation_type: input.relation_type,
      reason: input.reason.trim(),
      created_by: input.created_by,
      confidence: input.confidence,
      created_at: now,
    });
    existingPairs.add(pairKey);
  }

  if (nextRelations.length > 0) {
    await db.relations.bulkPut(nextRelations);
  }

  return nextRelations.map((relation) => relation.id);
}

export async function updateRelation(relationId: string, input: RelationUpdateInput) {
  const existing = await db.relations.get(relationId);
  if (!existing) {
    throw new Error("Relation not found");
  }

  const symmetricRelationTypes = new Set<RelationType>([
    "contradicts",
    "duplicate_or_similar",
    "same_topic",
  ]);
  const normalizedSourceId = symmetricRelationTypes.has(input.relation_type)
    ? [existing.source_fragment_id, existing.target_fragment_id].sort()[0]
    : existing.source_fragment_id;
  const normalizedTargetId = symmetricRelationTypes.has(input.relation_type)
    ? [existing.source_fragment_id, existing.target_fragment_id].sort()[1]
    : existing.target_fragment_id;
  const duplicate = await db.relations
    .filter((relation) => {
      if (relation.id === relationId) {
        return false;
      }

      const relationSourceId = symmetricRelationTypes.has(relation.relation_type)
        ? [relation.source_fragment_id, relation.target_fragment_id].sort()[0]
        : relation.source_fragment_id;
      const relationTargetId = symmetricRelationTypes.has(relation.relation_type)
        ? [relation.source_fragment_id, relation.target_fragment_id].sort()[1]
        : relation.target_fragment_id;

      return (
        relationSourceId === normalizedSourceId &&
        relationTargetId === normalizedTargetId &&
        relation.relation_type === input.relation_type
      );
    })
    .first();

  if (duplicate) {
    throw new Error("A relation with the same pair and relation type already exists");
  }

  await db.relations.put({
    ...existing,
    source_fragment_id: normalizedSourceId,
    target_fragment_id: normalizedTargetId,
    relation_type: input.relation_type,
    reason: input.reason.trim(),
    confidence: Math.max(0, Math.min(1, input.confidence)),
  });
}

export async function deleteRelation(relationId: string) {
  await db.relations.delete(relationId);
}

export async function exportFragmentMarkdown(fragmentId: string) {
  const fragment = await getFragmentById(fragmentId);
  if (!fragment) {
    throw new Error("Fragment not found");
  }

  const markdown = buildFragmentMarkdown(
    fragment,
    fragment.tags.map((tag) => tag.name),
  );

  return {
    filename: `${fragment.title.trim().replace(/[^\w\-]+/g, "-") || fragment.id}.md`,
    markdown,
  };
}

export async function getCategoryList(): Promise<CategoryListItem[]> {
  await ensureUncategorizedCategory();
  const [categories, fragments] = await Promise.all([
    db.categories.toArray(),
    db.fragments.toArray(),
  ]);

  const countMap = new Map<string, number>();
  for (const fragment of fragments) {
    const categoryId = fragment.category_id ?? UNCATEGORIZED_CATEGORY_ID;
    countMap.set(categoryId, (countMap.get(categoryId) ?? 0) + 1);
  }

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      rules: category.rules,
      created_by: category.created_by,
      fragment_count: countMap.get(category.id) ?? 0,
      is_active: category.is_active,
      is_system: isUncategorizedCategory(category.id),
    }))
    .sort((a, b) => {
      if (a.id === UNCATEGORIZED_CATEGORY_ID) {
        return -1;
      }
      if (b.id === UNCATEGORIZED_CATEGORY_ID) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
}

export async function createCategory(input: CategoryInput) {
  const now = nowIso();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Category name is required");
  }

  const category: CategoryRecord = {
    id: buildId("C"),
    name: normalizedName,
    description: input.description.trim(),
    rules: input.rules.trim(),
    created_by: "user",
    updated_by: "user",
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await db.categories.put(category);
  return category.id;
}

export async function ensureAICategoryId(categoryName: string) {
  return ensureCategoryByName(categoryName, "ai");
}

export async function applyAIAnalysisToFragment(
  fragmentId: string,
  input: AIAnalyzeFragmentApplyInput,
) {
  const existing = await db.fragments.get(fragmentId);
  if (!existing) {
    throw new Error("Fragment not found");
  }

  const categoryId = await ensureCategoryByName(input.suggested_category, "ai");
  const tagIds = await ensureAITagIds(input.suggested_tags);
  const updated: FragmentRecord = {
    ...existing,
    title: input.suggested_title.trim() || existing.title,
    summary: input.summary.trim() || existing.summary,
    category_id: categoryId,
    updated_at: nowIso(),
    ai_status: "analyzed",
  };

  await db.transaction("rw", [db.fragments, db.fragment_tags], async () => {
    await db.fragments.put(updated);
    await replaceFragmentTags(fragmentId, tagIds);
  });

  return updated.id;
}

export async function updateCategory(categoryId: string, input: CategoryInput) {
  const existing = await db.categories.get(categoryId);
  if (!existing) {
    throw new Error("Category not found");
  }

  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Category name is required");
  }

  await db.categories.put({
    ...existing,
    name: normalizedName,
    description: input.description.trim(),
    rules: input.rules.trim(),
    updated_by: "user",
    updated_at: nowIso(),
  });
}

export async function deleteCategory(categoryId: string, options: DeleteCategoryOptions) {
  if (isUncategorizedCategory(categoryId)) {
    throw new Error("Uncategorized category cannot be deleted");
  }

  const category = await db.categories.get(categoryId);
  if (!category) {
    throw new Error("Category not found");
  }

  const targetCategoryId =
    options.mode === "uncategorized"
      ? UNCATEGORIZED_CATEGORY_ID
      : options.targetCategoryId ?? null;

  if (!targetCategoryId || targetCategoryId === categoryId) {
    throw new Error("A valid target category is required");
  }

  const fragmentsToMove = await db.fragments.where("category_id").equals(categoryId).toArray();
  const now = nowIso();

  await db.transaction("rw", [db.categories, db.fragments], async () => {
    if (fragmentsToMove.length > 0) {
      await db.fragments.bulkPut(
        fragmentsToMove.map((fragment) => ({
          ...fragment,
          category_id: targetCategoryId,
          updated_at: now,
        })),
      );
    }

    await db.categories.delete(categoryId);
  });
}

export async function mergeCategories(sourceCategoryId: string, targetCategoryId: string) {
  if (sourceCategoryId === targetCategoryId) {
    throw new Error("Source and target categories must be different");
  }

  if (isUncategorizedCategory(sourceCategoryId)) {
    throw new Error("Uncategorized category cannot be merged into another category");
  }

  const [source, target, fragmentsToMove] = await Promise.all([
    db.categories.get(sourceCategoryId),
    db.categories.get(targetCategoryId),
    db.fragments.where("category_id").equals(sourceCategoryId).toArray(),
  ]);

  if (!source || !target) {
    throw new Error("Category not found");
  }

  const now = nowIso();

  await db.transaction("rw", [db.categories, db.fragments], async () => {
    if (fragmentsToMove.length > 0) {
      await db.fragments.bulkPut(
        fragmentsToMove.map((fragment) => ({
          ...fragment,
          category_id: targetCategoryId,
          updated_at: now,
        })),
      );
    }

    await db.categories.delete(sourceCategoryId);
  });
}
