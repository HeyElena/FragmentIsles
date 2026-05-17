import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Bot, KeyRound, Lock, Plus, Settings2, Tag, Trash2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  clearApiUsageLogs,
  getAIProviderSettings,
  getApiUsagePanelData,
  createCategory,
  saveAIProviderSettings,
  createTag,
  deleteCategory,
  deleteTag,
  getCategoryList,
  getCategoryOptions,
  getTagList,
  getTagOptions,
  mergeCategories,
  mergeTags,
  type AIProviderSettings,
  type ApiUsagePanelData,
  type CategoryInput,
  type CategoryListItem,
  type CategoryOption,
  type TagInput,
  type TagListItem,
  type TagOption,
  toggleTagLock,
  UNCATEGORIZED_CATEGORY_ID,
  updateCategory,
  updateTag,
} from "@/db";

type SettingsPageProps = {
  dbError: string | null;
};

type CategoryDraft = {
  name: string;
  description: string;
  rules: string;
};

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  rules: "",
};

type TagDraft = {
  name: string;
  description: string;
};

const emptyTagDraft: TagDraft = {
  name: "",
  description: "",
};

const emptyProviderDraft: AIProviderSettings = {
  api_base_url: "",
  api_key: "",
  model_name: "",
  input_token_price: 0,
  output_token_price: 0,
};

const emptyUsagePanel: ApiUsagePanelData = {
  today_calls: 0,
  today_tokens: 0,
  estimated_cost: 0,
  usage_by_feature: [],
};

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

export function SettingsPage({ dbError }: SettingsPageProps) {
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<CategoryDraft>(emptyDraft);
  const [createDraft, setCreateDraft] = useState<CategoryDraft>(emptyDraft);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [deleteMode, setDeleteMode] = useState<"uncategorized" | "move">("uncategorized");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<TagListItem[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagEditorDraft, setTagEditorDraft] = useState<TagDraft>(emptyTagDraft);
  const [createTagDraft, setCreateTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [mergeSourceTagId, setMergeSourceTagId] = useState("");
  const [mergeTargetTagId, setMergeTargetTagId] = useState("");
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(null);
  const [providerDraft, setProviderDraft] = useState<AIProviderSettings>(emptyProviderDraft);
  const [usagePanel, setUsagePanel] = useState<ApiUsagePanelData>(emptyUsagePanel);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) ?? null,
    [tags, selectedTagId],
  );

  async function loadCategories(preferredId?: string | null) {
    setLoading(true);
    setError(null);

    try {
      const [list, options] = await Promise.all([getCategoryList(), getCategoryOptions()]);
      setCategories(list);
      setCategoryOptions(options);

      const fallbackId = preferredId ?? selectedCategoryId ?? list[0]?.id ?? null;
      const nextSelected = list.find((category) => category.id === fallbackId) ?? list[0] ?? null;
      setSelectedCategoryId(nextSelected?.id ?? null);
      setEditorDraft(
        nextSelected
          ? {
              name: nextSelected.name,
              description: nextSelected.description,
              rules: nextSelected.rules,
            }
          : emptyDraft,
      );

      if (!mergeSourceId && list.length > 1) {
        const firstNonSystem = list.find((category) => !category.is_system);
        setMergeSourceId(firstNonSystem?.id ?? "");
      }
      if (!mergeTargetId && options.length > 0) {
        setMergeTargetId(options[0]?.id ?? "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "分类读取失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadTags(preferredId?: string | null) {
    try {
      const [list, options] = await Promise.all([getTagList(), getTagOptions()]);
      setTags(list);
      setTagOptions(options);

      const fallbackId = preferredId ?? selectedTagId ?? list[0]?.id ?? null;
      const nextSelected = list.find((tag) => tag.id === fallbackId) ?? list[0] ?? null;
      setSelectedTagId(nextSelected?.id ?? null);
      setTagEditorDraft(
        nextSelected
          ? {
              name: nextSelected.name,
              description: nextSelected.description,
            }
          : emptyTagDraft,
      );

      if (!mergeSourceTagId && list.length > 1) {
        setMergeSourceTagId(list[0]?.id ?? "");
      }
      if (!mergeTargetTagId && options.length > 1) {
        const nextTarget = options.find((tag) => tag.id !== (list[0]?.id ?? ""));
        setMergeTargetTagId(nextTarget?.id ?? "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "标签读取失败");
    }
  }

  async function loadAISettings() {
    try {
      const [provider, usage] = await Promise.all([
        getAIProviderSettings(),
        getApiUsagePanelData(),
      ]);
      setProviderDraft(provider);
      setUsagePanel(usage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI 设置读取失败");
    }
  }

  useEffect(() => {
    void Promise.all([loadCategories(), loadTags(), loadAISettings()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setEditorDraft({
        name: selectedCategory.name,
        description: selectedCategory.description,
        rules: selectedCategory.rules,
      });
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTag) {
      setTagEditorDraft({
        name: selectedTag.name,
        description: selectedTag.description,
      });
    }
  }, [selectedTag]);

  function toInput(draft: CategoryDraft): CategoryInput {
    return {
      name: draft.name,
      description: draft.description,
      rules: draft.rules,
    };
  }

  function toTagInput(draft: TagDraft): TagInput {
    return {
      name: draft.name,
      description: draft.description,
    };
  }

  async function handleSaveAIProvider() {
    setBusy("save-ai-provider");
    setError(null);

    try {
      await saveAIProviderSettings({
        api_base_url: providerDraft.api_base_url,
        api_key: providerDraft.api_key,
        model_name: providerDraft.model_name,
        input_token_price: Number(providerDraft.input_token_price) || 0,
        output_token_price: Number(providerDraft.output_token_price) || 0,
      });
      await loadAISettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存 AI Provider 失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleClearApiUsageLogs() {
    const confirmed = window.confirm("确认清空所有 API usage 历史记录？该操作不可撤销。");
    if (!confirmed) {
      return;
    }

    setBusy("clear-api-usage");
    setError(null);

    try {
      await clearApiUsageLogs();
      await loadAISettings();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "清空 API usage 失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateCategory() {
    setBusy("create");
    setError(null);

    try {
      const createdId = await createCategory(toInput(createDraft));
      setCreateDraft(emptyDraft);
      await loadCategories(createdId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新增分类失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveCategory() {
    if (!selectedCategoryId) {
      return;
    }

    setBusy("save");
    setError(null);

    try {
      await updateCategory(selectedCategoryId, toInput(editorDraft));
      await loadCategories(selectedCategoryId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存分类失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeCategories() {
    if (!mergeSourceId || !mergeTargetId) {
      setError("请选择需要合并的来源分类和目标分类。");
      return;
    }

    setBusy("merge");
    setError(null);

    try {
      await mergeCategories(mergeSourceId, mergeTargetId);
      setMergeSourceId("");
      await loadCategories(mergeTargetId);
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "合并分类失败");
    } finally {
      setBusy(null);
    }
  }

  function openDeleteDialog(categoryId: string) {
    setPendingDeleteCategoryId(categoryId);
    setDeleteMode("uncategorized");
    setDeleteTargetId("");
  }

  async function handleDeleteCategory() {
    if (!pendingDeleteCategoryId) {
      return;
    }

    setBusy("delete");
    setError(null);

    try {
      await deleteCategory(pendingDeleteCategoryId, {
        mode: deleteMode,
        targetCategoryId: deleteMode === "move" ? deleteTargetId : undefined,
      });
      setPendingDeleteCategoryId(null);
      await loadCategories(UNCATEGORIZED_CATEGORY_ID);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除分类失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateTag() {
    setBusy("create-tag");
    setError(null);

    try {
      const createdId = await createTag(toTagInput(createTagDraft));
      setCreateTagDraft(emptyTagDraft);
      await loadTags(createdId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新增标签失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTag() {
    if (!selectedTagId) {
      return;
    }

    setBusy("save-tag");
    setError(null);

    try {
      await updateTag(selectedTagId, toTagInput(tagEditorDraft));
      await loadTags(selectedTagId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存标签失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleTagLock(tagId: string, nextLocked: boolean) {
    setBusy("toggle-tag-lock");
    setError(null);

    try {
      await toggleTagLock(tagId, nextLocked);
      await loadTags(tagId);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "切换标签锁定状态失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeTags() {
    if (!mergeSourceTagId || !mergeTargetTagId) {
      setError("请选择需要合并的来源标签和目标标签。");
      return;
    }

    const sourceTag = tags.find((tag) => tag.id === mergeSourceTagId);
    const requiresConfirm = sourceTag?.is_user_locked ?? false;
    if (requiresConfirm) {
      const confirmed = window.confirm("来源标签已被锁定。确认仍要合并并删除该锁定标签吗？");
      if (!confirmed) {
        return;
      }
    }

    setBusy("merge-tag");
    setError(null);

    try {
      await mergeTags(mergeSourceTagId, mergeTargetTagId, requiresConfirm);
      setMergeSourceTagId("");
      await loadTags(mergeTargetTagId);
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "合并标签失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteTag() {
    if (!pendingDeleteTagId) {
      return;
    }

    const tag = tags.find((item) => item.id === pendingDeleteTagId);
    const requiresConfirm = tag?.is_user_locked ?? false;
    if (requiresConfirm) {
      const confirmed = window.confirm("该标签已被锁定。确认仍要删除这个锁定标签吗？");
      if (!confirmed) {
        return;
      }
    }

    setBusy("delete-tag");
    setError(null);

    try {
      await deleteTag(pendingDeleteTagId, requiresConfirm);
      setPendingDeleteTagId(null);
      await loadTags(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除标签失败");
    } finally {
      setBusy(null);
    }
  }

  const deleteCandidates = categoryOptions.filter(
    (category) => category.id !== pendingDeleteCategoryId,
  );

  return (
    <section className="relative h-full">
      <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(126,142,98,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(143,103,71,0.14),transparent_24%),linear-gradient(180deg,rgba(255,249,240,0.24),rgba(255,255,255,0))]" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-white/70 text-muted hover:bg-white/70">
                控制
              </Badge>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-white/65 bg-white/78 text-primary shadow-paper">
                  <Settings2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-serif text-3xl tracking-[0.02em] text-text md:text-4xl">
                    Settings 设置
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-text/75 md:text-base">
                    这里集中放置 AI Provider、本地 usage 可见性，以及分类与标签体系维护。
                  </p>
                </div>
              </div>
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

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">AI Provider</p>
                  <p className="mt-1 text-sm leading-6 text-text/80">
                    所有 AI 调用都从这里读取 provider 设置。当前阶段只做本地保存和 mock 调用。
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-text">API base URL</span>
                  <input
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) =>
                      setProviderDraft((current) => ({
                        ...current,
                        api_base_url: event.target.value,
                      }))
                    }
                    value={providerDraft.api_base_url}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-text">API key</span>
                  <input
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) =>
                      setProviderDraft((current) => ({
                        ...current,
                        api_key: event.target.value,
                      }))
                    }
                    type="password"
                    value={providerDraft.api_key}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-text">Model name</span>
                  <input
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) =>
                      setProviderDraft((current) => ({
                        ...current,
                        model_name: event.target.value,
                      }))
                    }
                    value={providerDraft.model_name}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-text">Input token price</span>
                    <input
                      className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                      inputMode="decimal"
                      onChange={(event) =>
                        setProviderDraft((current) => ({
                          ...current,
                          input_token_price: Number(event.target.value) || 0,
                        }))
                      }
                      value={providerDraft.input_token_price}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-text">Output token price</span>
                    <input
                      className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                      inputMode="decimal"
                      onChange={(event) =>
                        setProviderDraft((current) => ({
                          ...current,
                          output_token_price: Number(event.target.value) || 0,
                        }))
                      }
                      value={providerDraft.output_token_price}
                    />
                  </label>
                </div>

                <Button
                  className="rounded-full"
                  onClick={() => void handleSaveAIProvider()}
                  type="button"
                >
                  保存 AI Provider
                </Button>
              </div>
            </div>

            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">API Usage Panel</p>
                  <p className="mt-1 text-sm leading-6 text-text/80">
                    只展示显式触发的 AI mock 调用，没有任何后台隐藏调用。
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Today calls</p>
                  <p className="mt-3 font-serif text-3xl text-text">{usagePanel.today_calls}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Today tokens</p>
                  <p className="mt-3 font-serif text-3xl text-text">{usagePanel.today_tokens}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Estimated cost</p>
                  <p className="mt-3 font-serif text-3xl text-text">
                    {formatCost(usagePanel.estimated_cost)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Usage by feature</p>
                  <Button
                    className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                    disabled={busy === "clear-api-usage"}
                    onClick={() => void handleClearApiUsageLogs()}
                    type="button"
                    variant="outline"
                  >
                    清空历史记录
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {usagePanel.usage_by_feature.length === 0 ? (
                    <p className="text-sm leading-6 text-muted">今天还没有显式 AI 调用记录。</p>
                  ) : (
                    usagePanel.usage_by_feature.map((feature) => (
                      <div
                        key={feature.feature_name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-text">{feature.feature_name}</p>
                          <p className="mt-1 text-sm text-muted">
                            {feature.calls} calls · {feature.total_tokens} tokens
                          </p>
                        </div>
                        <p className="text-sm text-text">{formatCost(feature.estimated_cost)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Category List
                </p>
                <p className="text-sm text-muted">{categories.length} categories</p>
              </div>

              <div className="mt-4 grid gap-3">
                {loading ? (
                  <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5 text-sm text-muted">
                    正在读取分类…
                  </div>
                ) : (
                  categories.map((category) => (
                    <button
                      key={category.id}
                      className={`rounded-[1.6rem] border p-4 text-left shadow-paper transition ${
                        category.id === selectedCategoryId
                          ? "border-primary/30 bg-white/84"
                          : "border-white/70 bg-white/58 hover:bg-white/74"
                      }`}
                      onClick={() => setSelectedCategoryId(category.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-xl text-text">{category.name}</p>
                            {category.is_system ? (
                              <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                                system
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-text/76">
                            {category.description || "No description yet."}
                          </p>
                        </div>
                        {!category.is_system ? (
                          <Button
                            className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteDialog(category.id);
                            }}
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                        <span>{category.fragment_count} fragments</span>
                        <span>·</span>
                        <span>created by {category.created_by}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Add Category
                </p>
                <CategoryForm
                  actionLabel="新增分类"
                  draft={createDraft}
                  onAction={() => void handleCreateCategory()}
                  onChange={setCreateDraft}
                  submitting={busy === "create"}
                />
              </div>

              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Edit Category
                </p>
                {selectedCategory ? (
                  <CategoryForm
                    actionLabel="保存分类"
                    draft={editorDraft}
                    onAction={() => void handleSaveCategory()}
                    onChange={setEditorDraft}
                    readOnlyName={selectedCategory.is_system}
                    submitting={busy === "save"}
                  />
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted">请选择一个分类进行编辑。</p>
                )}
              </div>

              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                      Merge Categories
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text/80">
                      将来源分类中的 fragments 移动到目标分类，然后删除来源分类。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setMergeSourceId(event.target.value)}
                    value={mergeSourceId}
                  >
                    <option value="">选择来源分类</option>
                    {categories
                      .filter((category) => !category.is_system)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>

                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setMergeTargetId(event.target.value)}
                    value={mergeTargetId}
                  >
                    <option value="">选择目标分类</option>
                    {categoryOptions
                      .filter((category) => category.id !== mergeSourceId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>

                  <Button className="rounded-full" onClick={() => void handleMergeCategories()} type="button">
                    合并分类
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {pendingDeleteCategoryId ? (
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <p className="font-serif text-2xl text-text">Delete Category</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                删除分类前，需要决定当前分类中的 fragments 应该如何处理。
              </p>

              <div className="mt-4 grid gap-3">
                <label className="flex items-start gap-3 rounded-[1.3rem] border border-white/70 bg-white/58 p-4">
                  <input
                    checked={deleteMode === "uncategorized"}
                    name="delete-mode"
                    onChange={() => setDeleteMode("uncategorized")}
                    type="radio"
                  />
                  <div>
                    <p className="text-sm font-medium text-text">Move fragments to Uncategorized</p>
                    <p className="mt-1 text-sm leading-6 text-muted">fragment 不会丢失，只会移动到系统默认分类。</p>
                  </div>
                </label>

                <label className="rounded-[1.3rem] border border-white/70 bg-white/58 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      checked={deleteMode === "move"}
                      name="delete-mode"
                      onChange={() => setDeleteMode("move")}
                      type="radio"
                    />
                    <div className="w-full">
                      <p className="text-sm font-medium text-text">Move fragments to another category</p>
                      <p className="mt-1 text-sm leading-6 text-muted">选择一个已有分类作为新的归属。</p>
                      <select
                        className="mt-3 w-full rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                        disabled={deleteMode !== "move"}
                        onChange={(event) => setDeleteTargetId(event.target.value)}
                        value={deleteTargetId}
                      >
                        <option value="">选择目标分类</option>
                        {deleteCandidates.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="rounded-full" onClick={() => void handleDeleteCategory()} type="button">
                  确认删除
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() => setPendingDeleteCategoryId(null)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Tag List
                </p>
                <p className="text-sm text-muted">{tags.length} tags</p>
              </div>

              <div className="mt-4 grid gap-3">
                {loading ? (
                  <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-5 text-sm text-muted">
                    正在读取标签…
                  </div>
                ) : (
                  tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={`rounded-[1.6rem] border p-4 text-left shadow-paper transition ${
                        tag.id === selectedTagId
                          ? "border-primary/30 bg-white/84"
                          : "border-white/70 bg-white/58 hover:bg-white/74"
                      }`}
                      onClick={() => setSelectedTagId(tag.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-xl text-text">#{tag.name}</p>
                            {tag.is_user_locked ? (
                              <Badge className="bg-white/74 text-muted hover:bg-white/74" variant="secondary">
                                locked
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-text/76">
                            {tag.description || "No description yet."}
                          </p>
                        </div>
                        <Button
                          className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDeleteTagId(tag.id);
                          }}
                          type="button"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                        <span>{tag.fragment_count} fragments</span>
                        <span>·</span>
                        <span>created by {tag.created_by}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Add Tag
                </p>
                <TagForm
                  actionLabel="新增标签"
                  draft={createTagDraft}
                  onAction={() => void handleCreateTag()}
                  onChange={setCreateTagDraft}
                  submitting={busy === "create-tag"}
                />
              </div>

              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Edit Tag
                </p>
                {selectedTag ? (
                  <>
                    <TagForm
                      actionLabel="保存标签"
                      draft={tagEditorDraft}
                      onAction={() => void handleSaveTag()}
                      onChange={setTagEditorDraft}
                      submitting={busy === "save-tag"}
                    />
                    <div className="mt-4">
                      <Button
                        className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                        onClick={() => void handleToggleTagLock(selectedTag.id, !selectedTag.is_user_locked)}
                        type="button"
                        variant="outline"
                      >
                        {selectedTag.is_user_locked ? (
                          <>
                            <Unlock className="mr-2 h-4 w-4" />
                            Unlock Tag
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Lock Tag
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted">请选择一个标签进行编辑。</p>
                )}
              </div>

              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                      Merge Tags
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text/80">
                      将来源标签替换为目标标签，并去重 fragment 上的重复标签链接。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setMergeSourceTagId(event.target.value)}
                    value={mergeSourceTagId}
                  >
                    <option value="">选择来源标签</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                    onChange={(event) => setMergeTargetTagId(event.target.value)}
                    value={mergeTargetTagId}
                  >
                    <option value="">选择目标标签</option>
                    {tagOptions
                      .filter((tag) => tag.id !== mergeSourceTagId)
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>

                  <Button className="rounded-full" onClick={() => void handleMergeTags()} type="button">
                    合并标签
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {pendingDeleteTagId ? (
            <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
              <p className="font-serif text-2xl text-text">Delete Tag</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                删除标签只会移除标签本身和 fragment 的标签关联，不会删除 fragment 内容。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="rounded-full" onClick={() => void handleDeleteTag()} type="button">
                  确认删除
                </Button>
                <Button
                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                  onClick={() => setPendingDeleteTagId(null)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type TagFormProps = {
  actionLabel: string;
  draft: TagDraft;
  onAction: () => void;
  onChange: (draft: TagDraft) => void;
  submitting: boolean;
};

function TagForm({ actionLabel, draft, onAction, onChange, submitting }: TagFormProps) {
  function update<K extends keyof TagDraft>(key: K, value: TagDraft[K]) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Name</span>
        <div className="relative">
          <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-[1.2rem] border border-white/70 bg-white/70 px-11 py-3 text-sm text-text outline-none transition focus:border-primary/40"
            onChange={(event) => update("name", event.target.value)}
            value={draft.name}
          />
        </div>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Description</span>
        <textarea
          className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
          onChange={(event) => update("description", event.target.value)}
          value={draft.description}
        />
      </label>

      <Button className="rounded-full" disabled={submitting} onClick={onAction} type="button">
        <Plus className="mr-2 h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  );
}

type CategoryFormProps = {
  actionLabel: string;
  draft: CategoryDraft;
  onAction: () => void;
  onChange: (draft: CategoryDraft) => void;
  readOnlyName?: boolean;
  submitting: boolean;
};

function CategoryForm({
  actionLabel,
  draft,
  onAction,
  onChange,
  readOnlyName = false,
  submitting,
}: CategoryFormProps) {
  function update<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Name</span>
        <input
          className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={readOnlyName}
          onChange={(event) => update("name", event.target.value)}
          value={draft.name}
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Description</span>
        <textarea
          className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
          onChange={(event) => update("description", event.target.value)}
          value={draft.description}
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text">Rules</span>
        <textarea
          className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40"
          onChange={(event) => update("rules", event.target.value)}
          value={draft.rules}
        />
      </label>

      <Button className="rounded-full" disabled={submitting || (readOnlyName && actionLabel !== "保存分类")} onClick={onAction} type="button">
        <Plus className="mr-2 h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  );
}
