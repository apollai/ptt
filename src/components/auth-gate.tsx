"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TimeTracker } from "@/components/time-tracker";

type AccessState = "checking" | "allowed" | "denied";

export function AuthGate() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [message, setMessage] = useState("Checking access...");
  const [deniedEmail, setDeniedEmail] = useState("");
  const accessDeniedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!data.session) {
        router.replace("/login");
        return;
      }

      console.log("Authenticated Supabase email:", data.session.user.email);
      setSession(data.session);
      await verifyAccess(data.session);
    }

    async function verifyAccess(currentSession: Session) {
      setAccessState("checking");
      setMessage("Checking access...");

      const response = await fetch("/api/auth/allowed", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`
        }
      });

      if (!isMounted) return;

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          authenticatedEmail?: string;
          error?: string;
        } | null;

        accessDeniedRef.current = true;
        setDeniedEmail(result?.authenticatedEmail ?? currentSession.user.email ?? "");
        setAccessState("denied");
        setMessage(
          response.status === 403
            ? "Access denied. This account is not allowed to use this app."
            : result?.error ?? "Authentication check failed."
        );
        await supabase.auth.signOut();
        setSession(null);
        return;
      }

      accessDeniedRef.current = false;
      setDeniedEmail("");
      setAccessState("allowed");
      setMessage("");
    }

    void checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        setSession(null);
        if (!accessDeniedRef.current) {
          router.replace("/login");
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (accessState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <p className="rounded-md border border-line bg-white px-4 py-3 text-sm text-ink shadow-soft">
          {message}
        </p>
      </main>
    );
  }

  if (accessState === "denied" || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm rounded-md border border-line bg-white p-5 shadow-soft">
          <h1 className="text-xl font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-sm text-ink/70">{message}</p>
          {deniedEmail ? (
            <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink">
              Authenticated email: {deniedEmail}
            </p>
          ) : null}
          <button
            className="mt-4 min-h-11 w-full rounded-md bg-ink px-4 py-2 font-semibold text-white hover:bg-moss"
            type="button"
            onClick={() => router.replace("/login")}
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return <TimeTracker userId={session.user.id} userEmail={session.user.email ?? ""} />;
}
