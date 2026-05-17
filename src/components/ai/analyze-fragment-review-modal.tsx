import { Check, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AnalyzeFragmentReviewDraft = {
  suggested_title: string;
  summary: string;
  suggested_category: string;
  suggested_tags_text: string;
  detected_time_info_text: string;
  research_usage: string;
};

type AnalyzeFragmentReviewModalProps = {
  open: boolean;
  draft: AnalyzeFragmentReviewDraft | null;
  editable: boolean;
  submitting?: boolean;
  onAccept: () => void;
  onChange: (draft: AnalyzeFragmentReviewDraft) => void;
  onEdit: () => void;
  onReject: () => void;
};

export function AnalyzeFragmentReviewModal({
  open,
  draft,
  editable,
  submitting = false,
  onAccept,
  onChange,
  onEdit,
  onReject,
}: AnalyzeFragmentReviewModalProps) {
  if (!open || !draft) {
    return null;
  }

  const currentDraft = draft;

  function update<K extends keyof AnalyzeFragmentReviewDraft>(
    key: K,
    value: AnalyzeFragmentReviewDraft[K],
  ) {
    const nextDraft: AnalyzeFragmentReviewDraft = {
      suggested_title: currentDraft.suggested_title,
      summary: currentDraft.summary,
      suggested_category: currentDraft.suggested_category,
      suggested_tags_text: currentDraft.suggested_tags_text,
      detected_time_info_text: currentDraft.detected_time_info_text,
      research_usage: currentDraft.research_usage,
    };
    nextDraft[key] = value;
    onChange(nextDraft);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.42)] p-4">
      <div className="paper-panel w-full max-w-3xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">AI Review</p>
        <h2 className="mt-2 font-serif text-2xl text-text">审核 AI 分析结果</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          当前不会直接覆盖原数据。只有在你点击 `Accept All` 后，fragment、category 和 tags 才会真正写入本地数据库。
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Suggested Title</span>
            <input
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
              disabled={!editable}
              onChange={(event) => update("suggested_title", event.target.value)}
              value={currentDraft.suggested_title}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Summary</span>
            <textarea
              className="min-h-[8rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
              disabled={!editable}
              onChange={(event) => update("summary", event.target.value)}
              value={currentDraft.summary}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text">Suggested Category</span>
              <input
                className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!editable}
                onChange={(event) => update("suggested_category", event.target.value)}
                value={currentDraft.suggested_category}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-text">Suggested Tags</span>
              <input
                className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!editable}
                onChange={(event) => update("suggested_tags_text", event.target.value)}
                value={currentDraft.suggested_tags_text}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Detected Time Info</span>
            <textarea
              className="min-h-[5.5rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
              disabled={!editable}
              onChange={(event) => update("detected_time_info_text", event.target.value)}
              value={currentDraft.detected_time_info_text}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Research Usage</span>
            <textarea
              className="min-h-[6rem] rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-80"
              disabled={!editable}
              onChange={(event) => update("research_usage", event.target.value)}
              value={currentDraft.research_usage}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={submitting} onClick={onAccept} type="button">
            <Check className="mr-2 h-4 w-4" />
            Accept All
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={submitting}
            onClick={onEdit}
            type="button"
            variant="outline"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            {editable ? "Editing" : "Edit"}
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={submitting}
            onClick={onReject}
            type="button"
            variant="outline"
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
