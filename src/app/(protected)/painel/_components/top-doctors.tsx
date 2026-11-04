import { Stethoscope } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

import { DashboardCardHeader } from "./dashboard-card-header";

interface TopDoctorsProps {
  doctors: {
    id: string;
    name: string;
    avatarImageUrl: string | null;
    specialty: string;
    appointments: number;
  }[];
}

export default function TopDoctors({ doctors }: TopDoctorsProps) {
  return (
    <Card className="w-full">
      <DashboardCardHeader icon={Stethoscope} title="Médicos" />
      <CardContent>
        {doctors.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Nenhum médico cadastrado.
          </div>
        ) : (
          <div className="space-y-6">
            {doctors.map((doctor) => (
              <div
                key={doctor.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground text-lg font-medium">
                      {doctor.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm">{doctor.name}</h3>
                    <p className="text-muted-foreground truncate text-sm">
                      {doctor.specialty}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                    {doctor.appointments} agend.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
