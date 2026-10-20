"use client";

import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Gem,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Stethoscope,
  SunMoon,
  UserRound,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { switchClinic } from "@/actions/switch-clinic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { authClient } from "../../../lib/auth-client";
import { BlockedCreateDialog } from "./blocked-create-dialog";
import { NewClinicDialog } from "./new-clinic-dialog";
import { useSessionUser } from "./session-provider";

const items = [
  {
    title: "Dashboard",
    url: "/painel",
    icon: LayoutDashboard,
  },
  {
    title: "Agendamentos",
    url: "/agendamentos",
    icon: CalendarDays,
  },
  {
    title: "Médicos",
    url: "/medicos",
    icon: Stethoscope,
  },
  {
    title: "Pacientes",
    url: "/pacientes",
    icon: UsersRound,
  },
];

const otherItems = [
  {
    title: "Assinatura",
    url: "/assinatura",
    icon: Gem,
  },
];

// With a logo, the clinic's brand replaces Avelliq's at the top of the menu.
export function AppSidebar({
  logoUrl,
  isSupportStaff = false,
  canManageAccounts = false,
}: {
  logoUrl: string | null;
  // Avelliq's team also sees the support inbox; owners and admins also see
  // every account.
  isSupportStaff?: boolean;
  canManageAccounts?: boolean;
}) {
  const router = useRouter();
  const user = useSessionUser();
  const clinics = user.clinics;
  const activeClinicId = user.clinic?.id;
  const clinicLimit = user.clinicLimit;
  const canAddClinic =
    clinicLimit === null ||
    (clinicLimit !== undefined && clinics.length < clinicLimit);
  const switchClinicAction = useAction(switchClinic, {
    onSuccess: () => {
      router.refresh();
    },
    onError: () => {
      toast.error("Não foi possível trocar de clínica.");
    },
  });
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [clinicLimitOpen, setClinicLimitOpen] = useState(false);

  // On a phone the menu is a sheet over the page; once a page is chosen it
  // must get out of the way. Covers links and the footer menu alike.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  const [isOthersExpanded, setIsOthersExpanded] = useState(false);
  const [newClinicOpen, setNewClinicOpen] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/entrar");
        },
      },
    });
  };

  const isActive = (itemUrl: string) =>
    pathname === itemUrl || pathname.startsWith(`${itemUrl}/`);

  const toggleOthersSection = () => {
    setIsOthersExpanded(!isOthersExpanded);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link
          href="/painel"
          prefetch={false}
          aria-label={`${logoUrl && user.clinic ? user.clinic.name : "Avelliq"}, ir para o painel`}
          className="inline-block min-w-0"
        >
          {logoUrl && user.clinic ? (
            <span className="flex min-w-0 items-center gap-2">
              {/* A small logo served by the app; next/image adds nothing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md object-contain"
              />
              <span className="text-foreground truncate text-lg font-semibold tracking-tight">
                {user.clinic.name}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Image src="/logo-symbol.svg" alt="" width={28} height={28} />
              <span className="text-foreground text-xl font-semibold tracking-tight">
                Avelliq
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={
                      isActive(item.url)
                        ? "!bg-primary/5 !text-primary hover:!bg-primary/10 focus:!bg-primary/10 [&>svg]:!text-primary [&>span]:!text-primary"
                        : "hover:!bg-primary/5 hover:[&>svg]:!text-primary hover:[&>span]:!text-primary"
                    }
                  >
                    <Link href={item.url} prefetch={false}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Separator />
        <SidebarGroup>
          <SidebarGroupLabel
            className="hover:bg-primary/5 hover:text-primary -mx-2 -my-1 mb-0.5 flex cursor-pointer items-center justify-between rounded-md px-2 py-1"
            onClick={toggleOthersSection}
          >
            <span>Outros</span>
            {isOthersExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {isOthersExpanded && (
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  ...otherItems,
                  ...(isSupportStaff
                    ? [
                        {
                          title: "Atendimento",
                          url: "/atendimento",
                          icon: Inbox,
                        },
                      ]
                    : []),
                  ...(canManageAccounts
                    ? [{ title: "Contas", url: "/contas", icon: ShieldCheck }]
                    : []),
                ].map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className={
                        isActive(item.url)
                          ? "!bg-primary/5 !text-primary hover:!bg-primary/10 focus:!bg-primary/10 [&>svg]:!text-primary [&>span]:!text-primary"
                          : "hover:!bg-primary/5 hover:[&>svg]:!text-primary hover:[&>span]:!text-primary"
                      }
                    >
                      <Link href={item.url} prefetch={false}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar>
                    {user.image ? (
                      <AvatarImage src={user.image} alt={user.email} />
                    ) : (
                      <AvatarFallback>
                        {user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{user.clinic?.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {user.email}
                    </p>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>Clínicas</DropdownMenuLabel>
                {clinics.map((clinic) => (
                  <DropdownMenuItem
                    key={clinic.id}
                    disabled={switchClinicAction.isPending}
                    onClick={() =>
                      clinic.id !== activeClinicId &&
                      switchClinicAction.execute({ clinicId: clinic.id })
                    }
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        clinic.id === activeClinicId
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{clinic.name}</span>
                    {!clinic.writable && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        Só leitura
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onClick={() =>
                    canAddClinic
                      ? setNewClinicOpen(true)
                      : setClinicLimitOpen(true)
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova clínica
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/clinicas")}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Minhas clínicas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/configuracoes-da-clinica")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações da clínica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/minha-conta")}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Minha conta
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SunMoon className="mr-2 h-4 w-4" />
                    Tema
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={theme ?? "system"}
                      onValueChange={setTheme}
                    >
                      <DropdownMenuRadioItem value="light">
                        Claro
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark">
                        Escuro
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="system">
                        Igual ao sistema
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="focus:text-destructive mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NewClinicDialog
              open={newClinicOpen}
              onOpenChange={setNewClinicOpen}
            />
            <BlockedCreateDialog
              open={clinicLimitOpen}
              onOpenChange={setClinicLimitOpen}
              kind="limit"
              usageText={
                clinicLimit
                  ? `${clinics.length} de ${clinicLimit} clínicas`
                  : null
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
