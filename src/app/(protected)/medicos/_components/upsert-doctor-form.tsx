import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { upsertDoctor } from "@/actions/upsert-doctor";
import {
  doctorDetailsProblems,
  doctorDetailsSchema,
  healthInsuranceSuggestions,
  MAX_HEALTH_INSURANCES,
  timeRangeRule,
} from "@/actions/upsert-doctor/schema";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doctorsTable } from "@/db/schema";
import { BRAZILIAN_STATES } from "@/helpers/cpf";
import { priceInReaisSchema, reaisToCents } from "@/helpers/currency";
import { actionErrorMessage } from "@/lib/action-errors";

import { medicalSpecialties } from "../_constants";

const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Nome é obrigatório." })
      .max(120, { message: "Use até 120 caracteres." }),
    specialty: z
      .string()
      .trim()
      .min(1, { message: "Especialidade é obrigatória." })
      .max(120, { message: "Use até 120 caracteres." }),
    appointmentPrice: priceInReaisSchema("Preço da consulta é obrigatório."),
    availableFromWeekDay: z.string(),
    availableToWeekDay: z.string(),
    availableFromTime: z.string().min(1, {
      message: "Hora de início é obrigatória.",
    }),
    availableToTime: z.string().min(1, {
      message: "Hora de término é obrigatória.",
    }),
  })
  .merge(doctorDetailsSchema.required({ acceptsPrivate: true }))
  .superRefine((data, ctx) => {
    if (!timeRangeRule.isValid(data.availableFromTime, data.availableToTime)) {
      ctx.addIssue({
        code: "custom",
        message: timeRangeRule.message,
        path: ["availableToTime"],
      });
    }
    for (const problem of doctorDetailsProblems(data)) {
      ctx.addIssue({
        code: "custom",
        message: problem.message,
        path: [problem.path],
      });
    }
  });

type FormValues = z.input<typeof formSchema>;

const WEEK_DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// Every half hour from 05:00 to 23:30, grouped as the day goes.
const TIME_GROUPS = [
  { label: "Manhã", from: 5, to: 12 },
  { label: "Tarde", from: 13, to: 18 },
  { label: "Noite", from: 19, to: 23 },
].map(({ label, from, to }) => ({
  label,
  times: Array.from(
    { length: to - from + 1 },
    (_, index) => from + index,
  ).flatMap((hour) => [
    `${hour}`.padStart(2, "0") + ":00",
    `${hour}`.padStart(2, "0") + ":30",
  ]),
}));

const defaultsFor = (
  doctor?: typeof doctorsTable.$inferSelect,
): FormValues => ({
  name: doctor?.name ?? "",
  specialty: doctor?.specialty ?? "",
  appointmentPrice: doctor?.appointmentPriceInCents
    ? doctor.appointmentPriceInCents / 100
    : 0,
  availableFromWeekDay: doctor?.availableFromWeekDay?.toString() ?? "1",
  availableToWeekDay: doctor?.availableToWeekDay?.toString() ?? "5",
  availableFromTime: doctor?.availableFromTime ?? "",
  availableToTime: doctor?.availableToTime ?? "",
  crmNumber: doctor?.crmNumber ?? "",
  crmState: doctor?.crmState ?? "",
  rqe: doctor?.rqe ?? "",
  phoneNumber: doctor?.phoneNumber ?? "",
  email: doctor?.email ?? "",
  acceptsPrivate: doctor?.acceptsPrivate ?? true,
  healthInsurances: doctor?.healthInsurances ?? [],
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

// The plans the doctor accepts, as removable chips. Enter or comma adds the
// typed name; plans are suggested as one types, the CRM state's first.
function HealthInsuranceInput({
  value,
  onChange,
  state,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  state?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = () => {
    const name = draft.trim().replace(/,$/, "").trim();
    setDraft("");
    if (
      name &&
      value.length < MAX_HEALTH_INSURANCES &&
      !value.some((item) => item.toLowerCase() === name.toLowerCase())
    ) {
      onChange([...value, name]);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          list={listId}
          maxLength={60}
          placeholder="Ex.: Unimed"
          aria-label="Adicionar convênio"
          onChange={(event) => {
            const next = event.target.value;
            if (next.endsWith(",")) {
              setDraft(next);
              setTimeout(add);
              return;
            }
            setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          Adicionar
        </Button>
        <datalist id={listId}>
          {healthInsuranceSuggestions(state)
            .filter((name) => !value.includes(name))
            .map((name) => (
              <option key={name} value={name} />
            ))}
        </datalist>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Convênios aceitos">
          {value.map((name) => (
            <li
              key={name}
              className="bg-muted flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs"
            >
              {name}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== name))}
                aria-label={`Remover ${name}`}
                className="hover:bg-background rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface UpsertDoctorFormProps {
  isOpen: boolean;
  doctor?: typeof doctorsTable.$inferSelect;
  onSuccess?: () => void;
}

const UpsertDoctorForm = ({
  doctor,
  onSuccess,
  isOpen,
}: UpsertDoctorFormProps) => {
  const form = useForm<FormValues>({
    shouldUnregister: true,
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(doctor),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(defaultsFor(doctor));
    }
  }, [isOpen, form, doctor]);

  const upsertDoctorAction = useAction(upsertDoctor, {
    onSuccess: () => {
      toast.success(
        doctor ? "Médico salvo." : "Médico adicionado com sucesso.",
      );
      onSuccess?.();
    },
    onError: ({ error }) => {
      toast.error(actionErrorMessage(error, "Erro ao salvar médico."));
    },
  });

  const onSubmit = (values: FormValues) => {
    const { appointmentPrice, ...rest } = values;
    upsertDoctorAction.execute({
      ...rest,
      id: doctor?.id,
      availableFromWeekDay: parseInt(values.availableFromWeekDay),
      availableToWeekDay: parseInt(values.availableToWeekDay),
      appointmentPriceInCents: reaisToCents(Number(appointmentPrice)),
    });
  };

  const daySelect = (name: "availableFromWeekDay" | "availableToWeekDay") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {name === "availableFromWeekDay" ? "Do dia" : "Até o dia"}
          </FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um dia" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {WEEK_DAYS.map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const timeSelect = (name: "availableFromTime" | "availableToTime") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {name === "availableFromTime" ? "Das" : "Até as"}
          </FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um horário" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {TIME_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.times.map((time) => (
                    <SelectItem key={time} value={`${time}:00`}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{doctor ? doctor.name : "Adicionar médico"}</DialogTitle>
        <DialogDescription>
          {doctor
            ? "Edite as informações desse médico."
            : "Adicione um novo médico."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Section title="Dados profissionais">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Especialidade</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma especialidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {medicalSpecialties.map((specialty) => (
                        <SelectItem
                          key={specialty.value}
                          value={specialty.value}
                        >
                          {specialty.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <FormField
                control={form.control}
                name="crmNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CRM</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Número"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="crmState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            </div>
            <FormField
              control={form.control}
              name="rqe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RQE (especialista)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="Opcional"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Contato">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Atendimento">
            <FormField
              control={form.control}
              name="appointmentPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço da consulta particular</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={Number(field.value)}
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
            <FormField
              control={form.control}
              name="acceptsPrivate"
              render={({ field }) => (
                <FormItem className="flex items-end">
                  <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    Atende particular
                  </label>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="healthInsurances"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Convênios aceitos</FormLabel>
                  <HealthInsuranceInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    state={form.watch("crmState")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          <Section title="Disponibilidade">
            {daySelect("availableFromWeekDay")}
            {daySelect("availableToWeekDay")}
            {timeSelect("availableFromTime")}
            {timeSelect("availableToTime")}
          </Section>

          <DialogFooter>
            <Button type="submit" disabled={upsertDoctorAction.isPending}>
              {upsertDoctorAction.isPending
                ? "Salvando..."
                : doctor
                  ? "Salvar"
                  : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default UpsertDoctorForm;
