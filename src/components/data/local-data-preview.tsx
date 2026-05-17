import { useEffect, useState } from "react";
import type { NavKey } from "@/config/pages";
import {
  getDatabaseOverview,
  getLatestFragments,
  getLatestRelations,
  getSettingsPreview,
  getUpcomingReminders,
  type DatabaseOverview,
} from "@/db";

type LocalDataPreviewProps = {
  pageKey: Exclude<NavKey, "home">;
};

type PreviewState = {
  heading: string;
  items: string[];
};

const pageLabels: Record<Exclude<NavKey, "home">, keyof DatabaseOverview> = {
  fragments: "fragments",
  timeline: "reminders",
  relations: "relations",
  settings: "settings",
};

export function LocalDataPreview({ pageKey }: LocalDataPreviewProps) {
  const [overview, setOverview] = useState<DatabaseOverview | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        setError(null);
        const nextOverview = await getDatabaseOverview();

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);

        if (pageKey === "fragments") {
          const items = await getLatestFragments();
          if (!cancelled) {
            setPreview({
              heading: "Demo Fragments",
              items: items.map((item) => `${item.id} · ${item.title}`),
            });
          }
          return;
        }

        if (pageKey === "timeline") {
          const items = await getUpcomingReminders();
          if (!cancelled) {
            setPreview({
              heading: "Demo Reminders",
              items: items.map((item) => `${item.title} · ${item.event_time.slice(0, 10)}`),
            });
          }
          return;
        }

        if (pageKey === "relations") {
          const items = await getLatestRelations();
          if (!cancelled) {
            setPreview({
              heading: "Demo Relations",
              items: items.map(
                (item) =>
                  `${item.source_fragment_id} → ${item.target_fragment_id} · ${item.relation_type}`,
              ),
            });
          }
          return;
        }

        const items = await getSettingsPreview();
        if (!cancelled) {
          setPreview({
            heading: "Demo Settings",
            items: items.map((item) => `${item.key} · ${String(item.value)}`),
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "数据读取失败");
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  if (error) {
    return (
      <div className="rounded-[1.5rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-4">
        <p className="text-sm font-medium text-text">本地数据库状态</p>
        <p className="mt-2 text-sm leading-6 text-muted">IndexedDB 初始化失败：{error}</p>
      </div>
    );
  }

  if (!overview || !preview) {
    return (
      <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
        <p className="text-sm font-medium text-text">本地数据库状态</p>
        <p className="mt-2 text-sm leading-6 text-muted">正在读取 IndexedDB 与 demo 数据…</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4">
      <p className="text-sm font-medium text-text">本地数据库预览</p>
      <p className="mt-2 text-sm leading-6 text-muted">
        当前模块对应 demo 记录数：{overview[pageLabels[pageKey]]}
      </p>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-muted">
        {preview.heading}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-text/80">
        {preview.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
