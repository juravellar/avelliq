import { CalendarDays, List } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type AppointmentsView = "lista" | "calendario";

const VIEWS = [
  { value: "lista", label: "Lista", icon: List, href: "/agendamentos" },
  {
    value: "calendario",
    label: "Calendário",
    icon: CalendarDays,
    href: "/agendamentos?visao=calendario",
  },
] as const;

// Switches between the appointment list and the week calendar. The choice
// lives in the URL, so it survives a reload and can be bookmarked.
export function ViewToggle({ view }: { view: AppointmentsView }) {
  return (
    <nav
      aria-label="Forma de exibição"
      className="bg-muted inline-flex rounded-lg p-1"
    >
      {VIEWS.map(({ value, label, icon: Icon, href }) => (
        <Link
          key={value}
          href={href}
          prefetch={false}
          aria-current={view === value ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-150",
            view === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
