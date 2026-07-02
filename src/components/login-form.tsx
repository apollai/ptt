"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace("/");
      }
    }

    void redirectIfLoggedIn();
  }, [router]);

  async function continueWithGoogle() {
    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined
      }
    });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <section className="w-full max-w-sm rounded-md border border-line bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">PTT Capstone</h1>
        <p className="mt-2 text-sm text-ink/70">
          Sign in with your allowed company Google account.
        </p>

        <button
          className="mt-5 min-h-12 w-full rounded-md bg-ink px-4 py-3 font-semibold text-white hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          type="button"
          onClick={continueWithGoogle}
        >
          Continue with Google
        </button>

        {message ? (
          <p className="mt-4 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
