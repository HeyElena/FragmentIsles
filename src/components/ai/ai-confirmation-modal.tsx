import { BrainCircuit, Coins, FileStack, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AIConfirmationModalProps = {
  open: boolean;
  taskName: string;
  fragmentCount: number;
  estimatedInputLength: number;
  estimatedTokenUsage: number;
  estimatedCost: number;
  modelName: string;
  errorMessage?: string | null;
  running?: boolean;
  statusText?: string | null;
  onCancel: () => void;
  onStart: () => void;
};

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

export function AIConfirmationModal({
  open,
  taskName,
  fragmentCount,
  estimatedInputLength,
  estimatedTokenUsage,
  estimatedCost,
  modelName,
  errorMessage = null,
  running = false,
  statusText = null,
  onCancel,
  onStart,
}: AIConfirmationModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.38)] p-4">
      <div className="paper-panel w-full max-w-2xl rounded-[1.9rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">AI Confirmation</p>
        <h2 className="mt-2 font-serif text-2xl text-text">{taskName}</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          当前 AI 操作只会在你点击 Start 后执行。已接通的功能会调用你在 Settings 中配置的 provider，所有调用都会写入本地 usage log。
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <div className="flex items-center gap-2 text-muted">
              <FileStack className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.18em]">Fragments</p>
            </div>
            <p className="mt-3 font-serif text-3xl text-text">{fragmentCount}</p>
          </div>

          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <div className="flex items-center gap-2 text-muted">
              <BrainCircuit className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.18em]">Model</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-text">{modelName}</p>
          </div>

          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Estimated Input Length</p>
            <p className="mt-3 font-serif text-3xl text-text">{estimatedInputLength}</p>
          </div>

          <div className="rounded-[1.4rem] border border-white/70 bg-white/66 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Estimated Token Usage</p>
            <p className="mt-3 font-serif text-3xl text-text">{estimatedTokenUsage}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4">
          <div className="flex items-center gap-2 text-muted">
            <Coins className="h-4 w-4" />
            <p className="text-[11px] uppercase tracking-[0.18em]">Estimated Cost</p>
          </div>
          <p className="mt-3 font-serif text-3xl text-text">{formatCost(estimatedCost)}</p>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[1.4rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Error Response</p>
            <pre className="mt-3 max-h-[22rem] overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted">
              {errorMessage}
            </pre>
          </div>
        ) : null}

        {running && statusText ? (
          <div className="mt-4 rounded-[1.4rem] border border-primary/18 bg-primary/7 p-4">
            <div className="flex items-center gap-2 text-primary">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <p className="text-[11px] uppercase tracking-[0.18em]">Processing</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-text/82">{statusText}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={running} onClick={onStart} type="button">
            {running ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={running}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
