import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckSquare, Copy, Download, FileText, Link2, RotateCcw, Square, X } from "lucide-react";
import type { RelationAnalysisSeed } from "@/components/relations/relations-page";
import { AIConfirmationModal } from "@/components/ai/ai-confirmation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createFragment,
  getCategoryOptions,
  getFragments,
  getRelationsForFragment,
  getTagOptions,
  type CategoryOption,
  type FragmentListItem,
  type RelatedFragmentRelationItem,
  type TagOption,
} from "@/db";
import { buildMarkdownFilename, downloadMarkdownFile } from "@/lib/markdown-exporter";
import {
  estimateKeywordFragmentMatchingRequest,
  estimateMarkdownSummaryRequest,
  findMatchingFragmentsWithAI,
  generateMarkdownSummary,
  type AIEstimate,
  type AIFragmentPayload,
  type KeywordMatchedFragment,
} from "@/services/aiService";

type SummaryMode = "all" | "filters" | "related" | "keyword";

type SummaryOutputState = {
  fragments: FragmentListItem[];
  markdown: string;
  mode: SummaryMode;
};

type PendingSummaryAIAction = {
  estimate: AIEstimate;
  fragmentCount: number;
  startAction: () => Promise<void>;
  statusText?: string | null;
  taskName: string;
};

type SummaryWorkflowContext = {
  preferredMode?: SummaryMode;
  presetCategoryIds?: string[];
  presetSourceFragmentId?: string | null;
  presetTagIds?: string[];
};

type SummaryWorkflowModalProps = {
  initialContext?: SummaryWorkflowContext | null;
  onClose: () => void;
  onGoToRelationAnalysis?: (seed: RelationAnalysisSeed) => void;
  onSavedFragment?: (fragmentId: string) => void;
  open: boolean;
};

const summaryModeLabels: Record<SummaryMode, string> = {
  all: "Summarize All Fragments",
  filters: "Summarize by Category / Tag",
  keyword: "Keyword-based AI Matching and Summary",
  related: "Summarize Related Fragments of One Fragment",
};


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

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

function deriveSummaryTitle(markdown: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) {
    return heading;
  }

  return `Summary ${new Date().toLocaleDateString("zh-CN")}`;
}

export function SummaryWorkflowModal({
  initialContext = null,
  onClose,
  onGoToRelationAnalysis,
  onSavedFragment,
  open,
}: SummaryWorkflowModalProps) {
  const [fragments, setFragments] = useState<FragmentListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<SummaryMode>("all");

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSourceFragmentId, setSelectedSourceFragmentId] = useState("");
  const [relatedRelations, setRelatedRelations] = useState<RelatedFragmentRelationItem[]>([]);

  const [keywordQuery, setKeywordQuery] = useState("");
  const [keywordCategoryIds, setKeywordCategoryIds] = useState<string[]>([]);
  const [keywordTagIds, setKeywordTagIds] = useState<string[]>([]);
  const [timeRangeStart, setTimeRangeStart] = useState("");
  const [timeRangeEnd, setTimeRangeEnd] = useState("");
  const [maxKeywordFragments, setMaxKeywordFragments] = useState("8");
  const [matchedFragments, setMatchedFragments] = useState<KeywordMatchedFragment[]>([]);
  const [selectedMatchedFragmentIds, setSelectedMatchedFragmentIds] = useState<string[]>([]);
  const [manualAddFragmentId, setManualAddFragmentId] = useState("");
  const [isKeywordReviewOpen, setIsKeywordReviewOpen] = useState(false);

  const [summaryEstimate, setSummaryEstimate] = useState<AIEstimate | null>(null);
  const [keywordEstimate, setKeywordEstimate] = useState<AIEstimate | null>(null);
  const [pendingAIAction, setPendingAIAction] = useState<PendingSummaryAIAction | null>(null);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [aiActionError, setAIActionError] = useState<string | null>(null);

  const [outputState, setOutputState] = useState<SummaryOutputState | null>(null);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void Promise.all([getFragments(), getCategoryOptions(), getTagOptions()])
      .then(([nextFragments, nextCategories, nextTags]) => {
        if (!active) {
          return;
        }

        setFragments(nextFragments);
        setCategories(nextCategories);
        setTags(nextTags);
        setMode(initialContext?.preferredMode ?? "all");
        setSelectedCategoryIds(initialContext?.presetCategoryIds ?? []);
        setSelectedTagIds(initialContext?.presetTagIds ?? []);
        setSelectedSourceFragmentId(initialContext?.presetSourceFragmentId ?? "");
        setKeywordQuery("");
        setKeywordCategoryIds(initialContext?.presetCategoryIds ?? []);
        setKeywordTagIds(initialContext?.presetTagIds ?? []);
        setTimeRangeStart("");
        setTimeRangeEnd("");
        setMaxKeywordFragments("8");
        setMatchedFragments([]);
        setSelectedMatchedFragmentIds([]);
        setManualAddFragmentId("");
        setIsKeywordReviewOpen(false);
        setOutputState(null);
        setSummaryTitle("");
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Summary 数据读取失败");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialContext, open]);

  useEffect(() => {
    if (!open || mode !== "related" || !selectedSourceFragmentId) {
      setRelatedRelations([]);
      return;
    }

    let active = true;

    void getRelationsForFragment(selectedSourceFragmentId)
      .then((items) => {
        if (active) {
          setRelatedRelations(items);
        }
      })
      .catch((relationError) => {
        if (active) {
          setError(relationError instanceof Error ? relationError.message : "相关关系读取失败");
        }
      });

    return () => {
      active = false;
    };
  }, [mode, open, selectedSourceFragmentId]);

  const fragmentMap = useMemo(
    () => new Map(fragments.map((fragment) => [fragment.id, fragment])),
    [fragments],
  );

  const selectedSourceFragment = selectedSourceFragmentId
    ? fragmentMap.get(selectedSourceFragmentId) ?? null
    : null;

  const filterMatchedFragments = useMemo(() => {
    return fragments.filter((fragment) => {
      if (selectedCategoryIds.length > 0 && (!fragment.category_id || !selectedCategoryIds.includes(fragment.category_id))) {
        return false;
      }

      if (selectedTagIds.length > 0 && !fragment.tags.some((tag) => selectedTagIds.includes(tag.id))) {
        return false;
      }

      return true;
    });
  }, [fragments, selectedCategoryIds, selectedTagIds]);

  const relatedSummaryFragments = useMemo(() => {
    if (!selectedSourceFragmentId) {
      return [];
    }

    const relatedIds = [
      selectedSourceFragmentId,
      ...relatedRelations.map((relation) => relation.related_fragment_id),
    ];

    return [...new Set(relatedIds)]
      .map((fragmentId) => fragmentMap.get(fragmentId))
      .filter((fragment): fragment is FragmentListItem => Boolean(fragment));
  }, [fragmentMap, relatedRelations, selectedSourceFragmentId]);

  const keywordCandidateFragments = useMemo(() => {
    return fragments.filter((fragment) => {
      if (keywordCategoryIds.length > 0 && (!fragment.category_id || !keywordCategoryIds.includes(fragment.category_id))) {
        return false;
      }

      if (keywordTagIds.length > 0 && !fragment.tags.some((tag) => keywordTagIds.includes(tag.id))) {
        return false;
      }

      const createdAt = new Date(fragment.created_at).getTime();
      if (timeRangeStart) {
        const start = new Date(timeRangeStart).getTime();
        if (createdAt < start) {
          return false;
        }
      }

      if (timeRangeEnd) {
        const end = new Date(timeRangeEnd).getTime();
        if (createdAt > end) {
          return false;
        }
      }

      return true;
    });
  }, [fragments, keywordCategoryIds, keywordTagIds, timeRangeEnd, timeRangeStart]);

  const reviewedMatchedFragments = useMemo(() => {
    return selectedMatchedFragmentIds
      .map((fragmentId) => fragmentMap.get(fragmentId))
      .filter((fragment): fragment is FragmentListItem => Boolean(fragment));
  }, [fragmentMap, selectedMatchedFragmentIds]);

  const currentModeFragments = useMemo(() => {
    if (mode === "all") {
      return fragments;
    }

    if (mode === "filters") {
      return filterMatchedFragments;
    }

    if (mode === "related") {
      return relatedSummaryFragments;
    }

    return reviewedMatchedFragments;
  }, [filterMatchedFragments, fragments, mode, relatedSummaryFragments, reviewedMatchedFragments]);

  useEffect(() => {
    if (!open || mode === "keyword") {
      return;
    }

    let active = true;
    const sourceFragments = currentModeFragments;

    if (sourceFragments.length === 0) {
      setSummaryEstimate(null);
      return;
    }

    void estimateMarkdownSummaryRequest(
      sourceFragments.map(toAIFragmentPayload),
    )
      .then((estimate) => {
        if (active) {
          setSummaryEstimate(estimate);
        }
      })
      .catch((estimateError) => {
        if (active) {
          setError(estimateError instanceof Error ? estimateError.message : "Summary 预估失败");
        }
      });

    return () => {
      active = false;
    };
  }, [currentModeFragments, mode, open]);

  useEffect(() => {
    if (!open || mode !== "keyword" || !keywordQuery.trim() || keywordCandidateFragments.length === 0) {
      setKeywordEstimate(null);
      return;
    }

    let active = true;
    const timeRangeLabel =
      timeRangeStart || timeRangeEnd
        ? `${timeRangeStart || "…"} ~ ${timeRangeEnd || "…"}`
        : "";

    void estimateKeywordFragmentMatchingRequest(
      keywordCandidateFragments.map(toAIFragmentPayload),
      {
        categoryNames: categories
          .filter((category) => keywordCategoryIds.includes(category.id))
          .map((category) => category.name),
        maxFragments: Number(maxKeywordFragments) || 8,
        query: keywordQuery,
        tagNames: tags.filter((tag) => keywordTagIds.includes(tag.id)).map((tag) => tag.name),
        timeRangeLabel,
      },
    )
      .then((estimate) => {
        if (active) {
          setKeywordEstimate(estimate);
        }
      })
      .catch((estimateError) => {
        if (active) {
          setError(estimateError instanceof Error ? estimateError.message : "匹配预估失败");
        }
      });

    return () => {
      active = false;
    };
  }, [
    categories,
    keywordCandidateFragments,
    keywordCategoryIds,
    keywordQuery,
    keywordTagIds,
    maxKeywordFragments,
    mode,
    open,
    tags,
    timeRangeEnd,
    timeRangeStart,
  ]);

  function toggleMultiValue(current: string[], value: string) {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  function openConfirmation(action: PendingSummaryAIAction) {
    setError(null);
    setAIActionError(null);
    setPendingAIAction(action);
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

  async function openSummaryGeneration(selectedFragments: FragmentListItem[], summaryMode: SummaryMode) {
    if (selectedFragments.length === 0) {
      setError("当前模式下没有可用于总结的 fragments。");
      return;
    }

    const estimate = await estimateMarkdownSummaryRequest(
      selectedFragments.map(toAIFragmentPayload),
    );

    openConfirmation({
      estimate,
      fragmentCount: selectedFragments.length,
      startAction: async () => {
        const result = await generateMarkdownSummary(
          selectedFragments.map(toAIFragmentPayload),
        );
        setOutputState({
          fragments: selectedFragments,
          markdown: result.markdown,
          mode: summaryMode,
        });
        setSummaryTitle(deriveSummaryTitle(result.markdown));
      },
      statusText: "正在整理 fragments 并生成 Markdown Summary。生成完成后会进入可编辑输出页。",
      taskName: `Generate Markdown Summary · ${summaryModeLabels[summaryMode]}`,
    });
  }

  async function handleFindMatchingFragments() {
    if (!keywordQuery.trim()) {
      setError("请先输入关键词或研究问题。");
      return;
    }

    if (keywordCandidateFragments.length === 0) {
      setError("当前筛选范围内没有可供匹配的 fragments。");
      return;
    }

    const timeRangeLabel =
      timeRangeStart || timeRangeEnd
        ? `${timeRangeStart || "…"} ~ ${timeRangeEnd || "…"}`
        : "";

    const estimate =
      keywordEstimate ??
      (await estimateKeywordFragmentMatchingRequest(
        keywordCandidateFragments.map(toAIFragmentPayload),
        {
          categoryNames: categories
            .filter((category) => keywordCategoryIds.includes(category.id))
            .map((category) => category.name),
          maxFragments: Number(maxKeywordFragments) || 8,
          query: keywordQuery,
          tagNames: tags.filter((tag) => keywordTagIds.includes(tag.id)).map((tag) => tag.name),
          timeRangeLabel,
        },
      ));

    openConfirmation({
      estimate,
      fragmentCount: keywordCandidateFragments.length,
      startAction: async () => {
        const result = await findMatchingFragmentsWithAI(
          keywordCandidateFragments.map(toAIFragmentPayload),
          {
            categoryNames: categories
              .filter((category) => keywordCategoryIds.includes(category.id))
              .map((category) => category.name),
            maxFragments: Number(maxKeywordFragments) || 8,
            query: keywordQuery,
            tagNames: tags.filter((tag) => keywordTagIds.includes(tag.id)).map((tag) => tag.name),
            timeRangeLabel,
          },
        );
        setMatchedFragments(result.matches);
        setSelectedMatchedFragmentIds(result.matches.map((match) => match.fragment_id));
        setIsKeywordReviewOpen(true);
      },
      statusText: "正在用 AI 匹配与你的关键词最相关的 fragments。结果返回后需要你先 review。",
      taskName: "Find Matching Fragments with AI",
    });
  }

  async function handleSaveOutputAsFragment() {
    if (!outputState) {
      return;
    }

    setBusyAction("save-summary-fragment");
    setError(null);

    try {
      const fragmentId = await createFragment({
        title: summaryTitle.trim() || "Generated Summary",
        content: outputState.markdown,
        content_type: "markdown",
        source_type: "generated_summary",
        source_url: null,
        category_id: null,
        summary: truncateText(outputState.markdown, 180),
        tag_names: [],
      });
      onSavedFragment?.(fragmentId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存 summary fragment 失败");
    } finally {
      setBusyAction(null);
    }
  }

  if (!open) {
    return null;
  }

  const sourceFragmentRelationTypes = [...new Set(relatedRelations.map((relation) => relation.relation_type))];
  const emptyRelatedState =
    mode === "related" &&
    selectedSourceFragmentId &&
    !loading &&
    relatedRelations.length === 0;

  const keywordMatchReasonMap = new Map(matchedFragments.map((item) => [item.fragment_id, item]));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
        <div className="paper-panel flex max-h-[92vh] w-full max-w-6xl flex-col rounded-[1.95rem] p-6 shadow-shell">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Markdown Summary</p>
              <h2 className="mt-2 font-serif text-3xl text-text">Research Digest / Markdown Summary</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
                所有总结都必须手动触发。涉及 AI 匹配或总结时，会先显示成本确认，再执行。
              </p>
            </div>
            <Button
              className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>

          {error ? (
            <div className="mt-4 rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4 text-sm leading-6 text-muted">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-[1.6rem] border border-white/70 bg-white/58 p-6 text-sm text-muted">
              正在读取 summary 所需的本地 fragments / categories / tags…
            </div>
          ) : outputState ? (
            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Output Meta</p>
                  <label className="mt-3 grid gap-2">
                    <span className="text-sm font-medium text-text">Summary Title</span>
                    <input
                      className="rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                      onChange={(event) => setSummaryTitle(event.target.value)}
                      value={summaryTitle}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                      {summaryModeLabels[outputState.mode]}
                    </Badge>
                    <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                      {outputState.fragments.length} fragments
                    </Badge>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Markdown Editor</p>
                  <textarea
                    className="mt-3 min-h-[26rem] w-full rounded-[1.3rem] border border-white/70 bg-white/74 px-4 py-4 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
                    onChange={(event) =>
                      setOutputState((current) =>
                        current ? { ...current, markdown: event.target.value } : current,
                      )
                    }
                    value={outputState.markdown}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => void navigator.clipboard.writeText(outputState.markdown)}
                  type="button"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Markdown
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  disabled={busyAction === "save-summary-fragment"}
                  onClick={() => void handleSaveOutputAsFragment()}
                  type="button"
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Save as Fragment
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() =>
                    downloadMarkdownFile(
                      buildMarkdownFilename(summaryTitle),
                      outputState.markdown,
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export .md
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() => void openSummaryGeneration(outputState.fragments, outputState.mode)}
                  type="button"
                  variant="outline"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </div>
          ) : isKeywordReviewOpen ? (
            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Review Matched Fragments</p>
                <h3 className="mt-2 font-serif text-2xl text-text">AI 已返回匹配结果</h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  你可以保留、取消或手动添加 fragments。确认后才会进入总结生成。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {selectedMatchedFragmentIds.length} selected
                  </Badge>
                  <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                    {matchedFragments.length} matched by AI
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[1.45rem] border border-white/70 bg-white/58 p-4">
                <select
                  className="min-w-0 flex-1 rounded-[1.1rem] border border-white/70 bg-white/74 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                  onChange={(event) => setManualAddFragmentId(event.target.value)}
                  value={manualAddFragmentId}
                >
                  <option value="">手动添加 fragment</option>
                  {fragments
                    .filter((fragment) => !selectedMatchedFragmentIds.includes(fragment.id))
                    .map((fragment) => (
                      <option key={fragment.id} value={fragment.id}>
                        {fragment.title}
                      </option>
                    ))}
                </select>
                <Button
                  className="rounded-full"
                  disabled={!manualAddFragmentId}
                  onClick={() => {
                    if (!manualAddFragmentId) {
                      return;
                    }
                    setSelectedMatchedFragmentIds((current) =>
                      current.includes(manualAddFragmentId) ? current : [...current, manualAddFragmentId],
                    );
                    setManualAddFragmentId("");
                  }}
                  type="button"
                >
                  Add Fragment
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                {reviewedMatchedFragments.map((fragment) => {
                  const match = keywordMatchReasonMap.get(fragment.id);
                  const selected = selectedMatchedFragmentIds.includes(fragment.id);

                  return (
                    <article key={fragment.id} className="rounded-[1.45rem] border border-white/70 bg-white/58 p-4 shadow-paper">
                      <div className="flex items-start gap-3">
                        <button
                          className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/74 text-primary transition hover:bg-white"
                          onClick={() =>
                            setSelectedMatchedFragmentIds((current) =>
                              current.includes(fragment.id)
                                ? current.filter((item) => item !== fragment.id)
                                : [...current, fragment.id],
                            )
                          }
                          type="button"
                        >
                          {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-xl text-text">{fragment.title}</p>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              {fragment.category_name ?? "Uncategorized"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-text/78">
                            {truncateText(fragment.summary || fragment.content, 180)}
                          </p>
                          {match ? (
                            <div className="mt-3 rounded-[1.15rem] bg-white/58 px-3.5 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Matching Reason</p>
                              <p className="mt-1.5 text-[13px] leading-6 text-text/80">{match.reason}</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => void openSummaryGeneration(reviewedMatchedFragments, "keyword")}
                  type="button"
                >
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Generate Summary
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() => {
                    setIsKeywordReviewOpen(false);
                    setMatchedFragments([]);
                    setSelectedMatchedFragmentIds([]);
                  }}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(summaryModeLabels) as SummaryMode[]).map((modeKey) => (
                  <button
                    key={modeKey}
                    className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                      mode === modeKey
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-white/70 bg-white/58 text-text hover:bg-white/74"
                    }`}
                    onClick={() => setMode(modeKey)}
                    type="button"
                  >
                    <p className="font-medium">{summaryModeLabels[modeKey]}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-[1.6rem] border border-white/70 bg-white/58 p-5">
                {mode === "all" ? (
                  <div>
                    <p className="text-sm leading-7 text-muted">总结当前数据库中的所有 fragments。</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {fragments.length} fragments
                      </Badge>
                      {summaryEstimate ? (
                        <>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {summaryEstimate.estimatedTokenUsage} tokens
                          </Badge>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {formatCost(summaryEstimate.estimatedCost)}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {mode === "filters" ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-muted">选择一个或多个 category / tag，再总结这个范围内的 fragments。</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-text">Category selector</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <button
                              key={category.id}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                selectedCategoryIds.includes(category.id)
                                  ? "border-primary/25 bg-primary/10 text-primary"
                                  : "border-white/70 bg-white/72 text-text hover:bg-white"
                              }`}
                              onClick={() =>
                                setSelectedCategoryIds((current) => toggleMultiValue(current, category.id))
                              }
                              type="button"
                            >
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">Tag selector</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <button
                              key={tag.id}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                selectedTagIds.includes(tag.id)
                                  ? "border-primary/25 bg-primary/10 text-primary"
                                  : "border-white/70 bg-white/72 text-text hover:bg-white"
                              }`}
                              onClick={() =>
                                setSelectedTagIds((current) => toggleMultiValue(current, tag.id))
                              }
                              type="button"
                            >
                              #{tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {filterMatchedFragments.length} matched fragments
                      </Badge>
                      {summaryEstimate ? (
                        <>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {summaryEstimate.estimatedTokenUsage} tokens
                          </Badge>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {formatCost(summaryEstimate.estimatedCost)}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {filterMatchedFragments.slice(0, 5).map((fragment) => (
                        <div key={fragment.id} className="rounded-[1.1rem] bg-white/58 px-3.5 py-3 text-sm text-text/80">
                          {fragment.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {mode === "related" ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-muted">选择一个 fragment，总结与它已保存相关的 fragments。</p>
                    <select
                      className="w-full rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                      onChange={(event) => setSelectedSourceFragmentId(event.target.value)}
                      value={selectedSourceFragmentId}
                    >
                      <option value="">Select one fragment</option>
                      {fragments.map((fragment) => (
                        <option key={fragment.id} value={fragment.id}>
                          {fragment.title}
                        </option>
                      ))}
                    </select>

                    {emptyRelatedState ? (
                      <div className="rounded-[1.4rem] border border-dashed border-primary/25 bg-white/40 p-5">
                        <p className="font-serif text-[1.35rem] text-text">No saved related fragments found.</p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          You can run Relation Analysis first.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            className="rounded-full"
                            onClick={() => {
                              if (!selectedSourceFragmentId) {
                                return;
                              }
                              onClose();
                              onGoToRelationAnalysis?.({
                                currentFragmentId: selectedSourceFragmentId,
                                selectedFragmentIds: [selectedSourceFragmentId],
                              });
                            }}
                            type="button"
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Go to Relation Analysis
                          </Button>
                          <Button
                            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                            onClick={onClose}
                            type="button"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {selectedSourceFragment ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              {selectedSourceFragment.title}
                            </Badge>
                          ) : null}
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {Math.max(0, relatedSummaryFragments.length - (selectedSourceFragmentId ? 1 : 0))} related fragments
                          </Badge>
                          {summaryEstimate ? (
                            <>
                              <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                                {summaryEstimate.estimatedTokenUsage} tokens
                              </Badge>
                              <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                                {formatCost(summaryEstimate.estimatedCost)}
                              </Badge>
                            </>
                          ) : null}
                        </div>
                        {sourceFragmentRelationTypes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {sourceFragmentRelationTypes.map((type) => (
                              <Badge key={type} className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          {relatedSummaryFragments.map((fragment) => (
                            <div key={fragment.id} className="rounded-[1.1rem] bg-white/58 px-3.5 py-3 text-sm text-text/80">
                              {fragment.title}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {mode === "keyword" ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-muted">输入关键词或研究问题，让 AI 匹配相关 fragments。匹配结果必须先 review，不能直接进入总结。</p>
                    <textarea
                      className="min-h-[6rem] w-full rounded-[1.2rem] border border-white/70 bg-white/72 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
                      onChange={(event) => setKeywordQuery(event.target.value)}
                      placeholder="Describe your research question or keywords."
                      value={keywordQuery}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-text">Category</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <button
                              key={category.id}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                keywordCategoryIds.includes(category.id)
                                  ? "border-primary/25 bg-primary/10 text-primary"
                                  : "border-white/70 bg-white/72 text-text hover:bg-white"
                              }`}
                              onClick={() =>
                                setKeywordCategoryIds((current) => toggleMultiValue(current, category.id))
                              }
                              type="button"
                            >
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">Tag</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <button
                              key={tag.id}
                              className={`rounded-full border px-3 py-2 text-sm transition ${
                                keywordTagIds.includes(tag.id)
                                  ? "border-primary/25 bg-primary/10 text-primary"
                                  : "border-white/70 bg-white/72 text-text hover:bg-white"
                              }`}
                              onClick={() =>
                                setKeywordTagIds((current) => toggleMultiValue(current, tag.id))
                              }
                              type="button"
                            >
                              #{tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-text">Time Range Start</span>
                        <input
                          className="rounded-[1.1rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                          onChange={(event) => setTimeRangeStart(event.target.value)}
                          type="date"
                          value={timeRangeStart}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-text">Time Range End</span>
                        <input
                          className="rounded-[1.1rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                          onChange={(event) => setTimeRangeEnd(event.target.value)}
                          type="date"
                          value={timeRangeEnd}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-text">Max fragments to include</span>
                        <input
                          className="rounded-[1.1rem] border border-white/70 bg-white/72 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                          inputMode="numeric"
                          onChange={(event) => setMaxKeywordFragments(event.target.value)}
                          value={maxKeywordFragments}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {keywordCandidateFragments.length} candidate fragments
                      </Badge>
                      {keywordEstimate ? (
                        <>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {keywordEstimate.estimatedTokenUsage} tokens
                          </Badge>
                          <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                            {formatCost(keywordEstimate.estimatedCost)}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                    <Button className="rounded-full" onClick={() => void handleFindMatchingFragments()} type="button">
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      Find Matching Fragments with AI
                    </Button>
                  </div>
                ) : null}
              </div>

              {mode !== "keyword" && !emptyRelatedState ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    onClick={() => void openSummaryGeneration(currentModeFragments, mode)}
                    type="button"
                  >
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Continue
                  </Button>
                  <Button
                    className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                    onClick={onClose}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {pendingAIAction ? (
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
          statusText={pendingAIAction.statusText}
          taskName={pendingAIAction.taskName}
        />
      ) : null}
    </>
  );
}
