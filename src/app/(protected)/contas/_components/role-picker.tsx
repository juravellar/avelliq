"use client";

import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { setStaffRole } from "@/actions/set-staff-role";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionErrorMessage } from "@/lib/action-errors";
import { STAFF_ROLE_NAMES, type StaffRole } from "@/lib/support/admin";

const NO_ROLE = "none";

const ROLE_EFFECTS: Record<StaffRole, string> = {
  support:
    "Passa a ver o Atendimento: lê os e-mails recebidos pelo suporte e responde em nome do Avelliq. Usa o sistema todo sem precisar de plano.",
  qa: "Passa a testar o sistema: vê todas as telas, inclusive o Atendimento e esta, sem responder clientes nem mudar cargos, e segue as regras do plano, que pode simular em Assinatura.",
  admin:
    "Passa a ver o Atendimento e esta tela de contas, onde também escolhe quem é Suporte e QA. Usa o sistema todo sem precisar de plano.",
};

// Chooses an account's role on Avelliq's team, after a confirmation.
// `roles` are the ones the person looking may give.
export function RolePicker({
  userId,
  name,
  role,
  roles,
  canJoin,
}: {
  userId: string;
  name: string;
  role: StaffRole | null;
  roles: StaffRole[];
  canJoin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<StaffRole | null | undefined>();
  const action = useAction(setStaffRole, {
    onSuccess: () => setError(null),
    onError: ({ error }) =>
      setError(actionErrorMessage(error, "Não foi possível salvar.")),
  });

  if (!role && !canJoin) {
    return (
      <p className="text-muted-foreground text-xs sm:max-w-40 sm:text-right">
        Precisa confirmar o e-mail para entrar na equipe.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <div className="flex items-center gap-2">
        {action.isPending && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
        <Select
          value={role ?? NO_ROLE}
          onValueChange={(value) =>
            setChosen(value === NO_ROLE ? null : (value as StaffRole))
          }
          disabled={action.isPending}
        >
          <SelectTrigger
            size="sm"
            className="w-36"
            aria-label={`Cargo de ${name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ROLE}>Sem cargo</SelectItem>
            {roles.map((option) => (
              <SelectItem key={option} value={option}>
                {STAFF_ROLE_NAMES[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AlertDialog
        open={chosen !== undefined}
        onOpenChange={(open) => !open && setChosen(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chosen
                ? `Tornar ${name} ${STAFF_ROLE_NAMES[chosen]}?`
                : `Tirar ${name} da equipe?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chosen
                ? ROLE_EFFECTS[chosen]
                : "A pessoa perde o acesso da equipe na hora e volta aos limites do plano dela."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chosen !== undefined) {
                  action.execute({ userId, role: chosen });
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
