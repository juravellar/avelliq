"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createClinic } from "@/actions/create-clinic";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const clinicFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Nome é obrigatório" })
    .max(120, { message: "Use até 120 caracteres" }),
});

type ClinicFormData = z.infer<typeof clinicFormSchema>;
const ClinicForm = ({
  onCancel,
  onCreated,
}: {
  onCancel?: () => void;
  // The sidebar's dialog outlives the redirect to the dashboard, so it has to
  // be told to close.
  onCreated?: () => void;
}) => {
  const form = useForm<ClinicFormData>({
    resolver: zodResolver(clinicFormSchema),
    defaultValues: {
      name: "",
    },
  });

  // A second submit (double click, Enter twice) would hit the plan's clinic
  // limit right after the first one created the clinic. Once a clinic is
  // created the form stays locked while the redirect happens.
  const submitting = useRef(false);

  const onSubmit = async (data: ClinicFormData) => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    try {
      const result = await createClinic(data.name);
      submitting.current = false;
      if (result?.limitReached) {
        toast.error("Seu plano não permite mais clínicas.");
        onCancel?.();
      }
    } catch (error) {
      // Success redirects to the dashboard, which surfaces here as an error.
      if (isRedirectError(error)) {
        toast.success("Clínica criada com sucesso");
        onCreated?.();
        return;
      }
      submitting.current = false;
      console.error(error);
      toast.error("Erro ao criar clínica");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar clínica"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};

export default ClinicForm;
