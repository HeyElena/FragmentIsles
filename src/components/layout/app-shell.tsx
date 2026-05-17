import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Menu, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  eyebrow: string;
};

type AppShellProps = {
  activePage: NavItem["key"];
  children: ReactNode;
  items: NavItem[];
  onNavigate: (key: NavItem["key"]) => void;
  onLogoClick: () => void;
  sidebarCollapsed?: boolean;
};

export function AppShell({
  activePage,
  children,
  items,
  onNavigate,
  onLogoClick,
  sidebarCollapsed = false,
}: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ y: [0, -14, 0], x: [0, 8, 0] }}
          className="absolute left-[-4rem] top-[8rem] h-48 w-48 rounded-full bg-[#6E5236]/22 blur-3xl"
          transition={{ duration: 11, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
          className="absolute right-[8%] top-[10%] h-60 w-60 rounded-full bg-[#4E6640]/20 blur-3xl"
          transition={{ duration: 13, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          animate={{ y: [0, -12, 0] }}
          className="absolute bottom-[8%] left-[24%] h-44 w-44 rounded-full bg-[#738149]/18 blur-3xl"
          transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      <div className="relative mx-auto flex max-w-[1680px] min-h-[calc(100vh-2rem)] gap-4 rounded-[2rem] border border-white/55 bg-white/30 p-3 shadow-shell backdrop-blur-xl md:gap-5 md:p-4">
        <aside className={cn(
          "glass-panel flex shrink-0 flex-col rounded-[1.7rem] text-text max-md:hidden",
          sidebarCollapsed ? "w-[108px] p-3.5" : "w-[280px] p-5",
        )}>
          <div className="mb-8">
            <button
              className={cn(
                "mb-3 flex rounded-[1.4rem] p-1 text-left transition hover:bg-white/35",
                sidebarCollapsed ? "justify-center" : "items-center gap-3",
              )}
              onClick={onLogoClick}
              type="button"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/60 text-primary shadow-paper">
                <Sparkles className="h-5 w-5" />
              </div>
              {!sidebarCollapsed ? (
                <div>
                  <p className="font-serif text-xl tracking-[0.06em] text-text">
                    Fragment Isles
                  </p>
                  <p className="text-sm text-muted">
                    整理思绪，激发灵感。
                  </p>
                </div>
              ) : null}
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-2">
            {items.map((item, index) => {
              const Icon = item.icon;
              const isActive = item.key === activePage;

              return (
                <motion.button
                  key={item.key}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.4rem] px-4 py-3.5 text-left transition",
                    isActive
                      ? "bg-white/72 shadow-paper"
                      : "hover:bg-white/45",
                  )}
                  initial={{ opacity: 0, x: -12 }}
                  onClick={() => onNavigate(item.key)}
                  transition={{ delay: index * 0.04, duration: 0.25 }}
                  type="button"
                >
                  <span
                    className={cn(
                      "absolute inset-y-3 left-2 w-1 rounded-full bg-primary/60 transition",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className={cn("flex", sidebarCollapsed ? "justify-center" : "items-start gap-3")}>
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition",
                        isActive
                          ? "border-white/70 bg-white/80 text-primary"
                          : "border-transparent bg-white/35 text-muted group-hover:bg-white/60 group-hover:text-primary",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    {!sidebarCollapsed ? (
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                          {item.eyebrow}
                        </p>
                        <p className="mt-1 font-medium text-text">{item.label}</p>
                      </div>
                    ) : null}
                  </div>
                </motion.button>
              );
            })}
          </nav>

        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-panel mb-4 flex items-center justify-between rounded-[1.7rem] px-5 py-4 md:hidden">
            <div>
              <button
                className="rounded-lg text-left transition hover:text-primary"
                onClick={onLogoClick}
                type="button"
              >
                <p className="font-serif text-xl text-text">Fragment Isles</p>
              </button>
              <p className="text-sm text-muted">科研碎片工作台</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-primary shadow-paper">
              <Menu className="h-5 w-5" />
            </div>
          </header>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {items.map((item) => {
              const isActive = item.key === activePage;

              return (
                <button
                  key={item.key}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm whitespace-nowrap transition",
                    isActive
                      ? "border-white/70 bg-white/80 text-text shadow-paper"
                      : "border-white/45 bg-white/40 text-muted",
                  )}
                  onClick={() => onNavigate(item.key)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <main className="min-h-[calc(100vh-4rem)] flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
