"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { type ReactNode, useEffect, useRef } from "react";
import { type Control, type FieldPath, useForm } from "react-hook-form";
import { PatternFormat } from "react-number-format";
import { toast } from "sonner";
import type { z } from "zod";

import { upsertPatient } from "@/actions/upsert-patient";
import {
  PATIENT_LIMITS,
  patientFormSchema,
} from "@/actions/upsert-patient/schema";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { patientsTable } from "@/db/schema";
import { fetchAddressByCep } from "@/helpers/cep";
import { BRAZILIAN_STATES, onlyDigits } from "@/helpers/cpf";
import { clinicToday } from "@/helpers/time";
import { actionErrorMessage } from "@/lib/action-errors";

type FormValues = z.infer<ReturnType<typeof patientFormSchema>>;
type Patient = typeof patientsTable.$inferSelect;
type AddressField =
  | "addressStreet"
  | "addressDistrict"
  | "addressCity"
  | "addressState";

// Radix Select can't have an item with an empty value, so "no state" uses
// this one and is stored as empty.
const NO_STATE = "none";

// Stored nulls become empty fields; the server turns them back into nulls.
const toFormValues = (patient?: Patient): FormValues => ({
  name: patient?.name ?? "",
  email: patient?.email ?? "",
  phoneNumber: patient?.phoneNumber ?? "",
  sex: patient?.sex ?? (undefined as unknown as FormValues["sex"]),
  birthDate: patient?.birthDate ?? "",
  cpf: patient?.cpf ?? "",
  healthInsurance: patient?.healthInsurance ?? "",
  healthInsuranceNumber: patient?.healthInsuranceNumber ?? "",
  addressZip: patient?.addressZip ?? "",
  addressStreet: patient?.addressStreet ?? "",
  addressNumber: patient?.addressNumber ?? "",
  addressComplement: patient?.addressComplement ?? "",
  addressDistrict: patient?.addressDistrict ?? "",
  addressCity: patient?.addressCity ?? "",
  addressState: patient?.addressState ?? "",
  emergencyContactName: patient?.emergencyContactName ?? "",
  emergencyContactPhone: patient?.emergencyContactPhone ?? "",
  notes: patient?.notes ?? "",
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function TextField({
  control,
  name,
  label,
  placeholder,
  className,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              {...field}
              value={field.value ?? ""}
              maxLength={
                PATIENT_LIMITS[name as keyof typeof PATIENT_LIMITS] ?? undefined
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MaskedField({
  control,
  name,
  label,
  format,
  placeholder,
  onComplete,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
  format: string;
  placeholder: string;
  onComplete?: (digits: string) => void;
}) {
  const digits = format.split("#").length - 1;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PatternFormat
              format={format}
              mask="_"
              placeholder={placeholder}
              inputMode="numeric"
              value={field.value ?? ""}
              onBlur={field.onBlur}
              name={field.name}
              getInputRef={field.ref}
              onValueChange={({ value }, { source }) => {
                field.onChange(value);
                // "prop" changes come from form.reset when the edit dialog
                // opens; only a value the user typed should call ViaCEP.
                if (source === "event" && value.length === digits) {
                  onComplete?.(value);
                }
              }}
              customInput={Input}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PhoneField({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PhoneInput
              value={field.value ?? ""}
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
  );
}

interface UpsertPatientFormProps {
  isOpen: boolean;
  patient?: Patient;
  onSuccess?: () => void;
}

const UpsertPatientForm = ({
  patient,
  onSuccess,
  isOpen,
}: UpsertPatientFormProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(patientFormSchema(patient?.phoneNumber)),
    defaultValues: toFormValues(patient),
  });

  // Address values a CEP lookup may replace: the saved ones and those the
  // last lookup wrote.
  const autofilled = useRef<Partial<Record<AddressField, string>>>({});

  useEffect(() => {
    if (isOpen) {
      form.reset(toFormValues(patient));
      // The saved address belongs to the saved CEP, so a new CEP replaces it
      // too; only what is typed in this dialog is kept.
      autofilled.current = {
        addressStreet: patient?.addressStreet ?? undefined,
        addressDistrict: patient?.addressDistrict ?? undefined,
        addressCity: patient?.addressCity ?? undefined,
        addressState: patient?.addressState ?? undefined,
      };
    }
  }, [isOpen, form, patient]);

  const upsertPatientAction = useAction(upsertPatient, {
    onSuccess: () => {
      toast.success("Paciente salvo com sucesso.");
      onSuccess?.();
    },
    onError: ({ error }) => {
      toast.error(actionErrorMessage(error, "Erro ao salvar paciente."));
    },
  });

  // Fills the address fields that are empty or still hold the previous
  // lookup's value, never over what the user typed.
  const fillAddress = async (cep: string) => {
    const address = await fetchAddressByCep(cep);
    // A slow answer for a CEP the user has since changed is dropped.
    if (!address || onlyDigits(form.getValues("addressZip") ?? "") !== cep) {
      return;
    }
    const fill = (name: AddressField, value: string) => {
      const current = form.getValues(name);
      if (value && (!current || current === autofilled.current[name])) {
        form.setValue(name, value, { shouldValidate: true });
        autofilled.current[name] = value;
      }
    };
    fill("addressStreet", address.street);
    fill("addressDistrict", address.district);
    fill("addressCity", address.city);
    fill("addressState", address.state);
  };

  const onSubmit = (values: FormValues) => {
    upsertPatientAction.execute({ ...values, id: patient?.id });
  };

  const { control } = form;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {patient ? patient.name : "Adicionar paciente"}
        </DialogTitle>
        <DialogDescription>
          {patient
            ? "Edite as informações desse paciente."
            : "Só nome, email, telefone e sexo são obrigatórios."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Section title="Dados pessoais">
            <TextField
              control={control}
              name="name"
              label="Nome completo"
              placeholder="Nome do paciente"
              className="sm:col-span-2"
            />
            <FormField
              control={control}
              name="sex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de nascimento</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      max={clinicToday()}
                      min="1900-01-01"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <MaskedField
              control={control}
              name="cpf"
              label="CPF"
              format="###.###.###-##"
              placeholder="000.000.000-00"
            />
          </Section>

          <Section title="Contato">
            <FormField
              control={control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="exemplo@email.com"
                      maxLength={PATIENT_LIMITS.email}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <PhoneField control={control} name="phoneNumber" label="Telefone" />
          </Section>

          <Section title="Endereço">
            <MaskedField
              control={control}
              name="addressZip"
              label="CEP"
              format="#####-###"
              placeholder="00000-000"
              onComplete={fillAddress}
            />
            <TextField
              control={control}
              name="addressStreet"
              label="Logradouro"
              placeholder="Rua, avenida…"
            />
            <TextField control={control} name="addressNumber" label="Número" />
            <TextField
              control={control}
              name="addressComplement"
              label="Complemento"
              placeholder="Apto, bloco…"
            />
            <TextField
              control={control}
              name="addressDistrict"
              label="Bairro"
            />
            <TextField control={control} name="addressCity" label="Cidade" />
            <FormField
              control={control}
              name="addressState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UF</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === NO_STATE ? "" : value)
                    }
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_STATE}>Não informar</SelectItem>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Convênio">
            <TextField
              control={control}
              name="healthInsurance"
              label="Convênio"
              placeholder="Particular, Unimed…"
            />
            <TextField
              control={control}
              name="healthInsuranceNumber"
              label="Número da carteirinha"
            />
          </Section>

          <Section title="Contato de emergência">
            <TextField
              control={control}
              name="emergencyContactName"
              label="Nome"
            />
            <PhoneField
              control={control}
              name="emergencyContactPhone"
              label="Telefone"
            />
          </Section>

          <FormField
            control={control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações administrativas</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Ex.: prefere ser contatado por WhatsApp"
                    maxLength={PATIENT_LIMITS.notes}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  Não registre aqui diagnósticos, exames ou prescrições: o
                  Avelliq não é um prontuário eletrônico.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              type="submit"
              disabled={upsertPatientAction.isPending}
              className="w-full"
            >
              {upsertPatientAction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default UpsertPatientForm;
