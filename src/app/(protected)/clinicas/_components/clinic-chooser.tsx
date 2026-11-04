"use client";

import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { chooseClinics } from "@/actions/choose-clinics";
import { switchClinic } from "@/actions/switch-clinic";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { actionErrorMessage } from "@/lib/action-errors";
import { cn } from "@/lib/utils";

interface ClinicItem {
  id: string;
  name: string;
  writable: boolean;
}

interface ClinicChooserProps {
  clinics: ClinicItem[];
  activeClinicId: string;
  clinicLimit: number | null;
  // The user has more clinics than the plan allows and must pick which stay.
  mustChoose: boolean;
  firstChoice: boolean;
  // Set while another change is blocked by the 30-day rule.
  nextChangeOn: string | null;
  supportEmail: string | null;
}

export function ClinicChooser({
  clinics,
  activeClinicId,
  clinicLimit,
  mustChoose,
  firstChoice,
  nextChangeOn,
  supportEmail,
}: ClinicChooserProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    clinics.filter(({ writable }) => writable).map(({ id }) => id),
  );
  const refresh = () => {
    router.refresh();
  };

  const switchAction = useAction(switchClinic, {
    onSuccess: () => {
      refresh();
      router.push("/painel");
    },
    onError: () => toast.error("Não foi possível abrir a clínica."),
  });
  const chooseAction = useAction(chooseClinics, {
    onSuccess: () => {
      toast.success("Clínicas ativas atualizadas.");
      refresh();
    },
    onError: ({ error }) =>
      toast.error(
        actionErrorMessage(error, "Não foi possível salvar a escolha."),
      ),
  });

  const limit = clinicLimit ?? clinics.length;
  const choosing = mustChoose && !nextChangeOn;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((other) => other !== id)
        : current.length < limit
          ? [...current, id]
          : current,
    );
  const unchanged =
    selected.length === clinics.filter(({ writable }) => writable).length &&
    clinics.every(({ id, writable }) => writable === selected.includes(id));
  const leavingReadOnly = clinics.filter(({ id }) => !selected.includes(id));

  return (
    <div className="space-y-6">
      {mustChoose && (
        <Card className="border-warning-border bg-warning-muted">
          <CardHeader>
            <CardTitle className="text-warning-foreground text-base">
              {firstChoice
                ? "Escolha quais clínicas continuam ativas"
                : "Clínicas ativas no seu plano"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-warning-foreground space-y-2 text-sm">
            <p>
              Você tem {clinics.length} clínicas e seu plano permite {limit}. As
              outras ficam só leitura: você continua vendo os dados, mas não
              pode cadastrar nem editar. Nenhum dado é apagado.
            </p>
            {nextChangeOn ? (
              <p>
                Você já alterou essa escolha recentemente. A próxima alteração
                fica liberada em <strong>{nextChangeOn}</strong>. Para mudar
                antes, fale com o suporte
                {supportEmail ? (
                  <>
                    {" "}
                    em{" "}
                    <a className="underline" href={`mailto:${supportEmail}`}>
                      {supportEmail}
                    </a>
                  </>
                ) : null}
                .
              </p>
            ) : (
              <p>
                {firstChoice
                  ? "Depois de salvar, você pode alterar uma vez; a partir daí, uma alteração a cada 30 dias."
                  : "Esta é a sua alteração do período: depois dela, a próxima só em 30 dias."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ul className="@container grid gap-3">
        {clinics.map((clinic) => {
          const isSelected = selected.includes(clinic.id);
          const isActive = clinic.id === activeClinicId;
          const blocked = !isSelected && selected.length >= limit;
          return (
            <li key={clinic.id}>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-4",
                  choosing &&
                    isSelected &&
                    "border-primary ring-primary ring-1",
                )}
              >
                {choosing && (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Manter ${clinic.name} ativa`}
                    disabled={blocked}
                    onClick={() => toggle(clinic.id)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                      blocked && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{clinic.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {isActive && <Badge variant="outline">Aberta agora</Badge>}
                    {clinic.writable ? (
                      <Badge className="bg-success-muted text-success-foreground hover:bg-success-muted">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge className="bg-warning-muted text-warning-foreground hover:bg-warning-muted">
                        <Lock className="mr-1 h-3 w-3" />
                        Só leitura
                      </Badge>
                    )}
                  </div>
                </div>
                {!isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={switchAction.isPending}
                    onClick={() =>
                      switchAction.execute({ clinicId: clinic.id })
                    }
                  >
                    Abrir
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {choosing && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {selected.length === limit
              ? `${selected.length} de ${limit} selecionadas`
              : `Selecione ${limit - selected.length} ${limit - selected.length === 1 ? "clínica" : "clínicas"} (${selected.length} de ${limit})`}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={
                  selected.length !== limit ||
                  chooseAction.isPending ||
                  (unchanged && !firstChoice)
                }
              >
                Salvar escolha
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar clínicas ativas?</AlertDialogTitle>
                <AlertDialogDescription>
                  {leavingReadOnly.length > 0
                    ? `${leavingReadOnly.map(({ name }) => name).join(", ")} ${leavingReadOnly.length === 1 ? "vai ficar" : "vão ficar"} só leitura. Os dados continuam guardados.`
                    : "Todas as clínicas selecionadas continuam ativas."}{" "}
                  {firstChoice
                    ? "Você ainda poderá alterar uma vez."
                    : "A próxima alteração só será possível em 30 dias."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => chooseAction.execute({ clinicIds: selected })}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
