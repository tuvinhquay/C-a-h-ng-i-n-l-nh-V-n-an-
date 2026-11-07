import { BookOpen, ChevronDown, CircleHelp } from "lucide-react";
import type { Nav } from "@/lib/nav";
import { GUIDE_TOPICS } from "@/lib/help";
import { Button } from "@/components/ui";

export function GuideScreen({ nav }: { nav: Nav }) {
  return (
    <div className="space-y-5">
      <section className="glass glass-orange rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-copper/30 bg-copper-soft text-copper">
            <BookOpen className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-copper">
              Trung tâm trợ giúp
            </p>
            <h2 className="mt-1 text-2xl font-bold">Hướng dẫn sử dụng</h2>
            <p className="mt-2 text-sm text-muted">
              Chọn một mục để xem các bước. Bạn cũng có thể mở biểu tượng robot ở mọi màn hình và
              hỏi bằng lời tự nhiên.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Các chủ đề hướng dẫn">
        {GUIDE_TOPICS.map((topic) => (
          <details key={topic.id} className="glass group rounded-2xl p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine">
                <CircleHelp className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-muted">{topic.category}</span>
                <span className="block font-bold text-ink">{topic.title}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted marker:font-bold marker:text-pine">
              {topic.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Button className="mt-4" tone="ghost" onClick={() => nav.show(topic.screen)}>
              Mở phần này
            </Button>
          </details>
        ))}
      </section>
    </div>
  );
}
