"use client";

import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Runs a server action on click, with a pending state and an optional confirm prompt. */
export function ActionButton({
  action,
  confirm: confirmText,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & { action: () => Promise<unknown>; confirm?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const result = (await action()) as { error?: string } | undefined;
          if (result?.error) window.alert(result.error);
        });
      }}
    >
      {pending ? "…" : children}
    </Button>
  );
}
