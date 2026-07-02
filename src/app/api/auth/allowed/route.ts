import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const rawAllowedEmail = process.env.ALLOWED_EMAIL;
  const allowedEmail = rawAllowedEmail?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Runtime ALLOWED_EMAIL:", rawAllowedEmail ?? "(undefined)");

  if (!allowedEmail || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Server auth is not configured. Check ALLOWED_EMAIL." },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const serverSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });

  const { data, error } = await serverSupabase.auth.getUser(token);

  if (error || !data.user.email) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  console.log("Authenticated email compared with ALLOWED_EMAIL:", {
    authenticatedEmail: data.user.email,
    allowedEmail
  });

  if (data.user.email !== allowedEmail) {
    return NextResponse.json(
      {
        error: "Access denied.",
        authenticatedEmail: data.user.email
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true, email: data.user.email });
}
