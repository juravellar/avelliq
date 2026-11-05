"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateClinic } from "@/actions/update-clinic";
import {
  CLINIC_ADDRESS_MAX,
  CLINIC_NAME_MAX,
  clinicFormSchema,
  type UpdateClinicSchema,
} from "@/actions/update-clinic/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { actionErrorMessage } from "@/lib/action-errors";
import {
  BRAND_COLOR_PRESETS,
  brandColorWarning,
  brandStyle,
} from "@/lib/branding";
import { BLOCKED_COPY } from "@/lib/create-gate";
import type { WriteBlock } from "@/lib/free-period";
import { resizeLogo } from "@/lib/resize-logo";
import { cn } from "@/lib/utils";

export function ClinicSettingsForm({
  clinic,
  block,
}: {
  clinic: {
    name: string;
    address: string;
    phoneNumber: string;
    brandColor: string;
    logoDataUrl: string;
  };
  block: WriteBlock | null;
}) {
  const router = useRouter();
  const logoInput = useRef<HTMLInputElement>(null);
  const form = useForm<UpdateClinicSchema>({
    resolver: zodResolver(clinicFormSchema(clinic.phoneNumber)),
    defaultValues: clinic,
  });
  const updateAction = useAction(updateClinic, {
    onSuccess: () => {
      toast.success("Dados da clínica salvos.");
      // What was saved becomes the new baseline, so the logo isn't counted
      // as changed (and sent again) on the next save.
      form.reset(form.getValues());
      router.refresh();
    },
    onError: ({ error }) =>
      toast.error(
        actionErrorMessage(error, "Não foi possível salvar os dados."),
      ),
  });
  const disabled = Boolean(block);

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-6">
        {block && (
          <p className="border-warning-border bg-warning-muted text-warning-foreground mb-4 rounded-md border p-3 text-sm">
            {block.message}{" "}
            <Link
              href={BLOCKED_COPY[block.kind].href}
              className="font-medium underline"
            >
              {BLOCKED_COPY[block.kind].action}
            </Link>
          </p>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              // The logo (up to 150 KB) goes only when it changed; left out,
              // the action keeps the stored one and its URL version.
              updateAction.execute(
                form.formState.dirtyFields.logoDataUrl
                  ? values
                  : { ...values, logoDataUrl: undefined },
              ),
            )}
            className="space-y-4"
          >
            <fieldset disabled={disabled} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={CLINIC_NAME_MAX} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rua, número, bairro, cidade"
                        maxLength={CLINIC_ADDRESS_MAX}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            <fieldset disabled={disabled} className="space-y-4 border-t pt-6">
              <legend className="sr-only">Marca da clínica</legend>
              <div>
                <h3 className="text-sm font-medium">Marca da clínica</h3>
                <p className="text-muted-foreground text-sm">
                  O logo e a cor aparecem no menu e nos botões para quem usa
                  esta clínica.
                </p>
              </div>
              <FormField
                control={form.control}
                name="logoDataUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <div className="flex items-center gap-4">
                      <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                        {field.value ? (
                          // A local data URL: next/image adds nothing here.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={field.value}
                            alt="Logo da clínica"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageIcon
                            className="text-muted-foreground h-6 w-6"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInput.current?.click()}
                        >
                          {field.value ? "Trocar logo" : "Enviar logo"}
                        </Button>
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => field.onChange("")}
                          >
                            Remover
                          </Button>
                        )}
                        <input
                          ref={logoInput}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) {
                              return;
                            }
                            try {
                              field.onChange(await resizeLogo(file));
                            } catch (error) {
                              toast.error((error as Error).message);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <FormDescription>
                      PNG, JPG ou WebP. A imagem é reduzida para 128 px.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brandColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor principal</FormLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      {BRAND_COLOR_PRESETS.map(({ color, name }) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Usar a cor ${name}`}
                          title={name}
                          aria-pressed={field.value === color}
                          onClick={() => field.onChange(color)}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-transform duration-100 active:scale-90",
                            field.value === color
                              ? "border-foreground"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <FormControl>
                        <input
                          type="color"
                          aria-label="Escolher outra cor"
                          value={field.value || "#2563eb"}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                        />
                      </FormControl>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => field.onChange("")}
                        >
                          Usar a cor do Avelliq
                        </Button>
                      )}
                    </div>
                    {field.value && brandColorWarning(field.value) && (
                      <p className="text-warning-foreground text-sm">
                        {brandColorWarning(field.value)}
                      </p>
                    )}
                    {field.value && (
                      <div
                        style={brandStyle(field.value)}
                        className="flex items-center gap-2 pt-1"
                      >
                        <span className="text-muted-foreground text-xs">
                          Prévia:
                        </span>
                        <span className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-xs font-medium">
                          Novo agendamento
                        </span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            <Button type="submit" disabled={disabled || updateAction.isPending}>
              Salvar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
