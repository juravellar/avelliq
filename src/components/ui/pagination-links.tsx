import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PaginationLinksProps {
  page: number;
  pages: number;
  href: (page: number) => string;
}

// Previous / next links for a server-paginated list. The page lives in the
// URL, so each page is a normal navigation that can be reloaded or shared.
export function PaginationLinks({ page, pages, href }: PaginationLinksProps) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      {page > 1 ? (
        <Button variant="outline" asChild>
          <Link href={href(page - 1)} prefetch={false}>
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground text-sm">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Button variant="outline" asChild>
          <Link href={href(page + 1)} prefetch={false}>
            Próxima
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
