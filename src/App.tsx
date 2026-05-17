import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FragmentsPage } from "@/components/fragments/fragments-page";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/components/layout/home-page";
import { PageShell } from "@/components/layout/page-shell";
import { RelationsPage, type RelationAnalysisSeed } from "@/components/relations/relations-page";
import { SettingsPage } from "@/components/settings/settings-page";
import { TimelinePage } from "@/components/timeline/timeline-page";
import { allPages, type NavKey, sidebarPages } from "@/config/pages";
import { initializeDatabase } from "@/db";

export default function App() {
  const [activePage, setActivePage] = useState<NavKey>("home");
  const [dbError, setDbError] = useState<string | null>(null);
  const [requestedFragmentId, setRequestedFragmentId] = useState<string | null>(null);
  const [relationAnalysisSeed, setRelationAnalysisSeed] = useState<RelationAnalysisSeed | null>(null);
  const currentPage = allPages.find((item) => item.key === activePage) ?? allPages[0];

  useEffect(() => {
    let mounted = true;

    void initializeDatabase().catch((error: unknown) => {
      if (!mounted) {
        return;
      }

      setDbError(error instanceof Error ? error.message : "IndexedDB 初始化失败");
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppShell
      activePage={activePage}
      items={sidebarPages}
      onNavigate={(key) => setActivePage(key as NavKey)}
      onLogoClick={() => setActivePage("home")}
      sidebarCollapsed={activePage === "relations"}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage.key}
          animate={{ opacity: 1, y: 0 }}
          className="h-full"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {currentPage.key === "home" ? (
            <HomePage />
          ) : currentPage.key === "fragments" ? (
            <FragmentsPage
              dbError={dbError}
              onOpenRelationAnalysis={(seed) => {
                setRelationAnalysisSeed(seed);
                setActivePage("relations");
              }}
              onRequestedFragmentHandled={() => setRequestedFragmentId(null)}
              requestedFragmentId={requestedFragmentId}
            />
          ) : currentPage.key === "timeline" ? (
            <TimelinePage
              dbError={dbError}
              onOpenFragment={(fragmentId) => {
                setRequestedFragmentId(fragmentId);
                setActivePage("fragments");
              }}
            />
          ) : currentPage.key === "relations" ? (
            <RelationsPage
              dbError={dbError}
              initialAnalysisSeed={relationAnalysisSeed}
              onInitialAnalysisHandled={() => setRelationAnalysisSeed(null)}
              onOpenFragment={(fragmentId) => {
                setRequestedFragmentId(fragmentId);
                setActivePage("fragments");
              }}
            />
          ) : currentPage.key === "settings" ? (
            <SettingsPage dbError={dbError} />
          ) : (
            <PageShell
              accentClassName={currentPage.accent}
              blurb={currentPage.blurb}
              dbError={dbError}
              eyebrow={currentPage.eyebrow}
              icon={currentPage.icon}
              pageKey={currentPage.key}
              title={currentPage.label}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
