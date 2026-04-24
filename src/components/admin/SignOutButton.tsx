"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="button button-secondary" onClick={onSignOut} type="button">
      Cerrar sesión
    </button>
  );
}
