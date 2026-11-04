import {
  Activity,
  Baby,
  Bone,
  Brain,
  Eye,
  Hand,
  Heart,
  Hospital,
  Stethoscope,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { DashboardCardHeader } from "./dashboard-card-header";

interface TopSpecialtiesProps {
  topSpecialties: {
    specialty: string;
    appointments: number;
  }[];
}

const getSpecialtyIcon = (specialty: string) => {
  const specialtyLower = specialty.toLowerCase();

  if (specialtyLower.includes("cardiolog")) return Heart;
  if (
    specialtyLower.includes("ginecolog") ||
    specialtyLower.includes("obstetri")
  )
    return Baby;
  if (specialtyLower.includes("pediatr")) return Activity;
  if (specialtyLower.includes("dermatolog")) return Hand;
  if (
    specialtyLower.includes("ortoped") ||
    specialtyLower.includes("traumatolog")
  )
    return Bone;
  if (specialtyLower.includes("oftalmolog")) return Eye;
  if (specialtyLower.includes("neurolog")) return Brain;

  return Stethoscope;
};

export default function TopSpecialties({
  topSpecialties,
}: TopSpecialtiesProps) {
  const hasSpecialties = topSpecialties.length > 0;
  const maxAppointments = hasSpecialties
    ? Math.max(...topSpecialties.map((i) => i.appointments))
    : 0;

  return (
    <Card className="w-full">
      <DashboardCardHeader icon={Hospital} title="Especialidades" />
      <CardContent>
        {!hasSpecialties ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Nenhum agendamento no período.
          </div>
        ) : (
          <div className="space-y-6">
            {topSpecialties.map((specialty) => {
              const Icon = getSpecialtyIcon(specialty.specialty);
              const progressValue =
                maxAppointments > 0
                  ? (specialty.appointments / maxAppointments) * 100
                  : 0;

              return (
                <div
                  key={specialty.specialty}
                  className="flex items-center gap-2"
                >
                  <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Icon className="text-primary h-5 w-5" />
                  </div>
                  <div className="flex w-full min-w-0 flex-col justify-center">
                    <div className="flex w-full justify-between gap-2">
                      <h3 className="truncate text-sm">
                        {specialty.specialty}
                      </h3>
                      <div className="shrink-0 text-right">
                        <span className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                          {specialty.appointments} agend.
                        </span>
                      </div>
                    </div>
                    <Progress value={progressValue} className="w-full" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
