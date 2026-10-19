"use client";

import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { setSupportAdmin } from "@/actions/set-support-admin";
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
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-errors";

// Makes an account an admin (it then sees and answers the Atendimento) or
// takes that away, after a confirmation.
export function AdminToggle({
  userId,
  name,
  admin,
  canGrant,
}: {
  userId: string;
  name: string;
  admin: boolean;
  canGrant: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const action = useAction(setSupportAdmin, {
    onSuccess: () => setError(null),
    onError: ({ error }) =>
      setError(actionErrorMessage(error, "Não foi possível salvar.")),
  });

  if (!admin && !canGrant) {
    return (
      <p className="text-muted-foreground text-xs sm:max-w-40 sm:text-right">
        Precisa confirmar o e-mail para virar admin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant={admin ? "outline" : "default"}
            size="sm"
            disabled={action.isPending}
          >
            {action.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {admin ? "Remover admin" : "Tornar admin"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {admin ? `Remover ${name} dos admins?` : `Tornar ${name} admin?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {admin
                ? "A pessoa deixa de ver o Atendimento na hora."
                : "A pessoa passa a ver o Atendimento: lê os e-mails recebidos pelo suporte e responde em nome do Avelliq. Ela não vê esta tela de contas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => action.execute({ userId, admin: !admin })}
            >
              {admin ? "Remover" : "Tornar admin"}
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
