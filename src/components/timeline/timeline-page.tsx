import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  Clock3,
  Leaf,
  PencilLine,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteReminder,
  getTimelineItems,
  getTimelineSummary,
  updateReminder,
  updateReminderStatus,
  type ReminderStatus,
  type TimelineFilter,
  type TimelineItem,
  type TimelineSummary,
} from "@/db";
import { cn } from "@/lib/utils";

type TimelinePageProps = {
  dbError: string | null;
  onOpenFragment: (fragmentId: string) => void;
};

type ReminderEditorDraft = {
  id: string;
  title: string;
  status: ReminderStatus;
  fragmentId: string;
  eventTime: string;
  remindAt: string[];
};

type TimelineGroup = {
  key: string;
  date: Date;
  items: TimelineItem[];
};

const summaryFallback: TimelineSummary = {
  next7Days: 0,
  next30Days: 0,
  noReminder: 0,
  completed: 0,
  expired: 0,
};

const filterOptions: Array<{ key: TimelineFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "no_reminder", label: "No Reminder" },
  { key: "completed", label: "Completed" },
  { key: "expired", label: "Expired" },
];

const statusOptions: ReminderStatus[] = ["active", "timeline_only", "completed", "dismissed"];

function formatEventDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimelineDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTimelineYear(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    weekday: "short",
  });
}

function getRelativeDayLabel(date: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff === 0) {
    return "Today";
  }

  if (dayDiff === 1) {
    return "Tomorrow";
  }

  if (dayDiff > 1 && dayDiff <= 7) {
    return `In ${dayDiff} days`;
  }

  if (dayDiff === -1) {
    return "Yesterday";
  }

  if (dayDiff < -1) {
    return `${Math.abs(dayDiff)} days ago`;
  }

  return "";
}

function getStatusLabel(status: ReminderStatus) {
  if (status === "active") {
    return "Upcoming";
  }

  if (status === "timeline_only") {
    return "No Reminder";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "dismissed") {
    return "Dismissed";
  }

  return "Expired";
}

function getStatusClassName(status: ReminderStatus) {
  if (status === "completed") {
    return "bg-[rgba(115,129,73,0.16)] text-primary hover:bg-[rgba(115,129,73,0.16)]";
  }

  if (status === "expired") {
    return "bg-[rgba(110,82,54,0.12)] text-accent hover:bg-[rgba(110,82,54,0.12)]";
  }

  if (status === "dismissed") {
    return "bg-white/70 text-muted hover:bg-white/70";
  }

  if (status === "timeline_only") {
    return "bg-[rgba(78,102,64,0.08)] text-text hover:bg-[rgba(78,102,64,0.08)]";
  }

  return "bg-primary/10 text-primary hover:bg-primary/10";
}

export function TimelinePage({ dbError, onOpenFragment }: TimelinePageProps) {
  const [summary, setSummary] = useState<TimelineSummary>(summaryFallback);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<ReminderEditorDraft | null>(null);

  const summaryCards = useMemo(
    () => [
      { label: "Next 7 days", value: summary.next7Days },
      { label: "Next 30 days", value: summary.next30Days },
      { label: "No Reminder", value: summary.noReminder },
      { label: "Completed", value: summary.completed },
      { label: "Expired", value: summary.expired },
    ],
    [summary],
  );

  const groupedItems = useMemo<TimelineGroup[]>(() => {
    const map = new Map<string, TimelineGroup>();

    for (const item of items) {
      const key = getDateKey(item.event_time);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }

      map.set(key, {
        key,
        date: new Date(item.event_time),
        items: [item],
      });
    }

    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [items]);

  async function loadTimeline(nextFilter = filter) {
    setLoading(true);
    setError(null);

    try {
      const [nextSummary, nextItems] = await Promise.all([
        getTimelineSummary(),
        getTimelineItems(nextFilter),
      ]);
      setSummary(nextSummary);
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Timeline 读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTimeline(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function openEditor(item: TimelineItem) {
    setEditorDraft({
      id: item.id,
      title: item.title,
      status: item.status,
      fragmentId: item.fragment_id,
      eventTime: item.event_time,
      remindAt: item.remind_at,
    });
  }

  async function handleSaveReminder() {
    if (!editorDraft) {
      return;
    }

    setBusy("save");
    setError(null);

    try {
      if (editorDraft.status === "active" && editorDraft.remindAt.length === 0) {
        throw new Error("当前没有提醒时间。请先从对应 Fragment 中设置提醒时间，再激活 Upcoming 状态。");
      }

      await updateReminder(editorDraft.id, {
        title: editorDraft.title,
        event_time: editorDraft.eventTime,
        remind_at: editorDraft.remindAt,
        status: editorDraft.status,
      });
      setEditorDraft(null);
      await loadTimeline(filter);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "提醒保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleSetStatus(reminderId: string, status: ReminderStatus) {
    setBusy(`${status}:${reminderId}`);
    setError(null);

    try {
      await updateReminderStatus(reminderId, status);
      await loadTimeline(filter);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "提醒状态更新失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteReminder(reminderId: string) {
    const confirmed = window.confirm("确认删除这条提醒事项？");
    if (!confirmed) {
      return;
    }

    setBusy(`delete:${reminderId}`);
    setError(null);

    try {
      await deleteReminder(reminderId);
      if (editorDraft?.id === reminderId) {
        setEditorDraft(null);
      }
      await loadTimeline(filter);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除提醒失败");
    } finally {
      setBusy(null);
    }
  }

  const editorDialog = editorDraft ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,33,25,0.38)] p-4">
      <div className="paper-panel w-full max-w-2xl rounded-[1.8rem] p-6 shadow-shell">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Edit Reminder</p>
        <h2 className="mt-2 font-serif text-2xl text-text">编辑提醒事项</h2>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text">Title</span>
            <input
              className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
              onChange={(event) =>
                setEditorDraft((current) => (current ? { ...current, title: event.target.value } : current))
              }
              value={editorDraft.title}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text">Event Time</span>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/58 px-4 py-3 text-sm text-text">
                {formatEventDate(editorDraft.eventTime)}
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-text">Status</span>
              <select
                className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text outline-none transition focus:border-primary/40"
                onChange={(event) =>
                  setEditorDraft((current) =>
                    current
                      ? { ...current, status: event.target.value as ReminderStatus }
                      : current,
                  )
                }
                value={editorDraft.status}
              >
                {statusOptions.map((status) => (
                  <option
                    disabled={status === "active" && editorDraft.remindAt.length === 0}
                    key={status}
                    value={status}
                  >
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-[1.4rem] border border-white/70 bg-white/58 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text">Reminder Times</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Timeline 里不直接改提醒时间，避免和来源 fragment 脱节。要修改时间，请打开对应 Fragment。
                </p>
              </div>
              <Button
                className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                onClick={() => onOpenFragment(editorDraft.fragmentId)}
                type="button"
                variant="outline"
              >
                打开来源 Fragment
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {editorDraft.remindAt.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-primary/20 bg-white/34 p-4 text-sm text-muted">
                  当前没有提醒时间，这条事项会被视为 No Reminder。
                </div>
              ) : (
                editorDraft.remindAt.map((value) => (
                  <div
                    key={value}
                    className="rounded-[1.2rem] border border-white/70 bg-white/70 px-4 py-3 text-sm text-text"
                  >
                    {formatEventDate(value)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-[rgba(78,102,64,0.12)] bg-[rgba(78,102,64,0.08)] p-4 text-sm leading-7 text-muted">
            `Upcoming` 只在已存在提醒时间时才可激活。如果这条事项当前是 `No Reminder`，请回到来源 Fragment 里重新设置提醒。
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="rounded-full" disabled={busy === "save"} onClick={() => void handleSaveReminder()} type="button">
            保存修改
          </Button>
          <Button
            className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
            disabled={busy === "save"}
            onClick={() => setEditorDraft(null)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <section className="relative h-full">
      <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(115,129,73,0.16),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(110,82,54,0.14),transparent_24%),linear-gradient(180deg,rgba(255,249,240,0.24),rgba(255,255,255,0))]" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-white/70 text-muted hover:bg-white/70">
                时间
              </Badge>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-white/65 bg-white/78 text-primary shadow-paper">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-serif text-3xl tracking-[0.02em] text-text md:text-4xl">
                    Timeline Inbox
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-text/75 md:text-base">
                    这里收拢所有带时间线索的研究事项。它更像一条安静的研究路径，而不是复杂的日历软件。
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/60 bg-white/44 px-4 py-3 text-sm leading-6 text-muted">
              只做本地 Timeline 管理，不做系统通知、日历同步或 AI 调用。
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <div key={card.label} className="paper-panel rounded-[1.6rem] p-4 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{card.label}</p>
                <p className="mt-3 font-serif text-3xl text-text">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    filter === option.key
                      ? "border-white/70 bg-white/82 text-text shadow-paper"
                      : "border-white/55 bg-white/48 text-muted hover:bg-white/66 hover:text-text",
                  )}
                  onClick={() => setFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
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

            <div className="relative mt-5">
              <div className="pointer-events-none absolute bottom-0 left-[5.9rem] top-2 hidden w-px bg-[linear-gradient(180deg,rgba(78,102,64,0.08),rgba(115,129,73,0.34),rgba(110,82,54,0.1))] md:block" />
              {loading ? (
                <div className="rounded-[1.6rem] border border-white/70 bg-white/58 p-6 text-sm text-muted">
                  正在读取本地 reminders…
                </div>
              ) : groupedItems.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-primary/25 bg-white/34 p-6 text-sm leading-6 text-muted">
                  当前筛选条件下没有时间事项。
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedItems.map((group) => (
                    <section
                      key={group.key}
                      className="grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-6"
                    >
                      <div className="relative min-w-0">
                        <div className="rounded-[1.2rem] border border-white/60 bg-white/42 px-3 py-2.5 shadow-paper md:border-none md:bg-transparent md:px-0 md:py-0 md:shadow-none">
                          <div className="flex items-center gap-3 md:block">
                            <div className="relative hidden md:block">
                              <div className="absolute right-[1.85rem] top-2.5 h-3 w-3 rounded-full border border-white/85 bg-[linear-gradient(180deg,rgba(78,102,64,0.96),rgba(115,129,73,0.86))] shadow-[0_0_0_5px_rgba(245,239,228,0.72)]" />
                            </div>
                            <div className="md:pr-[3.6rem] md:text-right">
                              <p className="font-serif text-[1.02rem] leading-none tracking-[0.01em] text-text">
                                {formatTimelineDay(group.date)}
                              </p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                                {formatTimelineYear(group.date)}
                              </p>
                              {getRelativeDayLabel(group.date) ? (
                                <p className="mt-2 text-[11px] leading-none text-primary/90">
                                  {getRelativeDayLabel(group.date)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {group.items.map((item) => (
                          <article
                            key={item.id}
                            className="relative rounded-[1.7rem] border border-white/70 bg-white/56 p-5 shadow-paper"
                          >
                            <div className="absolute -left-[2.45rem] top-8 hidden h-px w-9 bg-[linear-gradient(90deg,rgba(78,102,64,0.22),rgba(78,102,64,0.04))] md:block" />
                            <div className="absolute -left-[1.05rem] top-[1.58rem] hidden h-2.5 w-2.5 rounded-full border border-white/85 bg-surface-solid shadow-[0_0_0_4px_rgba(245,239,228,0.78)] md:block" />

                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="font-serif text-2xl text-text">{item.title}</h2>
                                  <Badge className={getStatusClassName(item.effective_status)}>
                                    {getStatusLabel(item.effective_status)}
                                  </Badge>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                                  <span className="inline-flex items-center gap-2">
                                    <Clock3 className="h-4 w-4" />
                                    {formatEventDate(item.event_time)}
                                  </span>
                                  <span className="inline-flex items-center gap-2">
                                    <Leaf className="h-4 w-4" />
                                    {item.source_fragment_title}
                                  </span>
                                </div>

                                <p className="mt-4 text-sm leading-7 text-text/80">{item.source_text}</p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {item.remind_at.length > 0 ? (
                                    item.remind_at.map((reminderTime) => (
                                      <Badge
                                        key={reminderTime}
                                        className="bg-white/72 text-muted hover:bg-white/72"
                                        variant="secondary"
                                      >
                                        Reminder {formatEventDate(reminderTime)}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge
                                      className="bg-white/72 text-muted hover:bg-white/72"
                                      variant="secondary"
                                    >
                                      No reminder time
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 xl:max-w-[22rem] xl:justify-end">
                                <Button
                                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                                  onClick={() => onOpenFragment(item.fragment_id)}
                                  type="button"
                                  variant="outline"
                                >
                                  <ArrowUpRight className="mr-2 h-4 w-4" />
                                  Open Fragment
                                </Button>
                                <Button
                                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                                  onClick={() => openEditor(item)}
                                  type="button"
                                  variant="outline"
                                >
                                  <PencilLine className="mr-2 h-4 w-4" />
                                  Edit Reminder
                                </Button>
                                <Button
                                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                                  disabled={busy === `completed:${item.id}`}
                                  onClick={() => void handleSetStatus(item.id, "completed")}
                                  type="button"
                                  variant="outline"
                                >
                                  <CheckCheck className="mr-2 h-4 w-4" />
                                  Mark Done
                                </Button>
                                <Button
                                  className="rounded-full border-white/65 bg-white/75 text-text hover:bg-white"
                                  disabled={busy === `dismissed:${item.id}`}
                                  onClick={() => void handleSetStatus(item.id, "dismissed")}
                                  type="button"
                                  variant="outline"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Dismiss
                                </Button>
                                <Button
                                  className="rounded-full border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] text-text hover:bg-[rgba(110,82,54,0.14)]"
                                  disabled={busy === `delete:${item.id}`}
                                  onClick={() => void handleDeleteReminder(item.id)}
                                  type="button"
                                  variant="outline"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {editorDialog}
    </section>
  );
}
