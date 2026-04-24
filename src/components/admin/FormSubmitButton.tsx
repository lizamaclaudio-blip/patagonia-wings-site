"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "danger";
};

export function FormSubmitButton({
  label,
  busyLabel,
  variant = "primary",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`button button-${variant}`}
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? busyLabel ?? "Guardando..." : label}
    </button>
  );
}
