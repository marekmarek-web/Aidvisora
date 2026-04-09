"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { createClient } from "@/lib/supabase/client";
import { continueClientInvitationAfterLogin, ensureClientPortalAccess } from "@/app/actions/auth";
import {
  CLIENT_INVITE_QUERY_PARAM,
  parseClientInviteTokenFromUrl,
  buildClientInvitePasswordSetupSearch,
} from "@/lib/auth/client-invite-url";
import {
  STAFF_INVITE_QUERY_PARAM,
  parseStaffInviteTokenFromUrl,
  buildStaffInviteRegisterCompletePath,
} from "@/lib/auth/staff-invite-url";

export type LoginRole = "advisor" | "client";

export function normalizeNextParam(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw === "/" || raw === "/prihlaseni" || raw === "/login" || raw === "/register") return fallback;
  return raw;
}

export function getInitialLoginMessage(errorParam: string | null): string {
  if (!errorParam) return "";
  if (errorParam === "otp_expired") return "Odkaz z e-mailu vypršel. Přihlaste se heslem nebo zaregistrujte se znovu.";
  if (errorParam === "database_error") return "Problém s připojením k databázi. Zkuste to za chvíli znovu.";
  if (errorParam === "auth_error") return "Přihlášení se nezdařilo. Zkontrolujte údaje nebo to zkuste znovu po chvíli.";
  if (errorParam === "client_no_access") {
    return "Účet nemá přiřazený klientský přístup. Požádejte svého poradce o pozvánku (e-mail s odkazem) nebo použijte odkaz z pozvánky.";
  }
  try {
    return decodeURIComponent(errorParam);
  } catch {
    return errorParam;
  }
}

function isNativeRuntime() {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() || Capacitor.isNativePlatform());
}

export function useAidvisoraLogin() {
  const searchParams = useSearchParams();
  const forceNative = searchParams.get("native") === "1";
  const nextParam = searchParams.get("next");
  const advisorNextPath = normalizeNextParam(nextParam, "/portal/today");
  const clientNextPath = normalizeNextParam(nextParam, "/client");
  const clientInviteToken = parseClientInviteTokenFromUrl(searchParams);
  const staffInviteToken = clientInviteToken ? null : parseStaffInviteTokenFromUrl(searchParams);
  const registerParam = searchParams.get("register");
  const errorParam = searchParams.get("error");

  const [role, setRole] = useState<LoginRole>(() => (clientInviteToken ? "client" : "advisor"));
  const [isLogin, setIsLogin] = useState(
    () => (clientInviteToken || staffInviteToken ? true : !searchParams.get("register")),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  /** Souhlas s OP / privacy / DPA + AI info při registraci poradce (e-mail i OAuth). */
  const [advisorLegalConsent, setAdvisorLegalConsent] = useState(false);
  const [message, setMessage] = useState(() => getInitialLoginMessage(errorParam));
  const [isMounted, setIsMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (clientInviteToken) setRole("client");
  }, [clientInviteToken]);

  useEffect(() => {
    const tok = clientInviteToken ?? staffInviteToken;
    const param = clientInviteToken ? CLIENT_INVITE_QUERY_PARAM : STAFF_INVITE_QUERY_PARAM;
    if (!tok) return;
    let cancelled = false;
    void fetch(`/api/invite/metadata?${param}=${encodeURIComponent(tok)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; email?: string } | null) => {
        if (cancelled || !data?.ok || typeof data.email !== "string") return;
        setEmail(data.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientInviteToken, staffInviteToken]);

  useEffect(() => {
    if (!forceNative || typeof document === "undefined") return;
    document.cookie = "mobile_ui_v1_beta=1; Path=/; Max-Age=31536000; SameSite=Lax";
  }, [forceNative]);

  useEffect(() => {
    if (isLogin) setAdvisorLegalConsent(false);
  }, [isLogin]);

  useEffect(() => {
    if (role === "client") setAdvisorLegalConsent(false);
  }, [role]);

  const isClient = role === "client";
  const isInviteFlow = Boolean(clientInviteToken);
  const hasError = Boolean(message);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setMessage("");

      const supabase = createClient();

      if (clientInviteToken) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setIsLoading(false);
          setMessage("Nesprávný e-mail nebo dočasné heslo. Zkontrolujte údaje z pozvánky.");
          return;
        }

        const result = await continueClientInvitationAfterLogin(clientInviteToken);
        setIsLoading(false);
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        if (result.nextStep === "change_password") {
          window.location.href = `/prihlaseni/nastavit-heslo?${buildClientInvitePasswordSetupSearch(clientInviteToken)}`;
          return;
        }
        window.location.href = "/client";
        return;
      }

      if (staffInviteToken) {
        if (isLogin) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          setIsLoading(false);
          if (error) {
            setMessage(error.message);
            return;
          }
        } else {
          if (!advisorLegalConsent) {
            setIsLoading(false);
            setMessage("Před vytvořením účtu potvrďte souhlas s právními dokumenty níže.");
            return;
          }
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          });
          setIsLoading(false);
          if (error) {
            if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("email rate")) {
              setMessage("Příliš mnoho pokusů. Zkuste to za 10–15 minut.");
            } else {
              setMessage(error.message);
            }
            return;
          }
        }
        window.location.href = buildStaffInviteRegisterCompletePath(staffInviteToken, advisorNextPath);
        return;
      }

      if (role === "client") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setIsLoading(false);
          setMessage(error.message);
          return;
        }
        const access = await ensureClientPortalAccess();
        setIsLoading(false);
        if (!access.ok) {
          setMessage(access.error);
          return;
        }
        if (access.redirectTo) {
          window.location.href = access.redirectTo;
          return;
        }
        window.location.href = clientNextPath;
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setIsLoading(false);
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.href = `/register/complete?next=${encodeURIComponent(advisorNextPath)}`;
      } else {
        if (!advisorLegalConsent) {
          setIsLoading(false);
          setMessage("Před vytvořením účtu potvrďte souhlas s právními dokumenty níže.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        setIsLoading(false);
        if (error) {
          if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("email rate")) {
            setMessage("Příliš mnoho pokusů. Zkuste to za 10–15 minut.");
          } else {
            setMessage(error.message);
          }
          return;
        }
        window.location.href = `/register/complete?next=${encodeURIComponent(advisorNextPath)}`;
      }
    },
    [
      clientInviteToken,
      staffInviteToken,
      email,
      password,
      advisorLegalConsent,
      role,
      isLogin,
      name,
      clientNextPath,
      advisorNextPath,
    ]
  );

  const handleOAuthSignIn = useCallback(
    async (provider: "google" | "apple") => {
      if (role !== "client" && !isLogin && !clientInviteToken && !staffInviteToken && !advisorLegalConsent) {
        setMessage("Před pokračováním přes Google nebo Apple potvrďte souhlas s právními dokumenty.");
        return;
      }
      const supabase = createClient();
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const nextPath =
        role === "client"
          ? clientNextPath
          : staffInviteToken
            ? buildStaffInviteRegisterCompletePath(staffInviteToken, advisorNextPath)
            : advisorNextPath;
      const encodedNext = encodeURIComponent(nextPath);
      const isNative = forceNative || isNativeRuntime();

      if (isNative) {
        // Native flow: redirect to the bridge route which passes the auth code
        // back to the app via deep link. The code is exchanged CLIENT-SIDE in
        // the WebView (NativeOAuthDeepLinkBridge) so the session ends up in the
        // correct cookie store.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${baseUrl}/auth/native-bridge`,
            skipBrowserRedirect: true,
          },
        });
        if (error) {
          setMessage(error.message);
          return;
        }
        if (data?.url) {
          await Browser.open({ url: data.url, windowName: "_self" });
        }
        return;
      }

      // Web flow: normal OAuth redirect handled entirely by the browser.
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${baseUrl}/auth/callback?next=${encodedNext}`,
        },
      });
    },
    [forceNative, role, isLogin, clientInviteToken, staffInviteToken, advisorLegalConsent, clientNextPath, advisorNextPath]
  );

  return {
    forceNative,
    token: clientInviteToken,
    staffInviteToken,
    registerParam,
    advisorNextPath,
    clientNextPath,
    role,
    setRole,
    isLogin,
    setIsLogin,
    showPassword,
    setShowPassword,
    isLoading,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    advisorLegalConsent,
    setAdvisorLegalConsent,
    message,
    setMessage,
    isMounted,
    isClient,
    isInviteFlow,
    hasError,
    formRef,
    handleSubmit,
    handleOAuthSignIn,
  };
}

export type AidvisoraLoginState = ReturnType<typeof useAidvisoraLogin>;
