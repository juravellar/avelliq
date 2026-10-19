import type { ReactNode } from "react";

import { SupportWidget } from "@/components/support/support-widget";

// The centered frame shared by the public account pages (forgot and reset
// password), matching the sign-in page.
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-[480px]">{children}</div>
      <SupportWidget supportEmail={process.env.SUPPORT_EMAIL ?? null} />
    </div>
  );
}
