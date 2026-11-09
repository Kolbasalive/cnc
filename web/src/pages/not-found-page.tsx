import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export function NotFoundPage() {
  return (
    <div>
      <PageHeader eyebrow="404" title="Страница не найдена" />
      <Panel className="p-8">
        <div className="flex flex-col items-center text-center">
          <Compass className="h-8 w-8 text-muted" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted">
            Такого раздела нет. Вернись на обзор — там живые данные стендов.
          </p>
          <Link
            to="/"
            className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/15"
          >
            На обзор
          </Link>
        </div>
      </Panel>
    </div>
  );
}
