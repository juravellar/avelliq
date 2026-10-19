"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { deleteAccount } from "@/actions/delete-account";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionErrorMessage } from "@/lib/action-errors";
import { authClient } from "@/lib/auth-client";

export function DeleteAccountCard({
  email,
  clinicCount,
  hasSubscription,
}: {
  email: string;
  clinicCount: number;
  hasSubscription: boolean;
}) {
  const [typedEmail, setTypedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(deleteAccount, {
    // Clear the session cookies (the cached one would otherwise look valid for
    // a few minutes), then a full load so no client state survives.
    onSuccess: async () => {
      await authClient.signOut().catch(() => {});
      window.location.assign("/entrar");
    },
    onError: ({ error }) =>
      setError(actionErrorMessage(error, "Não foi possível excluir a conta.")),
  });
  const matches = typedEmail.trim().toLowerCase() === email.toLowerCase();

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive text-base">
          Excluir conta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Apaga definitivamente sua conta
          {clinicCount > 0 &&
            ` e ${clinicCount === 1 ? "sua clínica" : `suas ${clinicCount} clínicas`}, com todos os médicos, pacientes e agendamentos`}
          {hasSubscription && ", e cancela sua assinatura na hora"}. Não dá para
          desfazer. Se quiser guardar uma cópia, baixe seus dados antes.
        </p>
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) {
              setTypedEmail("");
              setError(null);
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Excluir minha conta</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente. Para confirmar, digite o email da conta:{" "}
                <strong className="break-all">{email}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-email">Email da conta</Label>
              <Input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={typedEmail}
                onChange={(event) => setTypedEmail(event.target.value)}
              />
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={!matches || action.isPending}
                onClick={() => action.execute({ confirmEmail: typedEmail })}
              >
                {action.isPending ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
