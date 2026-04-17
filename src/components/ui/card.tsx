import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
