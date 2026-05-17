import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  BrainCircuit,
  Check,
  CheckCheck,
  CheckSquare,
  Code2,
  FileImage,
  FileText,
  Link2,
  PencilLine,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  X,
  Square,
  type LucideIcon,
} from "lucide-react";
import { AIConfirmationModal } from "@/components/ai/ai-confirmation-modal";
import {
  AnalyzeFragmentReviewModal,
  type AnalyzeFragmentReviewDraft,
} from "@/components/ai/analyze-fragment-review-modal";
import type { RelationAnalysisSeed } from "@/components/relations/relations-page";
import { SummaryWorkflowModal } from "@/components/summary/summary-workflow-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyAIAnalysisToFragment,
  createFragment,
  createCategory,
  deleteFragment,
  exportFragmentMarkdown,
  getRelationsForFragment,
  getReminderByFragmentId,
  getCategoryOptions,
  getFragmentById,
  getFragments,
  getTagOptions,
  saveReminder,
  saveRelations,
  deleteRelation,
  type CategoryOption,
  type ContentType,
  type FragmentDetailRecord,
  type FragmentInput,
  type FragmentListItem,
  type RelatedFragmentRelationItem,
  type RelationInput,
  type RelationType,
  type TagOption,
  updateFragment,
} from "@/db";
import {
  analyzeRelations,
  analyzeFragmentWithContext,
  estimateAIRequest,
  estimateRelationAnalysisRequest,
  type AnalyzeFragmentResult,
  type AIEstimate,
  type AIFragmentPayload,
  type RelationSuggestion,
} from "@/services/aiService";
import { detectTimeInformation } from "@/services/timeParser";

type FragmentsPageProps = {
  dbError: string | null;
  onOpenRelationAnalysis: (seed: RelationAnalysisSeed) => void;
  onRequestedFragmentHandled?: () => void;
  requestedFragmentId?: string | null;
};

type FragmentDraft = {
  title: string;
  content: string;
  content_type: ContentType;
  category_id: string;
  summary: string;
  tag_names: string[];
  tag_input: string;
};

type PendingTimeDetection = {
  fragmentId: string;
  detectedDateLabel: string;
  eventTime: string;
  possibleEventTitle: string;
  sourceText: string;
};

type ReminderFormDraft = {
  sameDay: boolean;
  oneWeekBefore: boolean;
  threeDaysBefore: boolean;
  oneDayBefore: boolean;
  customDays: string;
};

type PendingAIAction = {
  estimate: AIEstimate;
  fragmentCount: number;
  runningStatusText?: string | null;
  startAction: () => Promise<void>;
  taskName: string;
};

type PendingAnalyzeReview = {
  draft: AnalyzeFragmentReviewDraft;
  fragmentId: string;
};

type ReviewRelationSuggestion = RelationSuggestion & {
  editable: boolean;
  review_status: "pending" | "accepted" | "rejected";
  temp_id: string;
};

type PendingRelationReview = {
  fragmentTitle: string;
  suggestions: ReviewRelationSuggestion[];
};


type SummaryOpenContext = {
  preferredMode?: "all" | "filters" | "related" | "keyword";
  presetCategoryIds?: string[];
  presetSourceFragmentId?: string | null;
  presetTagIds?: string[];
};

const initialDraft: FragmentDraft = {
  title: "",
  content: "",
  content_type: "text",
  category_id: "",
  summary: "",
  tag_names: [],
  tag_input: "",
};

const initialReminderForm: ReminderFormDraft = {
  sameDay: true,
  oneWeekBefore: false,
  threeDaysBefore: false,
  oneDayBefore: false,
  customDays: "",
};

const contentTypeMeta: Record<
  ContentType,
  {
    icon: LucideIcon;
    label: string;
  }
> = {
  text: { icon: FileText, label: "Text" },
  markdown: { icon: FileText, label: "Markdown" },
  code: { icon: Code2, label: "Code" },
  image: { icon: FileImage, label: "Image" },
  link: { icon: Link2, label: "Link" },
  mixed: { icon: Boxes, label: "Mixed" },
};

const relationTypeOptions: RelationType[] = [
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildInputFromDraft(draft: FragmentDraft): FragmentInput {
  const trimmedContent = draft.content.trim();
  const pendingTag = normalizeTagName(draft.tag_input);
  const tagNames = pendingTag
    ? [...new Set([...draft.tag_names, pendingTag])]
    : draft.tag_names;

  return {
    title: draft.title.trim(),
    content: trimmedContent,
    content_type: draft.content_type,
    category_id: draft.category_id || null,
    summary: draft.summary.trim() || trimmedContent.slice(0, 160),
    tag_names: tagNames,
  };
}

function toDraft(fragment: FragmentDetailRecord): FragmentDraft {
  return {
    title: fragment.title,
    content: fragment.content,
    content_type: fragment.content_type,
    category_id: fragment.category_id ?? "",
    summary: fragment.summary,
    tag_names: fragment.tags.map((tag) => tag.name),
    tag_input: "",
  };
}

function normalizeTagName(tagName: string) {
  return tagName.trim();
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function subtractDaysFromIso(baseIso: string, days: number) {
  const date = new Date(baseIso);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function buildReminderTimes(eventTime: string, draft: ReminderFormDraft) {
  const values = new Set<string>();

  if (draft.sameDay) {
    values.add(eventTime);
  }

  if (draft.oneWeekBefore) {
    values.add(subtractDaysFromIso(eventTime, 7));
  }

  if (draft.threeDaysBefore) {
    values.add(subtractDaysFromIso(eventTime, 3));
  }

  if (draft.oneDayBefore) {
    values.add(subtractDaysFromIso(eventTime, 1));
  }

  const customDays = Number(draft.customDays);
  if (draft.customDays.trim() && Number.isFinite(customDays) && customDays >= 0) {
    values.add(subtractDaysFromIso(eventTime, customDays));
  }

  return [...values].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function toAIFragmentPayload(
  draft: FragmentDraft,
  current?: { id?: string; categoryName?: string | null },
): AIFragmentPayload {
  return {
    id: current?.id,
    title: draft.title.trim(),
    content: draft.content.trim(),
    summary: draft.summary.trim(),
    category_name: current?.categoryName ?? null,
    tags: draft.tag_names,
  };
}

function toReviewDraft(result: AnalyzeFragmentResult): AnalyzeFragmentReviewDraft {
  return {
    suggested_title: result.suggested_title,
    summary: result.summary,
    suggested_category: result.suggested_category,
    suggested_tags_text: result.suggested_tags.join(", "),
    detected_time_info_text: result.detected_time_info.join("\n"),
    research_usage: result.research_usage,
  };
}

function parseTagText(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildRelationDirectionLabel(direction: "incoming" | "outgoing") {
  return direction === "outgoing"
    ? "Current fragment → Related fragment"
    : "Related fragment → Current fragment";
}

function combineEstimates(estimates: AIEstimate[]): AIEstimate {
  return estimates.reduce<AIEstimate>(
    (combined, current) => ({
      modelName: combined.modelName || current.modelName,
      estimatedCost: combined.estimatedCost + current.estimatedCost,
      estimatedInputLength: combined.estimatedInputLength + current.estimatedInputLength,
      estimatedInputTokens: combined.estimatedInputTokens + current.estimatedInputTokens,
      estimatedOutputTokens: combined.estimatedOutputTokens + current.estimatedOutputTokens,
      estimatedTokenUsage: combined.estimatedTokenUsage + current.estimatedTokenUsage,
    }),
    {
      estimatedCost: 0,
      estimatedInputLength: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTokenUsage: 0,
      modelName: estimates[0]?.modelName ?? "unconfigured-model",
    },
  );
}

function buildTaxonomyEstimateText(categories: CategoryOption[], tags: TagOption[]) {
  const categoryText =
    categories.length > 0
      ? `Existing categories:\n- ${categories.map((category) => category.name).join("\n- ")}`
      : "Existing categories:\n- None";
  const tagText =
    tags.length > 0
      ? `Existing tags:\n- ${tags.map((tag) => tag.name).join("\n- ")}`
      : "Existing tags:\n- None";

  return `${categoryText}\n\n${tagText}`;
}

export function FragmentsPage({
  dbError,
  onOpenRelationAnalysis,
  onRequestedFragmentHandled,
  requestedFragmentId = null,
}: FragmentsPageProps) {
  const [fragments, setFragments] = useState<FragmentListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selectedFragmentIds, setSelectedFragmentIds] = useState<string[]>([]);
  const [selectedFragmentId, setSelectedFragmentId] = useState<string | null>(null);
  const [selectedFragment, setSelectedFragment] = useState<FragmentDetailRecord | null>(null);
  const [relatedRelations, setRelatedRelations] = useState<RelatedFragmentRelationItem[]>([]);
  const [detailDraft, setDetailDraft] = useState<FragmentDraft>(initialDraft);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<FragmentDraft>(initialDraft);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryDialogTarget, setCategoryDialogTarget] = useState<"create" | "detail">("create");
  const [categoryDraft, setCategoryDraft] = useState({
    name: "",
    description: "",
    rules: "",
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingTimeDetection, setPendingTimeDetection] = useState<PendingTimeDetection | null>(null);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState<ReminderFormDraft>(initialReminderForm);
  const [pendingAIAction, setPendingAIAction] = useState<PendingAIAction | null>(null);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [pendingAnalyzeReview, setPendingAnalyzeReview] = useState<PendingAnalyzeReview | null>(null);
  const [queuedRelationReview, setQueuedRelationReview] = useState<PendingRelationReview | null>(null);
  const [pendingRelationReview, setPendingRelationReview] = useState<PendingRelationReview | null>(null);
  const [isReviewEditing, setIsReviewEditing] = useState(false);
  const [aiActionError, setAIActionError] = useState<string | null>(null);
  const [summaryContext, setSummaryContext] = useState<SummaryOpenContext | null>(null);

  const totalCount = fragments.length;

  async function loadFragmentsData(currentSelectedId = selectedFragmentId) {
    setLoading(true);
    setError(null);

    try {
      const [nextFragments, nextCategories, nextTags] = await Promise.all([
        getFragments({
          search,
          categoryId: categoryFilter || undefined,
          tagId: tagFilter || undefined,
        }),
        getCategoryOptions(),
        getTagOptions(),
      ]);

      setFragments(nextFragments);
      setCategories(nextCategories);
      setTags(nextTags);

      if (currentSelectedId) {
        const [detail, relations] = await Promise.all([
          getFragmentById(currentSelectedId),
          getRelationsForFragment(currentSelectedId),
        ]);
        setSelectedFragment(detail);
        setDetailDraft(detail ? toDraft(detail) : initialDraft);
        setRelatedRelations(relations);
      } else {
        setSelectedFragment(null);
        setDetailDraft(initialDraft);
        setRelatedRelations([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Fragments 读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFragmentsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, tagFilter]);

  useEffect(() => {
    if (!requestedFragmentId) {
      return;
    }

    setIsCreateOpen(false);
    setSelectedFragmentId(requestedFragmentId);
    setError(null);

    void loadFragmentsData(requestedFragmentId).finally(() => {
      onRequestedFragmentHandled?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRequestedFragmentHandled, requestedFragmentId]);

  async function refreshCategoriesOnly() {
    const nextCategories = await getCategoryOptions();
    setCategories(nextCategories);
  }

  function closeTimeDialogs() {
    setPendingTimeDetection(null);
    setIsReminderSettingsOpen(false);
    setReminderForm(initialReminderForm);
  }

  async function maybePromptTimeDetection(fragmentId: string, input: FragmentInput) {
    const detection = detectTimeInformation({
      title: input.title,
      content: input.content,
    });

    if (!detection) {
      return;
    }

    const existingReminder = await getReminderByFragmentId(fragmentId);

    if (
      existingReminder &&
      existingReminder.event_time === detection.eventTime &&
      existingReminder.source_text === detection.sourceText.trim() &&
      existingReminder.title === detection.possibleEventTitle &&
      ((existingReminder.status === "active" && existingReminder.remind_at.length > 0) ||
        (existingReminder.status === "timeline_only" && existingReminder.remind_at.length === 0))
    ) {
      return;
    }

    setReminderForm(initialReminderForm);
    setIsReminderSettingsOpen(false);
    setPendingTimeDetection({
      fragmentId,
      detectedDateLabel: detection.detectedDateLabel,
      eventTime: detection.eventTime,
      possibleEventTitle: detection.possibleEventTitle,
      sourceText: detection.sourceText,
    });
  }

  async function openFragment(fragmentId: string) {
    setIsCreateOpen(false);
    setSelectedFragmentId(fragmentId);
    setError(null);

    try {
      const [detail, relations] = await Promise.all([
        getFragmentById(fragmentId),
        getRelationsForFragment(fragmentId),
      ]);
      setSelectedFragment(detail);
      setDetailDraft(detail ? toDraft(detail) : initialDraft);
      setRelatedRelations(relations);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Fragment 打开失败");
    }
  }

  function openCreatePanel() {
    setSelectedFragmentId(null);
    setSelectedFragment(null);
    setDetailDraft(initialDraft);
    setCreateDraft(initialDraft);
    setIsCreateOpen(true);
  }

  function closeEditorPanel() {
    setIsCreateOpen(false);
    setSelectedFragmentId(null);
    setSelectedFragment(null);
    setRelatedRelations([]);
    setDetailDraft(initialDraft);
  }

  function toggleFragmentSelection(fragmentId: string) {
    setSelectedFragmentIds((current) =>
      current.includes(fragmentId)
        ? current.filter((id) => id !== fragmentId)
        : [...current, fragmentId],
    );
  }

  function openRelationAnalysisForSelection() {
    if (selectedFragmentIds.length === 0) {
      return;
    }

    onOpenRelationAnalysis({
      selectedFragmentIds,
    });
  }

  function addDraftTag(target: "create" | "detail") {
    if (target === "create") {
      const nextTag = normalizeTagName(createDraft.tag_input);
      if (!nextTag) {
        return;
      }

      setCreateDraft((current) => ({
        ...current,
        tag_input: "",
        tag_names: current.tag_names.includes(nextTag)
          ? current.tag_names
          : [...current.tag_names, nextTag],
      }));
      return;
    }

    const nextTag = normalizeTagName(detailDraft.tag_input);
    if (!nextTag) {
      return;
    }

    setDetailDraft((current) => ({
      ...current,
      tag_input: "",
      tag_names: current.tag_names.includes(nextTag)
        ? current.tag_names
        : [...current.tag_names, nextTag],
    }));
  }

  function removeDraftTag(target: "create" | "detail", tagName: string) {
    if (target === "create") {
      setCreateDraft((current) => ({
        ...current,
        tag_names: current.tag_names.filter((tag) => tag !== tagName),
      }));
      return;
    }

    setDetailDraft((current) => ({
      ...current,
      tag_names: current.tag_names.filter((tag) => tag !== tagName),
    }));
  }

  function openCategoryDialog(target: "create" | "detail") {
    setCategoryDialogTarget(target);
    setCategoryDraft({
      name: "",
      description: "",
      rules: "",
    });
    setIsCategoryDialogOpen(true);
  }

  async function handleCreateCategoryInline() {
    setBusyAction("create-category");
    setError(null);

    try {
      const categoryId = await createCategory(categoryDraft);
      await refreshCategoriesOnly();
      setIsCategoryDialogOpen(false);

      if (categoryDialogTarget === "create") {
        setCreateDraft((current) => ({ ...current, category_id: categoryId }));
      } else {
        setDetailDraft((current) => ({ ...current, category_id: categoryId }));
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新建分类失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreate(saveMode: "save" | "save_and_ai") {
    const input = buildInputFromDraft(createDraft);
    if (!input.content) {
      setError("新建 fragment 至少需要 content。");
      return;
    }

    if (saveMode === "save_and_ai") {
      try {
        const fragmentPayload = {
          ...toAIFragmentPayload(createDraft),
          id: "__new_fragment__",
        };
        const allExistingFragments = await getFragments();
        const taxonomyText = buildTaxonomyEstimateText(categories, tags);
        const [fragmentEstimate, relationEstimate] = await Promise.all([
          estimateAIRequest({
            fragments: [fragmentPayload],
            extraText: taxonomyText,
          }),
          estimateRelationAnalysisRequest(
            [
              fragmentPayload,
              ...allExistingFragments.map((fragment) => ({
                id: fragment.id,
                title: fragment.title,
                content: fragment.content,
                summary: fragment.summary,
                category_name: fragment.category_name,
                tags: fragment.tags.map((tag) => tag.name),
              })),
            ],
            "build_relation_list",
            {
              focusFragmentIds: [fragmentPayload.id],
            },
          ),
        ]);
        let createdFragmentId: string | null = null;
        await openAIConfirmation({
          estimateOverride: combineEstimates([fragmentEstimate, relationEstimate]),
          fragmentCountOverride: allExistingFragments.length + 1,
          fragments: [fragmentPayload],
          runningStatusText: "会先分析这条新 fragment 的内容，再遍历其余 fragments 生成关系建议。",
          taskName: "Analyze Fragment & Find Related Fragments",
          onStart: async () => {
            setBusyAction("create");
            setQueuedRelationReview(null);
            if (!createdFragmentId) {
              createdFragmentId = await createFragment(input);
              setCreateDraft(initialDraft);
              setIsCreateOpen(false);
              setSelectedFragmentId(createdFragmentId);
              await loadFragmentsData(createdFragmentId);
              await maybePromptTimeDetection(createdFragmentId, input);
            }

            setPendingAIAction((current) =>
              current ? { ...current, runningStatusText: "正在分析 fragment 内容…" } : current,
            );
            const analysis = await analyzeFragmentWithContext(
            {
              ...fragmentPayload,
              id: createdFragmentId,
              },
              {
                existing_categories: categories.map((category) => category.name),
                existing_tags: tags.map((tag) => tag.name),
              },
            );

            setPendingAIAction((current) =>
              current ? { ...current, runningStatusText: "正在遍历其他 fragments，并整理候选关系…" } : current,
            );
            const relationCandidates = await getFragments();
            const relationResult = await analyzeRelations(
              relationCandidates.map((fragment) =>
                fragment.id === createdFragmentId
                  ? {
                      id: fragment.id,
                      title: analysis.result.suggested_title || fragment.title,
                      content: fragment.content,
                      summary: analysis.result.summary || fragment.summary,
                      category_name: fragment.category_name,
                      tags: fragment.tags.map((tag) => tag.name),
                    }
                  : {
                      id: fragment.id,
                      title: fragment.title,
                      content: fragment.content,
                      summary: fragment.summary,
                      category_name: fragment.category_name,
                      tags: fragment.tags.map((tag) => tag.name),
                  },
              ),
              "build_relation_list",
              {
                focusFragmentIds: createdFragmentId ? [createdFragmentId] : [],
              },
            );
            const relationSuggestions = relationResult.relations
              .filter(
                (relation) =>
                  relation.source_fragment_id === createdFragmentId ||
                  relation.target_fragment_id === createdFragmentId,
              )
              .map((relation, index) => ({
                ...relation,
                editable: false,
                review_status: "pending" as const,
                temp_id: `REL-${index + 1}`,
              }));

            setIsReviewEditing(false);
            setPendingAnalyzeReview({
              draft: toReviewDraft(analysis.result),
              fragmentId: createdFragmentId,
            });
            if (relationSuggestions.length > 0) {
              setQueuedRelationReview({
                fragmentTitle: analysis.result.suggested_title || input.title || "Untitled Fragment",
                suggestions: relationSuggestions,
              });
            }
          },
        });
      } catch (createAIError) {
        setError(createAIError instanceof Error ? createAIError.message : "AI 预估失败");
      }
      return;
    }

    setBusyAction("create");
    setError(null);

    try {
      const fragmentId = await createFragment(input);
      setCreateDraft(initialDraft);
      setIsCreateOpen(false);
      setSelectedFragmentId(fragmentId);
      await loadFragmentsData(fragmentId);
      await maybePromptTimeDetection(fragmentId, input);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建 fragment 失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveDetail() {
    if (!selectedFragmentId) {
      return;
    }

    setBusyAction("save-detail");
    setError(null);

    try {
      const input = buildInputFromDraft(detailDraft);
      await updateFragment(selectedFragmentId, input);
      await loadFragmentsData(selectedFragmentId);
      await maybePromptTimeDetection(selectedFragmentId, input);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存 fragment 失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteFragment() {
    if (!selectedFragmentId) {
      return;
    }

    const confirmed = window.confirm("确认删除这个 fragment？该操作会同时删除本 fragment 关联的提醒与关系。");
    if (!confirmed) {
      return;
    }

    setBusyAction("delete");
    setError(null);

    try {
      await deleteFragment(selectedFragmentId);
      closeEditorPanel();
      await loadFragmentsData(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除 fragment 失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExportMarkdown(copyOnly = false) {
    if (!selectedFragmentId) {
      return;
    }

    try {
      const result = await exportFragmentMarkdown(selectedFragmentId);

      if (copyOnly) {
        await navigator.clipboard.writeText(result.markdown);
        window.alert("Markdown 已复制到剪贴板。");
        return;
      }

      downloadMarkdown(result.filename, result.markdown);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Markdown 导出失败");
    }
  }

  async function openAIConfirmation({
    taskName,
    fragments,
    extraText,
    estimateOverride,
    fragmentCountOverride,
    runningStatusText,
    onStart,
  }: {
    taskName: string;
    fragments: AIFragmentPayload[];
    extraText?: string;
    estimateOverride?: AIEstimate;
    fragmentCountOverride?: number;
    runningStatusText?: string | null;
    onStart: () => Promise<void>;
  }) {
    setError(null);
    setAIActionError(null);

    try {
      const estimate =
        estimateOverride ??
        (await estimateAIRequest({
          fragments,
          extraText,
        }));
      setPendingAIAction({
        estimate,
        fragmentCount: fragmentCountOverride ?? fragments.length,
        runningStatusText,
        startAction: onStart,
        taskName,
      });
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "AI 预估失败");
    }
  }

  async function handleStartAIAction() {
    if (!pendingAIAction) {
      return;
    }

    setIsAIRunning(true);
    setError(null);
    setAIActionError(null);

    try {
      await pendingAIAction.startAction();
      setPendingAIAction(null);
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI 调用失败";
      setError(message);
      setAIActionError(message);
    } finally {
      setIsAIRunning(false);
      setBusyAction(null);
    }
  }

  function openQueuedRelationReviewIfAny() {
    if (!queuedRelationReview) {
      return;
    }

    setPendingRelationReview(queuedRelationReview);
    setQueuedRelationReview(null);
  }

  async function handleAcceptAnalyzeReview() {
    if (!pendingAnalyzeReview) {
      return;
    }

    setBusyAction("apply-ai-review");
    setError(null);

    try {
      await applyAIAnalysisToFragment(pendingAnalyzeReview.fragmentId, {
        suggested_title: pendingAnalyzeReview.draft.suggested_title,
        summary: pendingAnalyzeReview.draft.summary,
        suggested_category: pendingAnalyzeReview.draft.suggested_category,
        suggested_tags: parseTagText(pendingAnalyzeReview.draft.suggested_tags_text),
      });
      setPendingAnalyzeReview(null);
      setIsReviewEditing(false);
      await loadFragmentsData(pendingAnalyzeReview.fragmentId);
      openQueuedRelationReviewIfAny();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "应用 AI 结果失败");
    } finally {
      setBusyAction(null);
    }
  }

  function updateRelationSuggestion(
    tempId: string,
    updater: (current: ReviewRelationSuggestion) => ReviewRelationSuggestion,
  ) {
    setPendingRelationReview((current) =>
      current
        ? {
            ...current,
            suggestions: current.suggestions.map((suggestion) =>
              suggestion.temp_id === tempId ? updater(suggestion) : suggestion,
            ),
          }
        : current,
    );
  }

  async function handleSaveAcceptedInlineRelations() {
    if (!pendingRelationReview) {
      return;
    }

    const accepted = pendingRelationReview.suggestions.filter(
      (suggestion) => suggestion.review_status === "accepted",
    );
    if (accepted.length === 0) {
      setError("请先接受至少一条关系建议。");
      return;
    }

    setBusyAction("save-inline-relations");
    setError(null);

    try {
      const inputs: RelationInput[] = accepted.map((suggestion) => ({
        source_fragment_id: suggestion.source_fragment_id,
        target_fragment_id: suggestion.target_fragment_id,
        relation_type: suggestion.relation_type,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        created_by: "ai",
      }));
      await saveRelations(inputs);
      setPendingRelationReview(null);
      await loadFragmentsData(selectedFragmentId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存关系失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteExistingRelation(relation: RelatedFragmentRelationItem) {
    const confirmed = window.confirm("Are you sure you want to delete this relation?");
    if (!confirmed) {
      return;
    }

    setBusyAction("delete-relation");
    setError(null);

    try {
      await deleteRelation(relation.id);
      if (selectedFragmentId) {
        setRelatedRelations(await getRelationsForFragment(selectedFragmentId));
      }
    } catch (relationError) {
      setError(relationError instanceof Error ? relationError.message : "删除 relation 失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddToTimelineOnly() {
    if (!pendingTimeDetection) {
      return;
    }

    setBusyAction("timeline-only");
    setError(null);

    try {
      await saveReminder({
        fragment_id: pendingTimeDetection.fragmentId,
        title: pendingTimeDetection.possibleEventTitle,
        event_time: pendingTimeDetection.eventTime,
        remind_at: [],
        status: "timeline_only",
        source_text: pendingTimeDetection.sourceText,
      });
      closeTimeDialogs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "加入 Timeline 失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveReminder() {
    if (!pendingTimeDetection) {
      return;
    }

    const remindAt = buildReminderTimes(pendingTimeDetection.eventTime, reminderForm);
    if (remindAt.length === 0) {
      setError("请至少选择一个提醒时间，或改为仅加入 Timeline。");
      return;
    }

    setBusyAction("save-reminder");
    setError(null);

    try {
      await saveReminder({
        fragment_id: pendingTimeDetection.fragmentId,
        title: pendingTimeDetection.possibleEventTitle,
        event_time: pendingTimeDetection.eventTime,
        remind_at: remindAt,
        status: "active",
        source_text: pendingTimeDetection.sourceText,
      });
      closeTimeDialogs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存提醒失败");
    } finally {
      setBusyAction(null);
    }
  }

  const categoryDialog = isCategoryDialogOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.38)] p-4">
      <div className="paper-panel w-full max-w-xl rounded-[1.8rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">New Category</p>
        <h2 className="mt-2 font-serif text-2xl text-text">从 Fragment 中新建分类</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          当前只做用户侧分类维护。分类创建后会立即写入本地 categories 表，并回填到当前 fragment 表单。
        </p>

        <div className="mt-5 space-y-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Name</span>
            <input
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setCategoryDraft((current) => ({ ...current, name: event.target.value }))
              }
              value={categoryDraft.name}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Description</span>
            <textarea
              className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setCategoryDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              value={categoryDraft.description}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Rules</span>
            <textarea
              className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setCategoryDraft((current) => ({ ...current, rules: event.target.value }))
              }
              value={categoryDraft.rules}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={() => void handleCreateCategoryInline()} type="button">
            新增分类
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => setIsCategoryDialogOpen(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const timeDetectionDialog = pendingTimeDetection && !isReminderSettingsOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.38)] p-4">
      <div className="paper-panel w-full max-w-2xl rounded-[1.8rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
          Time information detected
        </p>
        <h2 className="mt-2 font-serif text-2xl text-text">检测到时间信息</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          当前使用本地规则检测到了一条可能的时间事件。是否要把它加入 Timeline，或者继续设置提醒？
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Detected Date</p>
            <p className="mt-3 font-serif text-xl text-text">
              {pendingTimeDetection.detectedDateLabel}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Possible Event Title</p>
            <p className="mt-3 text-sm leading-7 text-text">
              {pendingTimeDetection.possibleEventTitle}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[rgba(78,102,64,0.12)] bg-[rgba(78,102,64,0.08)] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Source Text</p>
          <p className="mt-3 text-sm leading-7 text-text/82">
            {pendingTimeDetection.sourceText}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            disabled={Boolean(busyAction)}
            onClick={() => setIsReminderSettingsOpen(true)}
            type="button"
          >
            Set Reminder
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={Boolean(busyAction)}
            onClick={() => void handleAddToTimelineOnly()}
            type="button"
            variant="outline"
          >
            Add to Timeline Only
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={Boolean(busyAction)}
            onClick={closeTimeDialogs}
            type="button"
            variant="outline"
          >
            Ignore
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const reminderSettingsDialog = pendingTimeDetection && isReminderSettingsOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.38)] p-4">
      <div className="paper-panel w-full max-w-2xl rounded-[1.8rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Reminder Setup</p>
        <h2 className="mt-2 font-serif text-2xl text-text">设置提醒时间</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          事件时间为 {pendingTimeDetection.detectedDateLabel}。你可以选择一个或多个提醒节点，或者返回上一层只加入 Timeline。
        </p>

        <div className="mt-5 grid gap-3 rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
          <label className="flex items-center gap-3 text-sm text-text">
            <input checked disabled readOnly type="checkbox" />
            当天提醒
          </label>
          <label className="flex items-center gap-3 text-sm text-text">
            <input
              checked={reminderForm.oneDayBefore}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  oneDayBefore: event.target.checked,
                }))
              }
              type="checkbox"
            />
            1 day before
          </label>
          <label className="flex items-center gap-3 text-sm text-text">
            <input
              checked={reminderForm.threeDaysBefore}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  threeDaysBefore: event.target.checked,
                }))
              }
              type="checkbox"
            />
            3 days before
          </label>
          <label className="flex items-center gap-3 text-sm text-text">
            <input
              checked={reminderForm.oneWeekBefore}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  oneWeekBefore: event.target.checked,
                }))
              }
              type="checkbox"
            />
            1 week before
          </label>
          <label className="grid gap-2 text-sm text-text">
            <span>Custom</span>
            <input
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              inputMode="numeric"
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  customDays: event.target.value,
                }))
              }
              placeholder="提前多少天，例如 14"
              value={reminderForm.customDays}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            disabled={busyAction === "save-reminder"}
            onClick={() => void handleSaveReminder()}
            type="button"
          >
            保存提醒
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={busyAction === "save-reminder"}
            onClick={() => setIsReminderSettingsOpen(false)}
            type="button"
            variant="outline"
          >
            返回检测结果
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={busyAction === "save-reminder"}
            onClick={closeTimeDialogs}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const aiConfirmationDialog = pendingAIAction ? (
    <AIConfirmationModal
      estimatedCost={pendingAIAction.estimate.estimatedCost}
      estimatedInputLength={pendingAIAction.estimate.estimatedInputLength}
      estimatedTokenUsage={pendingAIAction.estimate.estimatedTokenUsage}
      errorMessage={aiActionError}
      fragmentCount={pendingAIAction.fragmentCount}
      modelName={pendingAIAction.estimate.modelName}
      onCancel={() => {
        setPendingAIAction(null);
        setAIActionError(null);
      }}
      onStart={() => void handleStartAIAction()}
      open
      running={isAIRunning}
      statusText={pendingAIAction.runningStatusText}
      taskName={pendingAIAction.taskName}
    />
  ) : null;

  const analyzeReviewDialog = pendingAnalyzeReview ? (
    <AnalyzeFragmentReviewModal
      draft={pendingAnalyzeReview.draft}
      editable={isReviewEditing}
      onAccept={() => void handleAcceptAnalyzeReview()}
      onChange={(draft) =>
        setPendingAnalyzeReview((current) => (current ? { ...current, draft } : current))
      }
      onEdit={() => setIsReviewEditing(true)}
      onReject={() => {
        setPendingAnalyzeReview(null);
        setIsReviewEditing(false);
        openQueuedRelationReviewIfAny();
      }}
      open
      submitting={busyAction === "apply-ai-review"}
    />
  ) : null;

  const relationReviewDialog = pendingRelationReview ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
      <div className="paper-panel w-full max-w-5xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Relation Review</p>
        <h2 className="mt-2 font-serif text-2xl text-text">关系建议已生成</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          已围绕「{pendingRelationReview.fragmentTitle}」完成关系遍历。你可以先 review，再决定是否把这些关系写入本地数据库。
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
            {pendingRelationReview.suggestions.length} suggestions
          </Badge>
          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
            duplicate_or_similar 已并入同一条关系流
          </Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() =>
              setPendingRelationReview((current) =>
                current
                  ? {
                      ...current,
                      suggestions: current.suggestions.map((suggestion) =>
                        suggestion.confidence >= 0.75
                          ? { ...suggestion, review_status: "accepted" }
                          : suggestion,
                      ),
                    }
                  : current,
              )
            }
            type="button"
            variant="outline"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Accept All High Confidence
          </Button>
          <Button
            className="rounded-full"
            disabled={busyAction === "save-inline-relations"}
            onClick={() => void handleSaveAcceptedInlineRelations()}
            type="button"
          >
            Save Accepted Relations
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() =>
              setPendingRelationReview((current) =>
                current
                  ? {
                      ...current,
                      suggestions: current.suggestions.map((suggestion) => ({
                        ...suggestion,
                        review_status: "rejected",
                      })),
                    }
                  : current,
              )
            }
            type="button"
            variant="outline"
          >
            Reject All
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => setPendingRelationReview(null)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
        </div>

        <div className="mt-5 max-h-[55vh] space-y-4 overflow-auto pr-1">
          {pendingRelationReview.suggestions.map((suggestion) => (
            <article
              key={suggestion.temp_id}
              className="rounded-[1.6rem] border border-white/70 bg-white/58 p-4 shadow-paper"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-xl text-text">
                      {suggestion.source_fragment_title} → {suggestion.target_fragment_title}
                    </p>
                    <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                      {suggestion.review_status}
                    </Badge>
                  </div>

                  {suggestion.editable ? (
                    <div className="mt-4 grid gap-4">
                      <select
                        className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                        onChange={(event) =>
                          updateRelationSuggestion(suggestion.temp_id, (current) => ({
                            ...current,
                            relation_type: event.target.value as RelationType,
                          }))
                        }
                        value={suggestion.relation_type}
                      >
                        {relationTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="min-h-[7rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
                        onChange={(event) =>
                          updateRelationSuggestion(suggestion.temp_id, (current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        value={suggestion.reason}
                      />
                      <input
                        className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                        inputMode="decimal"
                        onChange={(event) =>
                          updateRelationSuggestion(suggestion.temp_id, (current) => ({
                            ...current,
                            confidence: Math.max(0, Math.min(1, Number(event.target.value) || 0)),
                          }))
                        }
                        value={suggestion.confidence}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                        <span>{suggestion.relation_type}</span>
                        <span>·</span>
                        <span>confidence {formatConfidence(suggestion.confidence)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-text/80">{suggestion.reason}</p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-[20rem] xl:justify-end">
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={() =>
                      updateRelationSuggestion(suggestion.temp_id, (current) => ({
                        ...current,
                        review_status: "accepted",
                        editable: false,
                      }))
                    }
                    type="button"
                    variant="outline"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={() =>
                      updateRelationSuggestion(suggestion.temp_id, (current) => ({
                        ...current,
                        editable: !current.editable,
                      }))
                    }
                    type="button"
                    variant="outline"
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={() =>
                      updateRelationSuggestion(suggestion.temp_id, (current) => ({
                        ...current,
                        review_status: "rejected",
                        editable: false,
                      }))
                    }
                    type="button"
                    variant="outline"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (selectedFragment && selectedFragmentId && !isCreateOpen) {
    return (
      <section className="relative h-full">
        <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,138,88,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(166,124,82,0.14),transparent_24%),linear-gradient(180deg,rgba(255,249,240,0.24),rgba(255,255,255,0))]" />

          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div className="max-w-3xl">
                <button
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm text-text transition hover:bg-white"
                  onClick={closeEditorPanel}
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回 Fragments 列表
                </button>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-white/65 bg-white/78 text-primary shadow-paper">
                    <Boxes className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="font-serif text-3xl tracking-[0.02em] text-text md:text-4xl">
                      {selectedFragment.title || selectedFragment.id}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-text/75 md:text-base">
                      当前 fragment 的本地详情编辑页。这里可以修改内容、分类、标签、摘要，并导出 Markdown。
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() =>
                    setSummaryContext({
                      preferredMode: "related",
                      presetSourceFragmentId: selectedFragmentId,
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Generate Summary
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() =>
                    onOpenRelationAnalysis({
                      currentCategoryId: selectedFragment.category_id,
                      currentFragmentId: selectedFragmentId,
                      selectedFragmentIds: selectedFragmentId ? [selectedFragmentId] : [],
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Find Related Fragments
                </Button>
                <Button
                  className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                  onClick={() => void handleDeleteFragment()}
                  variant="outline"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.6fr_0.7fr]">
              <div className="paper-panel rounded-[1.8rem] p-6 shadow-paper">
                  <FragmentEditorForm
                    categories={categories}
                    draft={detailDraft}
                    mode="detail"
                    onAddTag={() => addDraftTag("detail")}
                    onCreateCategory={() => openCategoryDialog("detail")}
                    onChange={setDetailDraft}
                    onRemoveTag={(tagName) => removeDraftTag("detail", tagName)}
                    onPrimaryAction={() => void handleSaveDetail()}
                    onSecondaryAction={() =>
                      void openAIConfirmation({
                        extraText: buildTaxonomyEstimateText(categories, tags),
                        taskName: "Analyze Fragment",
                        fragments: [
                          toAIFragmentPayload(detailDraft, {
                            id: selectedFragmentId,
                            categoryName: selectedFragment.category_name,
                          }),
                        ],
                        onStart: async () => {
                          const result = await analyzeFragmentWithContext(
                            toAIFragmentPayload(detailDraft, {
                              id: selectedFragmentId,
                              categoryName: selectedFragment.category_name,
                            }),
                            {
                              existing_categories: categories.map((category) => category.name),
                              existing_tags: tags.map((tag) => tag.name),
                            },
                          );
                          setIsReviewEditing(false);
                          setPendingAnalyzeReview({
                            draft: toReviewDraft(result.result),
                            fragmentId: selectedFragmentId,
                          });
                        },
                      })
                    }
                    submitting={busyAction === "save-detail"}
                  >
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                      onClick={() => void handleExportMarkdown(false)}
                      type="button"
                      variant="outline"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export Markdown
                    </Button>
                    <Button
                      className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                      onClick={() => void handleExportMarkdown(true)}
                      type="button"
                      variant="outline"
                    >
                      复制 Markdown
                    </Button>
                  </div>
                </FragmentEditorForm>
              </div>

              <div className="flex flex-col gap-4">
                <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                  <div className="border-b border-white/55 pb-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted/88">
                      Related Fragments
                    </p>
                    <h2 className="mt-2 font-serif text-[1.7rem] leading-none text-text">已保存相关关系</h2>
                    <p className="mt-2 max-w-[22rem] text-[13px] leading-6 text-muted">
                      这里只显示已经写入本地 `relations` 表的关系，不会自动调用 AI，也不会自动分析新关系。
                    </p>
                  </div>

                  {relatedRelations.length === 0 ? (
                    <div className="mt-4 rounded-[1.5rem] border border-dashed border-primary/25 bg-white/34 p-5">
                      <p className="font-serif text-[1.3rem] text-text">No saved related fragments yet.</p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        目前这条 fragment 还没有已保存关系。你可以手动打开关系分析范围选择，再决定是否分析并保存。
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3.5">
                      {relatedRelations.map((relation) => (
                        <article key={relation.id} className="paper-panel rounded-[1.45rem] p-4 shadow-paper">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-2.5">
                              <div className="min-w-0">
                                <p className="font-serif text-[1.28rem] leading-tight text-text">
                                  {relation.related_fragment_title}
                                </p>
                                <p className="mt-1 text-[12px] leading-5 text-muted">
                                  {buildRelationDirectionLabel(relation.relation_direction)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge className="bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10">
                                  {relation.relation_type}
                                </Badge>
                                <Badge className="bg-white/74 px-2.5 py-1 text-[11px] text-muted hover:bg-white/74" variant="secondary">
                                  confidence {formatConfidence(relation.confidence)}
                                </Badge>
                                <Badge className="bg-[rgba(110,82,54,0.08)] px-2.5 py-1 text-[11px] text-text hover:bg-[rgba(110,82,54,0.08)]">
                                  {relation.created_by}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-[13px] leading-6 text-text/76">
                              {relation.related_fragment_summary || "This related fragment does not have a saved summary yet."}
                            </p>

                            <div className="rounded-[1.15rem] bg-white/54 px-3.5 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Relation Reason</p>
                              <p className="mt-1.5 text-[13px] leading-6 text-text/80">{relation.reason}</p>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              <Button
                                className="rounded-full border-white/60 bg-white/72 px-3.5 text-[12px] text-text hover:bg-white"
                                onClick={() => void openFragment(relation.related_fragment_id)}
                                type="button"
                                variant="outline"
                              >
                                Open Related Fragment
                              </Button>
                              <Button
                                className="rounded-full border-white/60 bg-white/72 px-3.5 text-[12px] text-text hover:bg-white"
                                onClick={() => void handleDeleteExistingRelation(relation)}
                                type="button"
                                variant="outline"
                              >
                                Delete Relation
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {categoryDialog}
        {timeDetectionDialog}
        {reminderSettingsDialog}
        {aiConfirmationDialog}
        {analyzeReviewDialog}
        {relationReviewDialog}
        {summaryContext ? (
          <SummaryWorkflowModal
            initialContext={summaryContext}
            onClose={() => setSummaryContext(null)}
            onGoToRelationAnalysis={onOpenRelationAnalysis}
            onSavedFragment={(fragmentId) => {
              void loadFragmentsData(selectedFragmentId);
              setSummaryContext(null);
              void openFragment(fragmentId);
            }}
            open
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="relative h-full">
      <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,138,88,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(166,124,82,0.14),transparent_24%),linear-gradient(180deg,rgba(255,249,240,0.24),rgba(255,255,255,0))]" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-white/70 text-muted hover:bg-white/70">
                收集
              </Badge>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-white/65 bg-white/78 text-primary shadow-paper">
                  <Boxes className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-serif text-3xl tracking-[0.02em] text-text md:text-4xl">
                    Fragments 碎片
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-text/75 md:text-base">
                    在本地 IndexedDB 中保存、搜索、编辑和导出研究碎片。所有 AI 操作都需要你先确认，再返回可 review 的结果。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-white/82 text-text shadow-paper hover:bg-white"
                onClick={openCreatePanel}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Fragment
              </Button>
              {selectedFragmentIds.length > 0 ? (
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={openRelationAnalysisForSelection}
                  type="button"
                  variant="outline"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Analyze Relations ({selectedFragmentIds.length})
                </Button>
              ) : null}
              <Button
                className="rounded-full border-white/60 bg-transparent text-text hover:bg-white/45"
                variant="outline"
                onClick={() =>
                  setSummaryContext({
                    preferredMode: categoryFilter || tagFilter ? "filters" : "all",
                    presetCategoryIds: categoryFilter ? [categoryFilter] : [],
                    presetTagIds: tagFilter ? [tagFilter] : [],
                  })
                }
              >
                <BrainCircuit className="mr-2 h-4 w-4" />
                Generate Markdown Summary
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_0.7fr]">
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <label className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      className="w-full rounded-[1.2rem] border border-white/70 bg-white/70 px-11 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-primary/40"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search fragments"
                      value={search}
                    />
                  </label>

                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    value={categoryFilter}
                  >
                    <option value="">Filter by Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setTagFilter(event.target.value)}
                    value={tagFilter}
                  >
                    <option value="">Filter by Tag</option>
                    {tags.map((tagItem) => (
                      <option key={tagItem.id} value={tagItem.id}>
                        {tagItem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">
                    当前显示 {totalCount} 条 fragment
                  </p>
                  <div className="flex items-center gap-3">
                    {selectedFragmentIds.length > 0 ? (
                      <button
                        className="text-sm text-primary transition hover:text-primary/80"
                        onClick={() => setSelectedFragmentIds([])}
                        type="button"
                      >
                        清除多选
                      </button>
                    ) : null}
                    {(search || categoryFilter || tagFilter) && (
                      <button
                        className="text-sm text-primary transition hover:text-primary/80"
                        onClick={() => {
                          setSearch("");
                          setCategoryFilter("");
                          setTagFilter("");
                        }}
                        type="button"
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {dbError ? (
                <div className="mt-4 rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
                  IndexedDB 初始化失败：{dbError}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {loading ? (
                  <div className="col-span-full rounded-[1.6rem] border border-white/70 bg-white/58 p-6 text-sm text-muted">
                    正在读取本地 fragments…
                  </div>
                ) : fragments.length === 0 ? (
                  <div className="col-span-full rounded-[1.6rem] border border-dashed border-primary/25 bg-white/40 p-6 text-sm leading-6 text-muted">
                    当前筛选条件下没有 fragment。可以新建一条，或清空搜索与筛选条件。
                  </div>
                ) : (
                  fragments.map((fragment) => {
                    const typeMeta = contentTypeMeta[fragment.content_type];
                    const TypeIcon = typeMeta.icon;

                    return (
                      <div
                        key={fragment.id}
                        className={cn(
                          "group rounded-[1.7rem] border p-5 text-left shadow-paper transition",
                          "border-white/70 bg-white/58 hover:-translate-y-0.5 hover:bg-white/74",
                        )}
                        onClick={() => void openFragment(fragment.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void openFragment(fragment.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/74 text-primary transition hover:bg-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleFragmentSelection(fragment.id);
                              }}
                              type="button"
                            >
                              {selectedFragmentIds.includes(fragment.id) ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/75 bg-white/78 text-primary">
                              <TypeIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-serif text-xl text-text">
                                {fragment.title || "Untitled Fragment"}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted">
                                {typeMeta.label}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-muted">
                            {formatDate(fragment.created_at)}
                          </span>
                        </div>

                        <p className="mt-4 line-clamp-3 text-sm leading-7 text-text/76">
                          {fragment.summary || fragment.content}
                        </p>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                            {fragment.category_name ?? "Uncategorized"}
                          </Badge>
                          {fragment.tags.map((tagItem) => (
                            <Badge
                              key={tagItem.id}
                              className="bg-white/72 text-muted hover:bg-white/72"
                              variant="secondary"
                            >
                              #{tagItem.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="paper-panel min-h-[24rem] rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  {isCreateOpen ? "Create" : "Guide"}
                </p>
                {isCreateOpen ? (
                  <>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif text-2xl text-text">New Fragment</h2>
                        <p className="mt-2 text-sm leading-7 text-muted">
                          使用右侧新建面板快速保存新的 fragment。详情编辑仍然会进入独立页面。
                        </p>
                      </div>
                      <button
                        className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-white/60 hover:text-text"
                        onClick={closeEditorPanel}
                        type="button"
                      >
                        关闭
                      </button>
                    </div>

                    <FragmentEditorForm
                      categories={categories}
                      draft={createDraft}
                      mode="create"
                      onAddTag={() => addDraftTag("create")}
                      onCreateCategory={() => openCategoryDialog("create")}
                      onChange={setCreateDraft}
                      onRemoveTag={(tagName) => removeDraftTag("create", tagName)}
                      onPrimaryAction={() => void handleCreate("save")}
                      onSecondaryAction={() => void handleCreate("save_and_ai")}
                      submitting={busyAction === "create"}
                    />
                  </>
                ) : (
                  <div className="mt-6 rounded-[1.6rem] border border-dashed border-primary/25 bg-white/34 p-6">
                    <p className="font-serif text-xl text-text">Fragments Workspace</p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      点击某条 fragment 会进入独立详情页。右侧区域现在只保留新建入口和说明，不再展示具体 fragment 内容。
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-[1.9rem] border border-dashed border-primary/25 bg-white/34 p-5">
                <p className="font-serif text-lg text-text">当前阶段</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                  <li>已实现本地创建、编辑、删除、搜索、筛选与 Markdown 导出。</li>
                  <li>点击 fragment 后进入独立详情页，而不是右侧详情面板。</li>
                  <li>新建 fragment 的 Save & Analyze with AI 会连带生成关系建议，并在结束后交给你 review。</li>
                  <li>Find Related Fragments 保留为手动关系分析入口。</li>
                </ul>
              </div>
            </div>
          </div>

          {categoryDialog}
          {timeDetectionDialog}
          {reminderSettingsDialog}
          {aiConfirmationDialog}
          {analyzeReviewDialog}
          {relationReviewDialog}
          {summaryContext ? (
            <SummaryWorkflowModal
              initialContext={summaryContext}
              onClose={() => setSummaryContext(null)}
              onGoToRelationAnalysis={onOpenRelationAnalysis}
              onSavedFragment={(fragmentId) => {
                void loadFragmentsData(fragmentId);
                setSummaryContext(null);
                void openFragment(fragmentId);
              }}
              open
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

type FragmentEditorFormProps = {
  children?: React.ReactNode;
  categories: CategoryOption[];
  draft: FragmentDraft;
  mode: "create" | "detail";
  onAddTag: () => void;
  onCreateCategory: () => void;
  onChange: (draft: FragmentDraft) => void;
  onRemoveTag: (tagName: string) => void;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  submitting: boolean;
};

function FragmentEditorForm({
  children,
  categories,
  draft,
  mode,
  onAddTag,
  onCreateCategory,
  onChange,
  onRemoveTag,
  onPrimaryAction,
  onSecondaryAction,
  submitting,
}: FragmentEditorFormProps) {
  function update<K extends keyof FragmentDraft>(key: K, value: FragmentDraft[K]) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Title</span>
          <input
            className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
            onChange={(event) => update("title", event.target.value)}
            placeholder="Fragment title"
            value={draft.title}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Content</span>
          <textarea
            className="min-h-[10rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
            onChange={(event) => update("content", event.target.value)}
            placeholder="Paste or write the fragment content"
            value={draft.content}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Content Type</span>
            <select
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              onChange={(event) => update("content_type", event.target.value as ContentType)}
              value={draft.content_type}
            >
              {Object.entries(contentTypeMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-text">Category</span>
            <div className="flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                onChange={(event) => update("category_id", event.target.value)}
                value={draft.category_id}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Button
                className="rounded-[1.2rem] border-white/65 bg-white/75 text-text hover:bg-white"
                onClick={onCreateCategory}
                type="button"
                variant="outline"
              >
                新建分类
              </Button>
            </div>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-text">Tags</span>
          <div className="rounded-[1.2rem] border border-white/70 bg-white/58 p-3">
            <div className="flex flex-wrap gap-2">
              {draft.tag_names.map((tagName) => (
                <button
                  key={tagName}
                  className="inline-flex items-center gap-2 rounded-full bg-white/78 px-3 py-1.5 text-sm text-text transition hover:bg-white"
                  onClick={() => onRemoveTag(tagName)}
                  type="button"
                >
                  #{tagName}
                  <span className="text-muted">×</span>
                </button>
              ))}
              {draft.tag_names.length === 0 ? (
                <span className="text-sm text-muted">暂无标签</span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="relative min-w-0 flex-1">
                <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="w-full rounded-[1.2rem] border border-white/70 bg-white/70 px-11 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-primary/40"
                  onChange={(event) => update("tag_input", event.target.value)}
                  placeholder="输入一个标签名"
                  value={draft.tag_input}
                />
              </div>
              <Button
                className="rounded-[1.2rem] border-white/65 bg-white/75 text-text hover:bg-white"
                onClick={onAddTag}
                type="button"
                variant="outline"
              >
                添加标签
              </Button>
            </div>
          </div>
        </label>

        {mode === "detail" && (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Summary</span>
            <textarea
              className="min-h-[7rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
              onChange={(event) => update("summary", event.target.value)}
              placeholder="Editable summary"
              value={draft.summary}
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-full" disabled={submitting} onClick={onPrimaryAction} type="button">
          <Save className="mr-2 h-4 w-4" />
          {mode === "create" ? "Save Only" : "Save"}
        </Button>
        <Button
          className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
          disabled={submitting}
          onClick={onSecondaryAction}
          type="button"
          variant="outline"
        >
          <BrainCircuit className="mr-2 h-4 w-4" />
          {mode === "create" ? "Save & Analyze with AI" : "Analyze with AI"}
        </Button>
      </div>

      {children}
    </div>
  );
}
