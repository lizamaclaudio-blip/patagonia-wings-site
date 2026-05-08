import { supabase } from "@/lib/supabase/browser";

export type SecureRpcError = {
  message: string;
  code?: string | null;
  details?: unknown;
};

export type SecureRpcResponse<T = unknown> = {
  data: T | null;
  error: SecureRpcError | null;
};

export async function callSecureRpc<T = unknown>(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<SecureRpcResponse<T>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;

    const response = await fetch("/api/secure-rpc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        functionName,
        args: args ?? {},
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { data?: T; error?: SecureRpcError | string | null }
      | null;

    if (!response.ok) {
      const errorPayload = payload?.error;
      return {
        data: null,
        error:
          typeof errorPayload === "string"
            ? { message: errorPayload }
            : errorPayload ?? { message: `RPC_HTTP_${response.status}` },
      };
    }

    return {
      data: (payload?.data ?? null) as T | null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "SECURE_RPC_CLIENT_ERROR",
      },
    };
  }
}
