import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HomePage() {
  return (
    <section className="relative h-full">
      <div className="relative flex min-h-[calc(100vh-4rem)] overflow-hidden rounded-[1.9rem] border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(145deg,rgba(61,80,46,0.96),rgba(49,65,38,0.94)_48%,rgba(88,63,42,0.92)_100%)] p-6 shadow-shell md:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(140,160,99,0.18),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(146,108,74,0.14),transparent_22%),radial-gradient(circle_at_50%_120%,rgba(235,222,196,0.08),transparent_34%)]" />
          <div className="absolute left-[14%] top-[18%] h-40 w-40 rounded-full border border-white/5 opacity-40" />
          <div className="absolute left-[18%] top-[22%] h-24 w-24 rounded-full border border-white/5 opacity-30" />
          <div className="absolute bottom-[14%] right-[11%] h-56 w-56 rounded-full border border-white/5 opacity-35" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(20,26,15,0.18))]" />
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="relative flex flex-1 items-center justify-center"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.32 }}
        >
          <div className="max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.8rem] border border-white/15 bg-white/8 text-[rgba(244,236,219,0.92)] shadow-paper backdrop-blur-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-[rgba(232,223,204,0.66)]">
              Fragment Isles
            </p>
            <h1 className="mt-5 font-serif text-5xl tracking-[0.03em] text-[rgba(248,242,231,0.96)] md:text-7xl">
              Fragment Isles
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[rgba(231,223,205,0.80)] md:text-xl md:leading-9">
              面向 AI 科研人的碎片信息工作台。
              <br />
              保存、连接并整理研究中的片段。
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
