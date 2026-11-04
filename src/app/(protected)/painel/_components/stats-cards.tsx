import {
  CalendarIcon,
  DollarSignIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyInCents } from "@/helpers/currency";

interface StatsCardsProps {
  totalRevenue: number | null;
  totalAppointments: number;
  totalPatients: number;
  totalDoctors: number;
}

const StatsCards = ({
  totalRevenue,
  totalAppointments,
  totalPatients,
  totalDoctors,
}: StatsCardsProps) => {
  const stats = [
    {
      title: "Faturamento",
      value: totalRevenue ? formatCurrencyInCents(totalRevenue) : "R$ 0,00",
      icon: DollarSignIcon,
    },
    {
      title: "Agendamentos",
      value: totalAppointments.toString(),
      icon: CalendarIcon,
    },
    {
      title: "Pacientes",
      value: totalPatients.toString(),
      icon: UserIcon,
    },
    {
      title: "Médicos",
      value: totalDoctors.toString(),
      icon: UsersIcon,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 pb-2 sm:px-6">
              <div className="bg-primary/10 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full sm:flex">
                <Icon className="text-primary h-4 w-4" />
              </div>
              <CardTitle className="text-muted-foreground min-w-0 truncate py-0.5 text-sm font-medium">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="text-xl font-bold break-words sm:text-2xl">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatsCards;
