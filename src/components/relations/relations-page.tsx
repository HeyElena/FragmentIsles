import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  Check,
  CheckCheck,
  GitBranchPlus,
  PanelRightClose,
  PanelRightOpen,
  Link2,
  LoaderCircle,
  PencilLine,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AIConfirmationModal } from "@/components/ai/ai-confirmation-modal";
import { SummaryWorkflowModal } from "@/components/summary/summary-workflow-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteRelation,
  getFragmentById,
  getFragments,
  getRelationList,
  saveRelations,
  type FragmentListItem,
  type FragmentDetailRecord,
  type RelationInput,
  type RelationListItem,
  type RelationType,
  type RelationUpdateInput,
  updateRelation,
} from "@/db";
import {
  analyzeRelations,
  estimateRelationAnalysisRequest,
  type AIFragmentPayload,
  type AIEstimate,
  type RelationSuggestion,
} from "@/services/aiService";

export type RelationAnalysisSeed = {
  currentCategoryId?: string | null;
  currentFragmentId?: string | null;
  selectedFragmentIds?: string[];
};

type RelationsPageProps = {
  dbError: string | null;
  initialAnalysisSeed?: RelationAnalysisSeed | null;
  onInitialAnalysisHandled?: () => void;
  onOpenFragment: (fragmentId: string) => void;
};

type ScopeMode = "context_full" | "by_tag" | "all_fragments";

type ScopeDraft = {
  scopeMode: ScopeMode;
  tagId: string;
};

type ReviewSuggestion = RelationSuggestion & {
  editable: boolean;
  review_status: "pending" | "accepted" | "rejected";
  temp_id: string;
};

type PendingRelationAIAction = {
  estimate: AIEstimate;
  focusFragmentIds?: string[] | null;
  fragments: FragmentListItem[];
  scopeLabel: string;
};

type AnalysisFeedback = {
  detail: string;
  fragmentCount: number;
  phase: "running" | "completed";
  scopeLabel: string;
  suggestionCount?: number;
  title: string;
};

type RelationFilterValue = "all" | RelationType;

type MapNode = {
  degree: number;
  fragment: FragmentListItem;
  id: string;
  relationCount: number;
  x: number;
  y: number;
};

type MapEdge = {
  id: string;
  labelX: number;
  labelY: number;
  path: string;
  relation: RelationListItem;
  sourceId: string;
  sourceX: number;
  sourceY: number;
  targetId: string;
  targetX: number;
  targetY: number;
};

type RelationEditDraft = {
  confidence: string;
  reason: string;
  relation_type: RelationType;
};

type SummaryOpenContext = {
  preferredMode?: "all" | "filters" | "related" | "keyword";
  presetCategoryIds?: string[];
  presetSourceFragmentId?: string | null;
  presetTagIds?: string[];
};

type ManualNodePosition = {
  x: number;
  y: number;
};

type DragState = {
  nodeId: string;
  originX: number;
  originY: number;
  startClientX: number;
  startClientY: number;
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

const relationTypeFilterOptions: Array<{ label: string; value: RelationFilterValue }> = [
  { label: "All", value: "all" },
  ...relationTypeOptions.map((value) => ({ label: value, value })),
];

const MAP_WIDTH = 1180;
const MAP_HEIGHT = 860;
const MAX_VISIBLE_FRAGMENTS = 100;

function toAIFragmentPayload(fragment: FragmentListItem): AIFragmentPayload {
  return {
    id: fragment.id,
    title: fragment.title,
    content: fragment.content,
    summary: fragment.summary,
    category_name: fragment.category_name,
    tags: fragment.tags.map((tag) => tag.name),
  };
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function shortRelationLabel(type: RelationType) {
  if (type === "duplicate_or_similar") {
    return "similar";
  }

  return type.replace(/_/g, " ");
}

function getDefaultScopeMode(seed: RelationAnalysisSeed | null | undefined): ScopeMode {
  if (seed?.currentFragmentId || (seed?.selectedFragmentIds?.length ?? 0) > 0) {
    return "context_full";
  }

  return "all_fragments";
}

function buildContextOptionLabel(seed: RelationAnalysisSeed | null, currentFragment: FragmentListItem | null) {
  if (seed?.currentFragmentId && currentFragment) {
    return "完整分析当前 Fragment";
  }

  if ((seed?.selectedFragmentIds?.length ?? 0) > 0) {
    return "完整分析已选 Fragments";
  }

  return "完整分析当前上下文";
}

function buildContextOptionDescription(seed: RelationAnalysisSeed | null, currentFragment: FragmentListItem | null) {
  if (seed?.currentFragmentId && currentFragment) {
    return `以「${currentFragment.title || "Untitled Fragment"}」为中心，遍历其余 fragments，整理相似、支持、冲突和延展关系。`;
  }

  if ((seed?.selectedFragmentIds?.length ?? 0) > 0) {
    return `以当前多选的 ${seed?.selectedFragmentIds?.length ?? 0} 条 fragments 为中心，遍历其余碎片并整理候选关系。`;
  }

  return "需要先从 fragment 详情页或多选列表进入，才能使用这一项。";
}

function buildNodeLayout(
  fragments: FragmentListItem[],
  relations: RelationListItem[],
) {
  const categories = new Map<string, FragmentListItem[]>();
  const degreeMap = new Map<string, number>();

  for (const relation of relations) {
    degreeMap.set(relation.source_fragment_id, (degreeMap.get(relation.source_fragment_id) ?? 0) + 1);
    degreeMap.set(relation.target_fragment_id, (degreeMap.get(relation.target_fragment_id) ?? 0) + 1);
  }

  for (const fragment of fragments) {
    const categoryLabel = fragment.category_name?.trim() || "Uncategorized";
    const bucket = categories.get(categoryLabel) ?? [];
    bucket.push(fragment);
    categories.set(categoryLabel, bucket);
  }

  const entries = [...categories.entries()].sort((left, right) => left[0].localeCompare(right[0], "zh-CN"));
  const cols = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.max(1, Math.ceil(entries.length / cols));
  const xStep = MAP_WIDTH / (cols + 1);
  const yStep = MAP_HEIGHT / (rows + 1);
  const nodes: MapNode[] = [];

  entries.forEach(([_, items], groupIndex) => {
    const col = groupIndex % cols;
    const row = Math.floor(groupIndex / cols);
    const centerX = (col + 1) * xStep + (row % 2 === 0 ? -24 : 24);
    const centerY = (row + 1) * yStep + (col % 2 === 0 ? 20 : -20);

    items
      .sort((left, right) => (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0))
      .forEach((fragment, itemIndex) => {
        const angle = itemIndex * 1.23 + (groupIndex + 1) * 0.47;
        const radius = 42 + Math.floor(itemIndex / 5) * 68 + (itemIndex % 3) * 10;
        const x = Math.max(92, Math.min(MAP_WIDTH - 92, centerX + Math.cos(angle) * radius));
        const y = Math.max(84, Math.min(MAP_HEIGHT - 84, centerY + Math.sin(angle) * radius * 0.72));
        const degree = degreeMap.get(fragment.id) ?? 0;

        nodes.push({
          degree,
          fragment,
          id: fragment.id,
          relationCount: degree,
          x,
          y,
        });
      });
  });

  for (let iteration = 0; iteration < 18; iteration += 1) {
    for (let index = 0; index < nodes.length; index += 1) {
      const current = nodes[index];

      for (let compareIndex = index + 1; compareIndex < nodes.length; compareIndex += 1) {
        const target = nodes[compareIndex];
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDistance = 164;

        if (distance >= minDistance) {
          continue;
        }

        const overlap = (minDistance - distance) / 2;
        const offsetX = (dx / distance) * overlap;
        const offsetY = (dy / distance) * overlap * 0.86;

        current.x = Math.max(104, Math.min(MAP_WIDTH - 104, current.x - offsetX));
        current.y = Math.max(94, Math.min(MAP_HEIGHT - 94, current.y - offsetY));
        target.x = Math.max(104, Math.min(MAP_WIDTH - 104, target.x + offsetX));
        target.y = Math.max(94, Math.min(MAP_HEIGHT - 94, target.y + offsetY));
      }
    }
  }

  return nodes;
}

function buildEdgeLayout(
  relations: RelationListItem[],
  nodeMap: Map<string, MapNode>,
) {
  return relations.flatMap((relation) => {
    const source = nodeMap.get(relation.source_fragment_id);
    const target = nodeMap.get(relation.target_fragment_id);
    if (!source || !target) {
      return [];
    }

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const curveLift = Math.max(24, Math.min(88, Math.abs(source.x - target.x) * 0.12 + 20));
    const controlX = midX;
    const controlY = midY - curveLift;
    const path = `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;

    return [
      {
        id: relation.id,
        labelX: (midX + controlX) / 2,
        labelY: (midY + controlY) / 2,
        path,
        relation,
        sourceId: source.id,
        sourceX: source.x,
        sourceY: source.y,
        targetId: target.id,
        targetX: target.x,
        targetY: target.y,
      } satisfies MapEdge,
    ];
  });
}

export function RelationsPage({
  dbError,
  initialAnalysisSeed = null,
  onInitialAnalysisHandled,
  onOpenFragment,
}: RelationsPageProps) {
  const hoverTimeoutRef = useRef<number | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const dragMovedRef = useRef(false);
  const suppressedClickNodeIdRef = useRef<string | null>(null);
  const [allFragments, setAllFragments] = useState<FragmentListItem[]>([]);
  const [savedRelations, setSavedRelations] = useState<RelationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scopeSeed, setScopeSeed] = useState<RelationAnalysisSeed | null>(null);
  const [scopeDraft, setScopeDraft] = useState<ScopeDraft>({
    scopeMode: "all_fragments",
    tagId: "",
  });
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [pendingAIAction, setPendingAIAction] = useState<PendingRelationAIAction | null>(null);
  const [aiActionError, setAIActionError] = useState<string | null>(null);
  const [aiRunningStatusText, setAIRunningStatusText] = useState<string | null>(null);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [reviewSuggestions, setReviewSuggestions] = useState<ReviewSuggestion[]>([]);
  const [analysisFeedback, setAnalysisFeedback] = useState<AnalysisFeedback | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [relationTypeFilter, setRelationTypeFilter] = useState<RelationFilterValue>("all");
  const [search, setSearch] = useState("");

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<RelationListItem | null>(null);
  const [editingRelation, setEditingRelation] = useState<RelationListItem | null>(null);
  const [relationEditDraft, setRelationEditDraft] = useState<RelationEditDraft | null>(null);
  const [isRelationListOpen, setIsRelationListOpen] = useState(false);
  const [previewFragment, setPreviewFragment] = useState<FragmentDetailRecord | null>(null);
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, ManualNodePosition>>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [summaryContext, setSummaryContext] = useState<SummaryOpenContext | null>(null);

  async function loadRelationsData() {
    setLoading(true);
    setError(null);

    try {
      const [fragments, relations] = await Promise.all([getFragments(), getRelationList()]);
      setAllFragments(fragments);
      setSavedRelations(relations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Relations 读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRelationsData();
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const fragmentMap = useMemo(
    () => new Map(allFragments.map((fragment) => [fragment.id, fragment])),
    [allFragments],
  );

  const currentFragment = useMemo(
    () => allFragments.find((fragment) => fragment.id === scopeSeed?.currentFragmentId) ?? null,
    [allFragments, scopeSeed],
  );

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; count: number }>();

    for (const fragment of allFragments) {
      const id = fragment.category_id ?? "uncategorized";
      const name = fragment.category_name?.trim() || "Uncategorized";
      const existing = categories.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        categories.set(id, { id, name, count: 1 });
      }
    }

    return [...categories.values()].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [allFragments]);

  const tagOptions = useMemo(() => {
    const tags = new Map<string, { id: string; name: string; count: number }>();

    for (const fragment of allFragments) {
      for (const tag of fragment.tags) {
        const existing = tags.get(tag.id);
        if (existing) {
          existing.count += 1;
        } else {
          tags.set(tag.id, {
            id: tag.id,
            name: tag.name,
            count: 1,
          });
        }
      }
    }

    return [...tags.values()].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [allFragments]);

  useEffect(() => {
    if (!initialAnalysisSeed) {
      return;
    }

    setScopeSeed(initialAnalysisSeed);
    setScopeDraft({
      scopeMode: getDefaultScopeMode(initialAnalysisSeed),
      tagId: "",
    });
    setAIActionError(null);
    setIsScopeModalOpen(true);
    onInitialAnalysisHandled?.();
  }, [initialAnalysisSeed, onInitialAnalysisHandled]);

  const scopedFragments = useMemo(() => {
    if (scopeDraft.scopeMode === "by_tag") {
      if (!scopeDraft.tagId) {
        return [];
      }

      return allFragments.filter((fragment) =>
        fragment.tags.some((tag) => tag.id === scopeDraft.tagId),
      );
    }

    return allFragments;
  }, [allFragments, scopeDraft]);

  function buildScopeLabel() {
    if (scopeDraft.scopeMode === "by_tag") {
      const currentTag = tagOptions.find((tag) => tag.id === scopeDraft.tagId);
      return currentTag ? `按标签分析 · ${currentTag.name}` : "按标签分析";
    }

    if (scopeDraft.scopeMode === "all_fragments") {
      return "整体分析";
    }

    return buildContextOptionLabel(scopeSeed, currentFragment);
  }

  function getFocusFragmentIds() {
    if (scopeDraft.scopeMode !== "context_full") {
      return null;
    }

    if (scopeSeed?.currentFragmentId) {
      return [scopeSeed.currentFragmentId];
    }

    if ((scopeSeed?.selectedFragmentIds?.length ?? 0) > 0) {
      return scopeSeed?.selectedFragmentIds ?? [];
    }

    return null;
  }

  function openScopeModal(seed?: RelationAnalysisSeed | null) {
    const nextSeed = seed ?? null;
    setScopeSeed(nextSeed);
    setScopeDraft({
      scopeMode: getDefaultScopeMode(nextSeed),
      tagId: "",
    });
    setAIActionError(null);
    setError(null);
    setIsScopeModalOpen(true);
  }

  async function handleContinueToConfirmation() {
    if (scopeDraft.scopeMode === "context_full" && !getFocusFragmentIds()?.length) {
      setError("当前没有可用的 fragment 上下文，请从 fragment 详情页或多选列表进入。");
      return;
    }

    if (scopeDraft.scopeMode === "by_tag" && !scopeDraft.tagId) {
      setError("请先选择一个标签。");
      return;
    }

    if (scopedFragments.length < 2) {
      setError("当前范围内至少需要两条 fragments 才能做关系分析。");
      return;
    }

    setError(null);
    setAIActionError(null);

    try {
      const estimate = await estimateRelationAnalysisRequest(
        scopedFragments.map(toAIFragmentPayload),
        "build_relation_list",
        {
          focusFragmentIds: getFocusFragmentIds() ?? [],
        },
      );
      setPendingAIAction({
        estimate,
        focusFragmentIds: getFocusFragmentIds(),
        fragments: scopedFragments,
        scopeLabel: buildScopeLabel(),
      });
      setIsScopeModalOpen(false);
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "关系分析预估失败");
    }
  }

  async function handleStartRelationAnalysis() {
    if (!pendingAIAction) {
      return;
    }

    setIsAIRunning(true);
    setAIActionError(null);
    setError(null);
    setAIRunningStatusText("正在遍历当前范围内的 fragments，整理相似、支持、冲突和延展关系。");
    setAnalysisFeedback({
      detail: `当前范围包含 ${pendingAIAction.fragments.length} 条 fragments，分析完成后会进入 review，不会直接写入数据库。`,
      fragmentCount: pendingAIAction.fragments.length,
      phase: "running",
      scopeLabel: pendingAIAction.scopeLabel,
      title: "正在分析关系",
    });

    try {
      const result = await analyzeRelations(
        pendingAIAction.fragments.map(toAIFragmentPayload),
        "build_relation_list",
        {
          focusFragmentIds: pendingAIAction.focusFragmentIds ?? [],
        },
      );
      const focusIds = new Set(pendingAIAction.focusFragmentIds ?? []);
      const nextRelations =
        focusIds.size > 0
          ? result.relations.filter(
              (relation) =>
                focusIds.has(relation.source_fragment_id) ||
                focusIds.has(relation.target_fragment_id),
            )
          : result.relations;

      setReviewSuggestions(
        nextRelations.map((relation, index) => ({
          ...relation,
          editable: false,
          review_status: "pending",
          temp_id: `REL-${index + 1}`,
        })),
      );
      setAnalysisFeedback({
        detail:
          nextRelations.length === 0
            ? "这次没有发现足够明确的候选关系。你可以换成按标签分析，或扩大到整体分析。"
            : "分析完成。你可以在下方接受、编辑或拒绝这些关系建议，最后再决定是否保存。",
        fragmentCount: pendingAIAction.fragments.length,
        phase: "completed",
        scopeLabel: pendingAIAction.scopeLabel,
        suggestionCount: nextRelations.length,
        title: "关系分析完成",
      });
      setPendingAIAction(null);
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "关系分析失败";
      setError(message);
      setAIActionError(message);
    } finally {
      setIsAIRunning(false);
      setAIRunningStatusText(null);
      setBusy(null);
    }
  }

  function updateReviewSuggestion(tempId: string, updater: (current: ReviewSuggestion) => ReviewSuggestion) {
    setReviewSuggestions((current) =>
      current.map((suggestion) => (suggestion.temp_id === tempId ? updater(suggestion) : suggestion)),
    );
  }

  async function handleSaveAcceptedRelations() {
    const accepted = reviewSuggestions.filter((suggestion) => suggestion.review_status === "accepted");
    if (accepted.length === 0) {
      setError("请先接受至少一条关系建议。");
      return;
    }

    setBusy("save-relations");
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
      setReviewSuggestions([]);
      await loadRelationsData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存关系失败");
    } finally {
      setBusy(null);
    }
  }

  function toggleCategoryFilter(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  function resetFilters() {
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setRelationTypeFilter("all");
    setSearch("");
  }

  function scheduleHoverClear(kind: "node" | "relation") {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    hoverTimeoutRef.current = window.setTimeout(() => {
      if (kind === "node") {
        setHoveredNodeId(null);
      } else {
        setHoveredRelationId(null);
      }
    }, 120);
  }

  function clearHoverTimeout() {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }

  function openRelationEditor(relation: RelationListItem) {
    setEditingRelation(relation);
    setRelationEditDraft({
      confidence: String(relation.confidence),
      reason: relation.reason,
      relation_type: relation.relation_type,
    });
  }

  async function openFragmentPreview(fragmentId: string) {
    setError(null);

    try {
      const detail = await getFragmentById(fragmentId);
      if (!detail) {
        setError("Fragment not found");
        return;
      }
      setPreviewFragment(detail);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Fragment 打开失败");
    }
  }

  async function handleSaveEditedRelation() {
    if (!editingRelation || !relationEditDraft) {
      return;
    }

    const confidence = Number(relationEditDraft.confidence);
    if (!Number.isFinite(confidence)) {
      setError("Confidence 必须是 0 到 1 之间的数字。");
      return;
    }

    setBusy("save-relation-edit");
    setError(null);

    try {
      const input: RelationUpdateInput = {
        confidence: Math.max(0, Math.min(1, confidence)),
        reason: relationEditDraft.reason,
        relation_type: relationEditDraft.relation_type,
      };
      await updateRelation(editingRelation.id, input);
      await loadRelationsData();
      setEditingRelation(null);
      setRelationEditDraft(null);
    } catch (relationError) {
      setError(relationError instanceof Error ? relationError.message : "更新 relation 失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteExistingRelation(relation: RelationListItem) {
    const confirmed = window.confirm("Are you sure you want to delete this relation?");
    if (!confirmed) {
      return;
    }

    setBusy("delete-relation");
    setError(null);

    try {
      await deleteRelation(relation.id);
      await loadRelationsData();
      if (selectedRelation?.id === relation.id) {
        setSelectedRelation(null);
      }
      if (editingRelation?.id === relation.id) {
        setEditingRelation(null);
        setRelationEditDraft(null);
      }
    } catch (relationError) {
      setError(relationError instanceof Error ? relationError.message : "删除 relation 失败");
    } finally {
      setBusy(null);
    }
  }

  const filteredRelations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return savedRelations.filter((relation) => {
      const source = fragmentMap.get(relation.source_fragment_id);
      const target = fragmentMap.get(relation.target_fragment_id);
      if (!source || !target) {
        return false;
      }

      if (relationTypeFilter !== "all" && relation.relation_type !== relationTypeFilter) {
        return false;
      }

      if (selectedCategoryIds.length > 0) {
        if (
          !source.category_id ||
          !target.category_id ||
          !selectedCategoryIds.includes(source.category_id) ||
          !selectedCategoryIds.includes(target.category_id)
        ) {
          return false;
        }
      }

      if (selectedTagIds.length > 0) {
        const sourceHasTag = source.tags.some((tag) => selectedTagIds.includes(tag.id));
        const targetHasTag = target.tags.some((tag) => selectedTagIds.includes(tag.id));
        if (!sourceHasTag && !targetHasTag) {
          return false;
        }
      }

      if (normalizedSearch) {
        const sourceText = [source.title, source.summary, source.content].join(" ").toLowerCase();
        const targetText = [target.title, target.summary, target.content].join(" ").toLowerCase();
        if (!sourceText.includes(normalizedSearch) && !targetText.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [fragmentMap, relationTypeFilter, savedRelations, search, selectedCategoryIds, selectedTagIds]);

  const limitedGraph = useMemo(() => {
    const degreeMap = new Map<string, number>();

    for (const relation of filteredRelations) {
      degreeMap.set(relation.source_fragment_id, (degreeMap.get(relation.source_fragment_id) ?? 0) + 1);
      degreeMap.set(relation.target_fragment_id, (degreeMap.get(relation.target_fragment_id) ?? 0) + 1);
    }

    const allNodeIds = [...new Set(filteredRelations.flatMap((relation) => [relation.source_fragment_id, relation.target_fragment_id]))];
    const sortedNodeIds = allNodeIds.sort((left, right) => {
      const degreeDiff = (degreeMap.get(right) ?? 0) - (degreeMap.get(left) ?? 0);
      if (degreeDiff !== 0) {
        return degreeDiff;
      }

      return (fragmentMap.get(left)?.title ?? "").localeCompare(fragmentMap.get(right)?.title ?? "", "zh-CN");
    });
    const limitedNodeIds = sortedNodeIds.slice(0, MAX_VISIBLE_FRAGMENTS);
    const limitedNodeIdSet = new Set(limitedNodeIds);
    const visibleRelations = filteredRelations.filter(
      (relation) =>
        limitedNodeIdSet.has(relation.source_fragment_id) &&
        limitedNodeIdSet.has(relation.target_fragment_id),
    );
    const visibleFragments = limitedNodeIds
      .map((id) => fragmentMap.get(id))
      .filter((fragment): fragment is FragmentListItem => Boolean(fragment));

    return {
      tooMany: allNodeIds.length > MAX_VISIBLE_FRAGMENTS,
      visibleFragments,
      visibleRelations,
    };
  }, [filteredRelations, fragmentMap]);

  const baseMapNodes = useMemo(
    () => buildNodeLayout(limitedGraph.visibleFragments, limitedGraph.visibleRelations),
    [limitedGraph.visibleFragments, limitedGraph.visibleRelations],
  );

  useEffect(() => {
    setManualNodePositions((current) => {
      const next: Record<string, ManualNodePosition> = {};
      let changed = Object.keys(current).length !== baseMapNodes.length;

      for (const node of baseMapNodes) {
        const existing = current[node.id];
        if (existing) {
          next[node.id] = existing;
        } else {
          next[node.id] = { x: node.x, y: node.y };
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [baseMapNodes]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      const viewport = mapViewportRef.current;
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const deltaX = ((event.clientX - activeDrag.startClientX) / rect.width) * MAP_WIDTH;
      const deltaY = ((event.clientY - activeDrag.startClientY) / rect.height) * MAP_HEIGHT;
      const nextX = Math.max(104, Math.min(MAP_WIDTH - 104, activeDrag.originX + deltaX));
      const nextY = Math.max(94, Math.min(MAP_HEIGHT - 94, activeDrag.originY + deltaY));

      if (Math.abs(event.clientX - activeDrag.startClientX) > 4 || Math.abs(event.clientY - activeDrag.startClientY) > 4) {
        dragMovedRef.current = true;
      }

      setManualNodePositions((current) => {
        const existing = current[activeDrag.nodeId];
        if (existing && existing.x === nextX && existing.y === nextY) {
          return current;
        }

        return {
          ...current,
          [activeDrag.nodeId]: { x: nextX, y: nextY },
        };
      });
    }

    function handlePointerUp() {
      if (dragMovedRef.current) {
        suppressedClickNodeIdRef.current = activeDrag.nodeId;
      }
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  const mapNodes = useMemo(
    () =>
      baseMapNodes.map((node) => ({
        ...node,
        x: manualNodePositions[node.id]?.x ?? node.x,
        y: manualNodePositions[node.id]?.y ?? node.y,
      })),
    [baseMapNodes, manualNodePositions],
  );

  const mapNodeMap = useMemo(
    () => new Map(mapNodes.map((node) => [node.id, node])),
    [mapNodes],
  );

  const mapEdges = useMemo(
    () => buildEdgeLayout(limitedGraph.visibleRelations, mapNodeMap),
    [limitedGraph.visibleRelations, mapNodeMap],
  );

  const hoveredNode = hoveredNodeId ? mapNodeMap.get(hoveredNodeId) ?? null : null;
  const hoveredEdge = hoveredRelationId ? mapEdges.find((edge) => edge.id === hoveredRelationId) ?? null : null;
  const highlightedNodeIds = useMemo(() => {
    if (!hoveredEdge) {
      return new Set<string>();
    }

    return new Set([hoveredEdge.sourceId, hoveredEdge.targetId]);
  }, [hoveredEdge]);

  const scopeModal = isScopeModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
      <div className="paper-panel w-full max-w-3xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Relation Analysis Scope</p>
        <h2 className="mt-2 font-serif text-2xl text-text">选择一种分析方式</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          这一层只保留三种方式：完整分析当前上下文、按标签分析、或整体分析。分析前仍然会显示 API 估算。
        </p>

        <div className="mt-5 grid gap-4">
          <button
            className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4 text-left transition hover:bg-white/74"
            disabled={!getFocusFragmentIds()?.length}
            onClick={() => setScopeDraft((current) => ({ ...current, scopeMode: "context_full" }))}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">{buildContextOptionLabel(scopeSeed, currentFragment)}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {buildContextOptionDescription(scopeSeed, currentFragment)}
                </p>
              </div>
              <div
                className={`mt-1 h-4 w-4 rounded-full border ${
                  scopeDraft.scopeMode === "context_full"
                    ? "border-primary bg-primary"
                    : "border-muted/50 bg-transparent"
                }`}
              />
            </div>
          </button>

          <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
            <button
              className="w-full text-left"
              onClick={() => setScopeDraft((current) => ({ ...current, scopeMode: "by_tag" }))}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text">按照标签分析</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    选一个标签，把同一标签下的 fragments 放到一条关系 review 流里。
                  </p>
                </div>
                <div
                  className={`mt-1 h-4 w-4 rounded-full border ${
                    scopeDraft.scopeMode === "by_tag"
                      ? "border-primary bg-primary"
                      : "border-muted/50 bg-transparent"
                  }`}
                />
              </div>
            </button>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/72 text-primary">
                <Tag className="h-4 w-4" />
              </div>
              <select
                className="min-w-0 flex-1 rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                onChange={(event) =>
                  setScopeDraft((current) => ({
                    ...current,
                    scopeMode: "by_tag",
                    tagId: event.target.value,
                  }))
                }
                value={scopeDraft.tagId}
              >
                <option value="">选择标签</option>
                {tagOptions.map((tagItem) => (
                  <option key={tagItem.id} value={tagItem.id}>
                    {tagItem.name} · {tagItem.count} fragments
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4 text-left transition hover:bg-white/74"
            onClick={() => setScopeDraft((current) => ({ ...current, scopeMode: "all_fragments" }))}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">整体分析</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  直接遍历当前本地库中的全部 fragments，生成一批可 review 的候选关系。
                </p>
              </div>
              <div
                className={`mt-1 h-4 w-4 rounded-full border ${
                  scopeDraft.scopeMode === "all_fragments"
                    ? "border-primary bg-primary"
                    : "border-muted/50 bg-transparent"
                }`}
              />
            </div>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={() => void handleContinueToConfirmation()} type="button">
            Continue
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => setIsScopeModalOpen(false)}
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
      fragmentCount={pendingAIAction.fragments.length}
      modelName={pendingAIAction.estimate.modelName}
      onCancel={() => {
        setPendingAIAction(null);
        setAIActionError(null);
        setAIRunningStatusText(null);
      }}
      onStart={() => void handleStartRelationAnalysis()}
      open
      running={isAIRunning}
      statusText={aiRunningStatusText}
      taskName="Build Relation List"
    />
  ) : null;

  const relationDetailDialog = selectedRelation ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
      <div className="paper-panel w-full max-w-3xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Relation Detail</p>
        <h2 className="mt-2 font-serif text-2xl text-text">已保存关系详情</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Source Fragment</p>
            <p className="mt-3 text-sm leading-7 text-text">{selectedRelation.source_fragment_title}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Target Fragment</p>
            <p className="mt-3 text-sm leading-7 text-text">{selectedRelation.target_fragment_title}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{selectedRelation.relation_type}</Badge>
          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
            confidence {formatConfidence(selectedRelation.confidence)}
          </Badge>
          <Badge className="bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.08)]">
            created by {selectedRelation.created_by}
          </Badge>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Reason</p>
          <p className="mt-3 text-sm leading-7 text-text/82">{selectedRelation.reason}</p>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Created At</p>
          <p className="mt-3 text-sm leading-7 text-text/82">{formatDate(selectedRelation.created_at)}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => openRelationEditor(selectedRelation)}
            type="button"
            variant="outline"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
            onClick={() => void handleDeleteExistingRelation(selectedRelation)}
            type="button"
            variant="outline"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => void openFragmentPreview(selectedRelation.source_fragment_id)}
            type="button"
            variant="outline"
          >
            Open Source
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => void openFragmentPreview(selectedRelation.target_fragment_id)}
            type="button"
            variant="outline"
          >
            Open Target
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            onClick={() => setSelectedRelation(null)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const relationEditDialog = editingRelation && relationEditDraft ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
      <div className="paper-panel w-full max-w-3xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Edit Relation</p>
        <h2 className="mt-2 font-serif text-2xl text-text">编辑已保存关系</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Relation Type</span>
            <select
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setRelationEditDraft((current) =>
                  current ? { ...current, relation_type: event.target.value as RelationType } : current,
                )
              }
              value={relationEditDraft.relation_type}
            >
              {relationTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Reason</span>
            <textarea
              className="min-h-[8rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setRelationEditDraft((current) =>
                  current ? { ...current, reason: event.target.value } : current,
                )
              }
              value={relationEditDraft.reason}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Confidence</span>
            <input
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              inputMode="decimal"
              onChange={(event) =>
                setRelationEditDraft((current) =>
                  current ? { ...current, confidence: event.target.value } : current,
                )
              }
              value={relationEditDraft.confidence}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={busy === "save-relation-edit"} onClick={() => void handleSaveEditedRelation()} type="button">
            Save Relation
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={busy === "save-relation-edit"}
            onClick={() => {
              setEditingRelation(null);
              setRelationEditDraft(null);
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const showNoRelationsState = !loading && savedRelations.length === 0;
  const showNoFilteredState = !loading && savedRelations.length > 0 && filteredRelations.length === 0;

  return (
    <section className="relative h-full">
      <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,122,77,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(139,94,60,0.12),transparent_24%),linear-gradient(180deg,rgba(255,249,240,0.24),rgba(255,255,255,0))]" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Research Islands</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1.35rem] border border-white/65 bg-white/72 text-primary shadow-paper">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-serif text-[2rem] tracking-[0.02em] text-text md:text-[2.35rem]">
                    Relations 关系
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-text/72">
                    把已保存的 relation 看成群岛之间的桥。主视觉应该先是地图，再是列表。
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/72 text-muted hover:bg-white/72" variant="secondary">
                {savedRelations.length} saved relations
              </Badge>
              <Badge className="bg-white/72 text-muted hover:bg-white/72" variant="secondary">
                {limitedGraph.visibleFragments.length} visible islands
              </Badge>
            </div>
          </div>

          {dbError ? (
            <div className="rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
              IndexedDB 初始化失败：{dbError}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
              {error}
            </div>
          ) : null}

          {analysisFeedback ? (
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Analysis Status</p>
                  <h2 className="mt-2 font-serif text-2xl text-text">{analysisFeedback.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-text/78">{analysisFeedback.detail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                    {analysisFeedback.scopeLabel}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {analysisFeedback.fragmentCount} fragments
                  </Badge>
                  {analysisFeedback.phase === "completed" ? (
                    <Badge className="bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.08)]">
                      {analysisFeedback.suggestionCount ?? 0} suggestions
                    </Badge>
                  ) : (
                    <Badge className="bg-white/74 text-primary hover:bg-white/74">
                      <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
                      Analyzing
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {reviewSuggestions.length > 0 ? (
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Review</p>
                  <h2 className="mt-2 font-serif text-2xl text-text">Relation Suggestions</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={() =>
                      setReviewSuggestions((current) =>
                        current.map((suggestion) =>
                          suggestion.confidence >= 0.75
                            ? { ...suggestion, review_status: "accepted" }
                            : suggestion,
                        ),
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Accept All High Confidence
                  </Button>
                  <Button className="rounded-full" disabled={busy === "save-relations"} onClick={() => void handleSaveAcceptedRelations()} type="button">
                    Save Accepted Relations
                  </Button>
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={() =>
                      setReviewSuggestions((current) =>
                        current.map((suggestion) => ({ ...suggestion, review_status: "rejected" })),
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    Reject All
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {reviewSuggestions.map((suggestion) => (
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
                                updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
                                updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
                                updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
                            updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
                            updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
                            updateReviewSuggestion(suggestion.temp_id, (current) => ({
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
          ) : null}

          <div className="relative min-h-[82vh] overflow-hidden rounded-[2rem] border border-white/58 bg-[linear-gradient(180deg,rgba(255,252,247,0.78),rgba(247,240,229,0.64))] shadow-paper">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(92,117,74,0.18),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(125,93,62,0.12),transparent_22%),radial-gradient(circle_at_46%_78%,rgba(112,129,86,0.12),transparent_20%),linear-gradient(180deg,rgba(255,251,245,0.42),rgba(255,255,255,0))]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(circle_at_center,rgba(103,122,84,0.12),transparent_62%)]" />

            <div className="absolute left-5 top-5 z-20 flex items-center gap-3 rounded-full border border-white/58 bg-[rgba(255,251,245,0.62)] px-4 py-3 shadow-paper backdrop-blur-sm">
              <div className="h-2.5 w-10 rounded-full bg-[linear-gradient(90deg,rgba(78,102,64,0.7),rgba(115,129,73,0.16))]" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Research Islands Map</p>
                <p className="mt-1 text-sm text-text/74">已保存关系，只在这里查看与整理。</p>
              </div>
            </div>

            <div className="absolute right-5 top-5 z-20 flex flex-wrap justify-end gap-2">
              <Button
                className="rounded-full border-white/70 bg-white/82 text-text shadow-paper hover:bg-white"
                onClick={() =>
                  setSummaryContext({
                    preferredMode: selectedCategoryIds.length > 0 || selectedTagIds.length > 0 ? "filters" : "all",
                    presetCategoryIds: selectedCategoryIds,
                    presetTagIds: selectedTagIds,
                  })
                }
                type="button"
                variant="outline"
              >
                <BrainCircuit className="mr-2 h-4 w-4" />
                Generate Summary
              </Button>
              <Button
                className="rounded-full border-white/70 bg-white/82 text-text shadow-paper hover:bg-white"
                onClick={() => setIsRelationListOpen(true)}
                type="button"
                variant="outline"
              >
                {isRelationListOpen ? <PanelRightClose className="mr-2 h-4 w-4" /> : <PanelRightOpen className="mr-2 h-4 w-4" />}
                Relation List
              </Button>
              <Button
                className="rounded-full bg-white/86 text-text shadow-paper hover:bg-white"
                onClick={() => openScopeModal()}
                type="button"
              >
                <GitBranchPlus className="mr-2 h-4 w-4" />
                New Relation Analysis
              </Button>
            </div>

            <div className="absolute inset-x-5 top-[5.5rem] z-20 flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-white/65 bg-[rgba(255,251,245,0.74)] px-3 py-2 shadow-paper backdrop-blur-md">
              <details className="group relative">
                <summary className="cursor-pointer list-none rounded-full border border-white/65 bg-white/72 px-3 py-2 text-sm text-text transition hover:bg-white">
                  Category
                  {selectedCategoryIds.length > 0 ? ` (${selectedCategoryIds.length})` : ""}
                </summary>
                <div className="absolute left-0 top-[calc(100%+0.55rem)] z-30 w-[18rem] rounded-[1.25rem] border border-white/70 bg-[rgba(255,251,245,0.96)] p-3 shadow-shell">
                  <div className="max-h-[16rem] space-y-2 overflow-auto pr-1">
                    {categoryOptions.map((category) => (
                      <button
                        key={category.id}
                        className={`flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2 text-left text-sm transition ${
                          selectedCategoryIds.includes(category.id)
                            ? "bg-primary text-white"
                            : "bg-white/68 text-text hover:bg-white"
                        }`}
                        onClick={() => toggleCategoryFilter(category.id)}
                        type="button"
                      >
                        <span>{category.name}</span>
                        <span className="text-[11px] opacity-70">{category.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </details>

              <details className="group relative">
                <summary className="cursor-pointer list-none rounded-full border border-white/65 bg-white/72 px-3 py-2 text-sm text-text transition hover:bg-white">
                  Tag
                  {selectedTagIds.length > 0 ? ` (${selectedTagIds.length})` : ""}
                </summary>
                <div className="absolute left-0 top-[calc(100%+0.55rem)] z-30 w-[20rem] rounded-[1.25rem] border border-white/70 bg-[rgba(255,251,245,0.96)] p-3 shadow-shell">
                  <div className="max-h-[16rem] space-y-2 overflow-auto pr-1">
                    {tagOptions.map((tagItem) => (
                      <button
                        key={tagItem.id}
                        className={`flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2 text-left text-sm transition ${
                          selectedTagIds.includes(tagItem.id)
                            ? "bg-[rgba(110,82,54,0.82)] text-white"
                            : "bg-white/68 text-text hover:bg-white"
                        }`}
                        onClick={() => toggleTagFilter(tagItem.id)}
                        type="button"
                      >
                        <span>#{tagItem.name}</span>
                        <span className="text-[11px] opacity-70">{tagItem.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </details>

              <select
                className="rounded-full border border-white/65 bg-white/72 px-3 py-2 text-sm text-text outline-none transition focus:border-primary/40"
                onChange={(event) => setRelationTypeFilter(event.target.value as RelationFilterValue)}
                value={relationTypeFilter}
              >
                {relationTypeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="w-full rounded-full border border-white/65 bg-white/72 px-10 py-2 text-sm text-text outline-none transition placeholder:text-muted focus:border-primary/40"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search fragment"
                  value={search}
                />
              </div>

              <Button
                className="rounded-full border-white/65 bg-white/72 text-text hover:bg-white"
                onClick={resetFilters}
                type="button"
                variant="outline"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset filters
              </Button>
            </div>

            <div className="absolute inset-x-0 bottom-0 top-[8.85rem] overflow-hidden" ref={mapViewportRef}>
              {showNoRelationsState ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="max-w-xl rounded-[1.8rem] bg-[rgba(255,251,245,0.74)] px-8 py-10 text-center shadow-paper">
                    <p className="font-serif text-3xl text-text">No relations yet.</p>
                    <p className="mt-4 text-sm leading-7 text-muted">
                      Select fragments and run Relation Analysis to build your research islands.
                    </p>
                    <div className="mt-6">
                      <Button className="rounded-full" onClick={() => openScopeModal()} type="button">
                        <GitBranchPlus className="mr-2 h-4 w-4" />
                        New Relation Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              ) : showNoFilteredState ? (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="max-w-xl rounded-[1.8rem] bg-[rgba(255,251,245,0.74)] px-8 py-10 text-center shadow-paper">
                    <p className="font-serif text-3xl text-text">No relations match the current filters.</p>
                    <div className="mt-6">
                      <Button
                        className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                        onClick={resetFilters}
                        type="button"
                        variant="outline"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset filters
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative h-full w-full">
                  {limitedGraph.tooMany ? (
                    <div className="absolute left-5 top-5 z-20 rounded-[1.35rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(255,251,245,0.88)] px-4 py-3 text-sm leading-6 text-muted shadow-paper">
                      Too many fragments to display. Please narrow down by category or tag.
                    </div>
                  ) : null}

                  <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
                    <defs>
                      <filter id="softEdgeGlow">
                        <feGaussianBlur stdDeviation="2.2" />
                      </filter>
                    </defs>

                    {mapEdges.map((edge) => (
                      <g key={edge.id}>
                        <path
                          d={edge.path}
                          fill="none"
                          filter="url(#softEdgeGlow)"
                          opacity={hoveredRelationId && hoveredRelationId !== edge.id ? 0.08 : 0.2}
                          stroke={hoveredRelationId === edge.id ? "rgba(90,109,70,0.52)" : "rgba(111,128,96,0.2)"}
                          strokeWidth={hoveredRelationId === edge.id ? 7.5 : 5.4}
                        />
                        <path
                          d={edge.path}
                          fill="none"
                          opacity={hoveredRelationId && hoveredRelationId !== edge.id ? 0.18 : 0.78}
                          stroke={hoveredRelationId === edge.id ? "rgba(83,100,64,0.92)" : "rgba(111,128,96,0.58)"}
                          strokeWidth={hoveredRelationId === edge.id ? 3.2 : 2.05}
                        />
                        <path
                          d={edge.path}
                          fill="none"
                          onClick={() => setSelectedRelation(edge.relation)}
                          stroke="transparent"
                          strokeWidth="16"
                          style={{ cursor: "pointer" }}
                        />
                      </g>
                    ))}
                  </svg>

                  <div className="pointer-events-none absolute inset-0 z-20">
                    {mapEdges.map((edge) => (
                      <button
                        key={`${edge.id}-label`}
                        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-[12px] font-medium tracking-[0.01em] shadow-paper transition ${
                          hoveredRelationId === edge.id
                            ? "border-white/80 bg-[rgba(76,97,57,0.88)] text-[rgba(255,251,245,0.96)]"
                            : "border-white/72 bg-[rgba(255,252,247,0.88)] text-text/78 hover:bg-white"
                        }`}
                        onClick={() => setSelectedRelation(edge.relation)}
                        onMouseEnter={() => {
                          clearHoverTimeout();
                          setHoveredRelationId(edge.id);
                        }}
                        onMouseLeave={() => scheduleHoverClear("relation")}
                        style={{
                          left: `${(edge.labelX / MAP_WIDTH) * 100}%`,
                          top: `${(edge.labelY / MAP_HEIGHT) * 100}%`,
                        }}
                        type="button"
                      >
                        {shortRelationLabel(edge.relation.relation_type)}
                      </button>
                    ))}
                  </div>

                  <div className="absolute inset-0 z-10">
                    {mapNodes.map((node) => {
                      const isHighlighted =
                        hoveredNodeId === node.id || highlightedNodeIds.has(node.id);
                      return (
                        <button
                          key={node.id}
                          className={`absolute w-[13.1rem] rounded-[2rem] px-4 py-4 text-left shadow-paper transition duration-300 ${
                            isHighlighted
                              ? "border border-white/78 bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(247,240,229,0.92))] scale-[1.025] shadow-[0_22px_42px_rgba(68,80,54,0.18)]"
                              : "border border-white/68 bg-[linear-gradient(180deg,rgba(255,252,246,0.92),rgba(247,240,229,0.82))] hover:scale-[1.015] hover:bg-white"
                          } ${dragState?.nodeId === node.id ? "cursor-grabbing" : "cursor-grab"}`}
                          onClick={() => {
                            if (suppressedClickNodeIdRef.current === node.id) {
                              suppressedClickNodeIdRef.current = null;
                              return;
                            }
                            void openFragmentPreview(node.id);
                          }}
                          onMouseEnter={() => {
                            clearHoverTimeout();
                            setHoveredNodeId(node.id);
                          }}
                          onMouseLeave={() => scheduleHoverClear("node")}
                          onPointerDown={(event) => {
                            dragMovedRef.current = false;
                            setDragState({
                              nodeId: node.id,
                              originX: node.x,
                              originY: node.y,
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                            });
                          }}
                          style={{
                            left: `${(node.x / MAP_WIDTH) * 100}%`,
                            top: `${(node.y / MAP_HEIGHT) * 100}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                          type="button"
                        >
                          <div className="mb-3 h-2.5 w-14 rounded-full bg-[linear-gradient(90deg,rgba(78,102,64,0.58),rgba(115,129,73,0.18))]" />
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-serif text-[1.14rem] leading-tight text-text">
                              {truncateText(node.fragment.title || "Untitled Fragment", 34)}
                            </p>
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">
                              {node.degree}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                            {truncateText(node.fragment.category_name ?? "Uncategorized", 20)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {node.fragment.tags.slice(0, 2).map((tagItem) => (
                              <span key={tagItem.id} className="rounded-full bg-white/72 px-2 py-1 text-[10px] text-muted">
                                #{tagItem.name}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {hoveredNode ? (
                    <div
                      className="absolute z-30 w-[18rem] rounded-[1.45rem] border border-white/75 bg-[rgba(255,250,244,0.94)] p-4 shadow-shell"
                      onMouseEnter={clearHoverTimeout}
                      onMouseLeave={() => scheduleHoverClear("node")}
                      style={{
                        left: `min(calc(${(hoveredNode.x / MAP_WIDTH) * 100}% + 6.5rem), calc(100% - 18.8rem))`,
                        top: `max(1rem, calc(${(hoveredNode.y / MAP_HEIGHT) * 100}% - 3rem))`,
                      }}
                    >
                      <p className="font-serif text-xl text-text">{hoveredNode.fragment.title}</p>
                      <p className="mt-2 text-sm leading-6 text-text/78">
                        {truncateText(hoveredNode.fragment.summary || hoveredNode.fragment.content, 150)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          {hoveredNode.fragment.category_name ?? "Uncategorized"}
                        </Badge>
                        <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                          {hoveredNode.relationCount} relations
                        </Badge>
                        <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                          {formatDate(hoveredNode.fragment.created_at)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {hoveredNode.fragment.tags.map((tagItem) => (
                          <span key={tagItem.id} className="rounded-full bg-white/78 px-2 py-1 text-[11px] text-muted">
                            #{tagItem.name}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Button className="rounded-full" onClick={() => void openFragmentPreview(hoveredNode.id)} type="button">
                          Open Fragment
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {hoveredEdge ? (
                    <div
                      className="pointer-events-none absolute z-30 w-[21rem] rounded-[1.45rem] border border-white/78 bg-[rgba(255,250,244,0.97)] p-4 shadow-shell"
                      style={{
                        left: `min(calc(${(hoveredEdge.labelX / MAP_WIDTH) * 100}% + 1rem), calc(100% - 18.8rem))`,
                        top: `max(1rem, calc(${(hoveredEdge.labelY / MAP_HEIGHT) * 100}% - 1rem))`,
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Relation Preview</p>
                      <p className="font-serif text-lg text-text">
                        {hoveredEdge.relation.source_fragment_title} → {hoveredEdge.relation.target_fragment_title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          {hoveredEdge.relation.relation_type}
                        </Badge>
                        <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                          confidence {formatConfidence(hoveredEdge.relation.confidence)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text/78">{hoveredEdge.relation.reason}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {scopeModal}
      {aiConfirmationDialog}
      {relationDetailDialog}
      {relationEditDialog}
      {isRelationListOpen ? (
        <div className="fixed inset-0 z-40 bg-[rgba(30,33,25,0.24)]" onClick={() => setIsRelationListOpen(false)}>
          <div
            className="paper-panel absolute right-0 top-0 flex h-full w-full max-w-[28rem] flex-col rounded-none border-l border-white/65 p-5 shadow-shell md:rounded-l-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Relation List</p>
                <h3 className="mt-2 font-serif text-2xl text-text">当前筛选结果</h3>
              </div>
              <Button
                className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                onClick={() => setIsRelationListOpen(false)}
                type="button"
                variant="outline"
              >
                <PanelRightClose className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>

            <div className="mt-5 flex-1 overflow-auto pr-1">
              <div className="space-y-3">
                {showNoRelationsState ? (
                  <div className="rounded-[1.5rem] bg-white/34 p-5 text-sm leading-6 text-muted">
                    当前还没有已保存关系。
                  </div>
                ) : showNoFilteredState ? (
                  <div className="rounded-[1.5rem] bg-white/34 p-5 text-sm leading-6 text-muted">
                    当前筛选条件下没有关系结果。
                  </div>
                ) : (
                  limitedGraph.visibleRelations.map((relation) => (
                    <article key={relation.id} className="rounded-[1.45rem] bg-white/52 p-4 shadow-paper">
                      <p className="font-serif text-lg leading-tight text-text">
                        {truncateText(relation.source_fragment_title, 22)} → {truncateText(relation.target_fragment_title, 22)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          {relation.relation_type}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text/76">
                        {truncateText(relation.reason, 110)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                          onClick={() => setSelectedRelation(relation)}
                          type="button"
                          variant="outline"
                        >
                          Open
                        </Button>
                        <Button
                          className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                          onClick={() => openRelationEditor(relation)}
                          type="button"
                          variant="outline"
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                          onClick={() => void handleDeleteExistingRelation(relation)}
                          type="button"
                          variant="outline"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {previewFragment ? (
        <div className="fixed inset-0 z-40 bg-[rgba(30,33,25,0.18)]" onClick={() => setPreviewFragment(null)}>
          <div
            className="paper-panel absolute right-0 top-0 flex h-full w-full max-w-[30rem] flex-col rounded-none border-l border-white/65 p-6 shadow-shell md:rounded-l-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Fragment Preview</p>
                <h3 className="mt-2 font-serif text-[2rem] leading-tight text-text">{previewFragment.title}</h3>
              </div>
              <Button
                className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                onClick={() => setPreviewFragment(null)}
                type="button"
                variant="outline"
              >
                Close
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                {previewFragment.category_name ?? "Uncategorized"}
              </Badge>
              <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                {limitedGraph.visibleRelations.filter(
                  (relation) =>
                    relation.source_fragment_id === previewFragment.id ||
                    relation.target_fragment_id === previewFragment.id,
                ).length} relations
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {previewFragment.tags.map((tagItem) => (
                <span key={tagItem.id} className="rounded-full bg-white/78 px-2 py-1 text-[11px] text-muted">
                  #{tagItem.name}
                </span>
              ))}
            </div>

            <div className="mt-5 flex-1 overflow-auto pr-1">
              <div className="rounded-[1.45rem] bg-white/56 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Summary</p>
                <p className="mt-2 text-sm leading-7 text-text/80">
                  {previewFragment.summary || "No summary yet."}
                </p>
              </div>

              <div className="mt-4 rounded-[1.45rem] bg-white/48 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Content Excerpt</p>
                <p className="mt-2 text-sm leading-7 text-text/78">
                  {truncateText(previewFragment.content, 640)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => onOpenFragment(previewFragment.id)} type="button">
                Open Full Fragment
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {summaryContext ? (
        <SummaryWorkflowModal
          initialContext={summaryContext}
          onClose={() => setSummaryContext(null)}
          onGoToRelationAnalysis={(seed) => {
            setSummaryContext(null);
            openScopeModal(seed);
          }}
          onSavedFragment={() => {
            setSummaryContext(null);
            void loadRelationsData();
          }}
          open
        />
      ) : null}
    </section>
  );
}
