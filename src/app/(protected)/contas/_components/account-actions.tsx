"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import {
  blockAccount,
  cancelDeletionRequest,
  deleteAccountAsOwner,
  getDeletionPreview,
  requestAccountDeletion,
  unblockAccount,
} from "@/actions/moderate-account";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  MODERATION_REASON_IDS,
  MODERATION_REASONS,
  type ModerationReason,
} from "@/lib/support/admin";

type Dialog = "block" | "unblock" | "request" | "cancel" | "delete" | null;

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

// Block, unblock, ask for deletion and delete, as each viewer may (see
// canBlock, canRequestDeletion and canDeleteAccount).
export function AccountActions({
  userId,
  name,
  blocked,
  deletionRequested,
  allowed,
}: {
  userId: string;
  name: string;
  blocked: boolean;
  deletionRequested: boolean;
  allowed: {
    block: boolean;
    requestDeletion: boolean;
    cancelRequest: boolean;
    delete: boolean;
  };
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState<ModerationReason>("spam");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setDialog(null);
    setError(null);
    setConfirmEmail("");
  };
  const callbacks = {
    onSuccess: close,
    onError: ({ error }: { error: { serverError?: string } }) =>
      setError(actionErrorMessage(error, "Não foi possível concluir.")),
  };
  const block = useAction(blockAccount, callbacks);
  const unblock = useAction(unblockAccount, callbacks);
  const request = useAction(requestAccountDeletion, callbacks);
  const cancel = useAction(cancelDeletionRequest, callbacks);
  const remove = useAction(deleteAccountAsOwner, callbacks);
  const preview = useAction(getDeletionPreview);
  const pending =
    block.isPending ||
    unblock.isPending ||
    request.isPending ||
    cancel.isPending ||
    remove.isPending;

  const items = [
    allowed.block &&
      (blocked
        ? { label: "Desbloquear", dialog: "unblock" as const }
        : { label: "Bloquear", dialog: "block" as const }),
    allowed.requestDeletion &&
      !deletionRequested && {
        label: "Pedir exclusão",
        dialog: "request" as const,
      },
    allowed.cancelRequest &&
      deletionRequested && {
        label: allowed.delete
          ? "Recusar pedido de exclusão"
          : "Cancelar pedido",
        dialog: "cancel" as const,
      },
  ].filter(Boolean) as { label: string; dialog: Dialog }[];
  if (items.length === 0 && !allowed.delete) {
    return null;
  }

  const reasonSelect = (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">Motivo</span>
      <select
        value={reason}
        onChange={(event) => setReason(event.target.value as ModerationReason)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {MODERATION_REASON_IDS.map((id) => (
          <option key={id} value={id}>
            {MODERATION_REASONS[id]}
          </option>
        ))}
      </select>
    </label>
  );
  const data = preview.result.data;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Ações para ${name}`}>
            <MoreHorizontal className="h-4 w-4" />
            Ações
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onSelect={() => setDialog(item.dialog)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
          {allowed.delete && (
            <>
              {items.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setDialog("delete");
                  preview.execute({ userId });
                }}
              >
                Excluir conta
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          {dialog === "block" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Bloquear {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                A pessoa sai do sistema agora e não consegue entrar de novo, nem
                com senha nem com Google, até a conta ser desbloqueada. Nenhum
                dado é apagado.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {dialog === "unblock" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Desbloquear {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                A pessoa volta a poder entrar no sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {dialog === "request" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Pedir a exclusão de {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Só a conta principal exclui contas: o pedido aparece para ela na
                tela Contas. Enquanto isso, você pode bloquear a conta.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {dialog === "cancel" && (
            <AlertDialogHeader>
              <AlertDialogTitle>
                {allowed.delete ? "Recusar o pedido" : "Cancelar o pedido"} de
                exclusão de {name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                A conta continua como está. Se estiver bloqueada, continua
                bloqueada.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {dialog === "delete" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir a conta de {name}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {!data ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <p>
                        Isto não pode ser desfeito. Vão junto{" "}
                        {plural(data.clinics, "clínica", "clínicas")} que só
                        esta conta administra, com{" "}
                        {plural(data.patients, "paciente", "pacientes")} e{" "}
                        {plural(
                          data.appointments,
                          "agendamento",
                          "agendamentos",
                        )}
                        , e os atendimentos do suporte do e-mail da conta.
                        {data.subscribed &&
                          " A assinatura no Stripe é cancelada antes."}
                      </p>
                      <p>
                        Para confirmar, digite o e-mail da conta:{" "}
                        <strong className="break-all">{data.email}</strong>
                      </p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {(dialog === "block" || dialog === "request") && reasonSelect}
          {dialog === "delete" && data && (
            <Input
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              placeholder="E-mail da conta"
              aria-label="E-mail da conta, para confirmar"
              autoComplete="off"
            />
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <Button
              variant={
                dialog === "delete" || dialog === "block"
                  ? "destructive"
                  : "default"
              }
              disabled={
                pending ||
                (dialog === "delete" &&
                  (!data ||
                    confirmEmail.trim().toLowerCase() !==
                      data.email.toLowerCase()))
              }
              onClick={() => {
                setError(null);
                if (dialog === "block") block.execute({ userId, reason });
                if (dialog === "unblock") unblock.execute({ userId });
                if (dialog === "request") request.execute({ userId, reason });
                if (dialog === "cancel") cancel.execute({ userId });
                if (dialog === "delete")
                  remove.execute({ userId, confirmEmail });
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog === "block"
                ? "Bloquear"
                : dialog === "unblock"
                  ? "Desbloquear"
                  : dialog === "request"
                    ? "Pedir exclusão"
                    : dialog === "cancel"
                      ? "Confirmar"
                      : "Excluir para sempre"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
