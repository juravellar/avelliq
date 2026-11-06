"use client";

import "dayjs/locale/pt-br";

import dayjs from "dayjs";
import { Calendar as CalendarIcon } from "lucide-react";
import { createParser, useQueryStates } from "nuqs";
import { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isCalendarDay } from "@/helpers/time";
import { useIsMobile } from "@/hooks/use-mobile";

const DATE = "YYYY-MM-DD";

// Dates in the URL are calendar days. nuqs' parseAsIsoDate reads them as UTC
// midnight, which in Brazil is the evening before, so the picker showed the
// previous day.
const parseAsDay = createParser({
  parse: (value) => (isCalendarDay(value) ? dayjs(value).toDate() : null),
  serialize: (date) => dayjs(date).format(DATE),
  eq: (a, b) => a.getTime() === b.getTime(),
});

// from and to come from the server, which decides the period the page shows;
// the URL is only written, so the picker never shows dates the page didn't
// load (e.g. an end before the start, which the server corrects).
export function DatePicker({ from, to }: { from: string; to: string }) {
  const isMobile = useIsMobile();
  const [, setRange] = useQueryStates(
    { from: parseAsDay, to: parseAsDay },
    { shallow: false },
  );
  const range = { from: dayjs(from).toDate(), to: dayjs(to).toDate() };

  // Both ends are written together: a start alone would be paired on the
  // server with an end that may come before it.
  const handleDateSelect = (selected: DateRange | undefined) => {
    if (selected?.from) {
      setRange({ from: selected.from, to: selected.to ?? selected.from });
    }
  };

  return (
    <div className="grid gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className="justify-start text-left font-normal"
          >
            <CalendarIcon className="text-primary h-4 w-4" />
            {dayjs(range.from).locale("pt-br").format("MMM DD, YYYY")} -{" "}
            {dayjs(range.to).locale("pt-br").format("MMM DD, YYYY")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={range.from}
            selected={range}
            onSelect={handleDateSelect}
            numberOfMonths={isMobile ? 1 : 2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
