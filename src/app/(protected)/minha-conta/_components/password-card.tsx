"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { setAccountPassword } from "@/actions/set-account-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { actionErrorMessage } from "@/lib/action-errors";
import { authClient } from "@/lib/auth-client";
import { passwordMessage } from "@/lib/password-messages";

// Changes the password, or creates one for an account made with Google, so it
// can also sign in with e-mail and password.
export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const finish = (message: string) => {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
    setDone(message);
    router.refresh();
  };
  const create = useAction(setAccountPassword, {
    onSuccess: () =>
      finish(
        "Senha criada. Agora você também pode entrar com seu e-mail e essa senha.",
      ),
    onError: ({ error }) =>
      setError(
        error.validationErrors?.newPassword?._errors?.[0] ??
          actionErrorMessage(error, "Não foi possível criar a senha."),
      ),
  });
  const pending = create.isPending || changing;

  const submit = async () => {
    setDone(null);
    if (next.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (next !== repeat) {
      setError("As senhas não são iguais.");
      return;
    }
    if (!hasPassword) {
      create.execute({ newPassword: next });
      return;
    }
    setChanging(true);
    // In case the old password leaked, the other devices are signed out.
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setChanging(false);
    if (error) {
      setError(
        passwordMessage(error.code) ?? "Não foi possível alterar a senha.",
      );
      return;
    }
    finish("Senha alterada. Os outros aparelhos precisam entrar de novo.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {hasPassword ? "Alterar senha" : "Criar senha"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!hasPassword && (
          <p className="text-muted-foreground">
            Sua conta entra pelo Google. Crie uma senha para também poder entrar
            com seu e-mail e senha. O Google continua funcionando.
          </p>
        )}
        <form
          className="max-w-sm space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Senha atual</Label>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">
              {hasPassword ? "Nova senha" : "Senha"}
            </Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repeat-password">Repita a senha</Label>
            <PasswordInput
              id="repeat-password"
              autoComplete="new-password"
              maxLength={128}
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {done && (
            <p className="text-success-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {done}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasPassword ? "Alterar senha" : "Criar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
