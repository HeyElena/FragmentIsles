import type { NavKey } from "@/config/pages";
import { LocalDataPreview } from "@/components/data/local-data-preview";
import { motion } from "framer-motion";
import { ArrowUpRight, Construction, Waves, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageShellProps = {
  accentClassName: string;
  blurb: string;
  dbError: string | null;
  eyebrow: string;
  icon: LucideIcon;
  pageKey: Exclude<NavKey, "home">;
  title: string;
};

export function PageShell({
  accentClassName,
  blurb,
  dbError,
  eyebrow,
  icon: Icon,
  pageKey,
  title,
}: PageShellProps) {
  return (
    <section className="relative h-full">
      <div className="glass-panel relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[1.9rem] p-4 shadow-shell md:p-6">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
            accentClassName,
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-isles-glow opacity-80" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl"
              initial={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <Badge className="mb-4 bg-white/70 text-muted hover:bg-white/70">
                {eyebrow}
              </Badge>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.6rem] border border-white/65 bg-white/78 text-primary shadow-paper">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-serif text-3xl tracking-[0.02em] text-text md:text-4xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-text/75 md:text-base">
                    {blurb}
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full bg-white/78 text-text shadow-paper hover:bg-white">
                当前阶段页面壳
              </Button>
              <Button
                className="rounded-full border-white/60 bg-transparent text-text hover:bg-white/45"
                variant="outline"
              >
                未来入口保留中
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="paper-panel relative overflow-hidden rounded-[1.8rem] p-6 shadow-paper"
              initial={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.32, delay: 0.05 }}
            >
              <div className="absolute right-4 top-4 flex items-center gap-2 text-muted/70">
                <Waves className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.24em]">
                  林间视图
                </span>
              </div>

              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                  占位页
                </p>
                <h2 className="mt-3 font-serif text-2xl text-text">
                  这个页面会在后续阶段逐步长成完整模块。
                </h2>
                <p className="mt-4 text-sm leading-7 text-text/75 md:text-base">
                  产品结构从一开始就保持完整可见，但具体工作流只会在对应阶段实现。当前它更像一张安静的研究桌面草图，而不是一个伪装成熟的后台页面。
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {["未来操作", "模块备注", "视觉锚点"].map((card) => (
                  <div
                    key={card}
                    className="rounded-[1.5rem] border border-white/70 bg-white/58 p-4"
                  >
                    <p className="text-sm font-medium text-text">{card}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      以占位形式保留导航与未来范围，不提前塞入不必要的假内容。
                    </p>
                  </div>
                ))}

                <LocalDataPreview pageKey={pageKey} />
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.32, delay: 0.1 }}
            >
              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Construction className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                      尚未实现
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text/80">
                      这个模块会始终作为一等入口存在，不会因为当前阶段未开发而被删除。
                    </p>
                  </div>
                </div>
              </div>

              <div className="paper-panel rounded-[1.8rem] p-5 shadow-paper">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  当前约束
                </p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-text/80">
                  <li>这一阶段已接入本地 IndexedDB 与 demo 数据。</li>
                  <li>这一阶段不实现真实 AI 调用与确认流。</li>
                  <li>这一阶段不接入 Tauri 或桌面打包。</li>
                </ul>
              </div>

              <div className="rounded-[1.9rem] border border-dashed border-primary/25 bg-white/34 p-5">
                <p className="font-serif text-lg text-text">森林意象</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  卡片像落在木桌与苔绿色背景上的研究纸页，导航像在林间小径中切换不同工作岛，整体保持轻、静、耐看。
                </p>
              </div>

              {dbError ? (
                <div className="rounded-[1.9rem] border border-[rgba(110,82,54,0.16)] bg-[rgba(110,82,54,0.08)] p-5">
                  <p className="font-serif text-lg text-text">数据库状态</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    IndexedDB 初始化失败：{dbError}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
