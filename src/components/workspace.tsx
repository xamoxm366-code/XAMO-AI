"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  History,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  PanelLeftClose,
  PenLine,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { safeUrl } from "@/lib/chat";

type Source = { title: string; url: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  preview?: boolean;
  sources?: Source[];
  searchSuggestions?: string;
};
type Chat = { id: string; title: string; messages: Message[]; updated: number };
type Preferences = {
  name: string;
  language: string;
  persona: "Balanced" | "Concise" | "Creative" | "Teacher";
  speak: boolean;
};
type Modal =
  | "auth"
  | "settings"
  | "search"
  | "explore"
  | "guide"
  | "admin"
  | null;
type AdminData = {
  users: {
    id: string;
    email: string;
    verified: boolean;
    banned: boolean;
    created: string;
  }[];
  settings: { ai_enabled: boolean; daily_limit: number };
  providerConnected: boolean;
  webSearch: boolean;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
const defaults: Preferences = {
  name: "",
  language: "Auto-detect",
  persona: "Balanced",
  speak: false,
};
const storageKey = "xamo.workspace.v1";
const suggestions = [
  {
    icon: Globe2,
    name: "Explore the world",
    detail: "A fresh perspective on anything",
    prompt: "Help me explore a fascinating topic I might not know about.",
    color: "blue",
  },
  {
    icon: PenLine,
    name: "Create something",
    detail: "Find the words you’re looking for",
    prompt: "Give me a creative writing prompt to spark a short story.",
    color: "purple",
  },
  {
    icon: Code2,
    name: "Build an idea",
    detail: "From “what if” to your next project",
    prompt: "Help me break down a new project idea into practical steps.",
    color: "green",
  },
  {
    icon: Lightbulb,
    name: "Make a plan",
    detail: "A little clarity for your busy day",
    prompt: "Help me plan a productive day with time for myself.",
    color: "amber",
  },
];
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`}>
      <Sparkles strokeWidth={1.7} />
    </span>
  );
}
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.32-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.51l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.99 5.99 0 0 1 12 5.96Z"
      />
    </svg>
  );
}
export default function Workspace() {
  const [chats, setChats] = useState<Chat[]>([]),
    [activeId, setActiveId] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(defaults),
    [draftPrefs, setDraftPrefs] = useState(defaults);
  const [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [web, setWeb] = useState(false),
    [attachment, setAttachment] = useState<{
      name: string;
      text: string;
    } | null>(null);
  const [modal, setModal] = useState<Modal>(null),
    [sidebar, setSidebar] = useState(false),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null),
    [authMode, setAuthMode] = useState<
      "signin" | "signup" | "forgot" | "reset"
    >("signin"),
    [authBusy, setAuthBusy] = useState(false),
    [authInfo, setAuthInfo] = useState("");
  const [admin, setAdmin] = useState<AdminData | null>(null),
    [adminAllowed, setAdminAllowed] = useState(false),
    [adminBusy, setAdminBusy] = useState(false),
    [adminError, setAdminError] = useState("");
  const [listening, setListening] = useState(false),
    [speaking, setSpeaking] = useState<string | null>(null),
    [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    bottomRef = useRef<HTMLDivElement>(null),
    abortRef = useRef<AbortController | null>(null),
    recognitionRef = useRef<Recognition | null>(null),
    dialogRef = useRef<HTMLDivElement>(null);
  const active = chats.find((c) => c.id === activeId),
    messages = active?.messages || [];
  const notify = (message: string) => setToast(message);
  const openAuth = (mode: typeof authMode = "signin") => {
    setAuthMode(mode);
    setAuthInfo("");
    setModal("auth");
  };
  function newChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setInput("");
    setAttachment(null);
    setSidebar(false);
    inputRef.current?.focus();
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (Array.isArray(saved.chats))
        setChats(
          saved.chats.filter(
            (c: Chat) =>
              typeof c.id === "string" &&
              typeof c.title === "string" &&
              Array.isArray(c.messages) &&
              c.messages.every(
                (m) =>
                  typeof m.content === "string" &&
                  ["user", "assistant"].includes(m.role),
              ),
          ),
        );
      if (saved.prefs) setPrefs({ ...defaults, ...saved.prefs });
    } catch {
      /* Corrupt browser data does not prevent opening a new workspace. */
    }
    setReady(true);
    const auth = supabase?.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setModal("auth");
      } else if (event === "SIGNED_IN") {
        setModal((current) => (current === "auth" ? null : current));
      }
    });
    supabase?.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user || null));
    return () => {
      auth?.data.subscription.unsubscribe();
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify({ chats, prefs }));
      } catch {
        setToast(
          "Device storage is full. Export your conversations to keep a copy.",
        );
      }
  }, [chats, prefs, ready]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setModal("search");
      }
      if (event.key === "Escape") {
        setModal(null);
        setSidebar(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(
      () =>
        dialogRef.current
          ?.querySelector<HTMLElement>("input, button, select, textarea")
          ?.focus(),
      40,
    );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea, select, a[href]",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAdminAllowed(false);
      setAdmin(null);
      return;
    }
    getAdmin().then((data) => {
      if (!cancelled) {
        setAdminAllowed(!!data);
        setAdmin(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  async function headers() {
    const session = await supabase?.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.data.session
        ? { Authorization: `Bearer ${session.data.session.access_token}` }
        : {}),
    };
  }
  async function getAdmin() {
    try {
      const response = await fetch("/api/admin", { headers: await headers() });
      return response.ok ? ((await response.json()) as AdminData) : null;
    } catch {
      return null;
    }
  }
  async function send(text = input) {
    if (busy || !text.trim()) return;
    const content =
      text.trim() +
      (attachment
        ? `\n\nAttached file: ${attachment.name}\n\n${attachment.text}`
        : "");
    if (content.length > 24000) {
      notify(
        "Please keep your message and attachment under 24,000 characters.",
      );
      return;
    }
    const id = activeId || crypto.randomUUID(),
      message: Message = { id: crypto.randomUUID(), role: "user", content };
    const history = [...messages, message];
    setChats((prev) =>
      active
        ? prev.map((c) =>
            c.id === id ? { ...c, messages: history, updated: Date.now() } : c,
          )
        : [
            {
              id,
              title: text.trim().slice(0, 48),
              messages: history,
              updated: Date.now(),
            },
            ...prev,
          ],
    );
    setActiveId(id);
    setInput("");
    setAttachment(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: await headers(),
        signal: controller.signal,
        body: JSON.stringify({
          messages: history
            .slice(-39)
            .map(({ role, content }) => ({ role, content })),
          language: prefs.language,
          persona: prefs.persona,
          webSearch: web,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Something went wrong. Please try again.",
        );
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text,
        sources: data.sources,
        preview: data.preview,
        searchSuggestions: data.searchSuggestions,
      };
      setChats((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, messages: [...c.messages, reply] } : c,
        ),
      );
      if (prefs.speak) speak(reply.content, reply.id);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        notify(error.message);
        setInput(text);
        setChats((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== message.id),
                }
              : c,
          ),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setAuthInfo(
        "Accounts are not connected yet. Follow the Setup guide to configure Supabase, or continue as a guest.",
      );
      return;
    }
    const fields = new FormData(event.currentTarget),
      email = String(fields.get("email") || ""),
      password = String(fields.get("password") || "");
    setAuthBusy(true);
    setAuthInfo("");
    try {
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin,
                data: { full_name: String(fields.get("name") || "") },
              },
            })
          : authMode === "forgot"
            ? await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
              })
            : authMode === "reset"
              ? await supabase.auth.updateUser({ password })
              : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === "signup")
        setAuthInfo(
          "Check your inbox for a verification link. Verify your email before signing in.",
        );
      else if (authMode === "forgot")
        setAuthInfo(
          "If this email has an account, a password reset link is on its way.",
        );
      else {
        setModal(null);
        notify(
          authMode === "reset"
            ? "Your password has been updated."
            : "Welcome back to your space.",
        );
      }
    } catch (error) {
      setAuthInfo(
        error instanceof Error
          ? error.message
          : "Unable to connect. Please try again.",
      );
    } finally {
      setAuthBusy(false);
    }
  }
  async function googleLogin() {
    if (!supabase) {
      setAuthInfo(
        "Google sign-in needs Supabase and a Google OAuth client. The Setup guide explains how to connect them.",
      );
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthInfo(error.message);
  }
  function speak(text: string, id: string) {
    if (!window.speechSynthesis) {
      notify("Read aloud is not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking === id) {
      setSpeaking(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
    const langs: Record<string, string> = {
      English: "en-US",
      Urdu: "ur-PK",
      Hindi: "hi-IN",
      Arabic: "ar-SA",
      Spanish: "es-ES",
      French: "fr-FR",
      German: "de-DE",
      Chinese: "zh-CN",
      Japanese: "ja-JP",
      Portuguese: "pt-BR",
    };
    utterance.lang = langs[prefs.language] || navigator.language;
    utterance.onend = () => setSpeaking(null);
    utterance.onerror = () => {
      setSpeaking(null);
      notify("This voice is unavailable. Try another language or browser.");
    };
    setSpeaking(id);
    window.speechSynthesis.speak(utterance);
  }
  function dictate() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const BrowserRecognition =
      (
        window as unknown as {
          SpeechRecognition?: new () => Recognition;
          webkitSpeechRecognition?: new () => Recognition;
        }
      ).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
        .webkitSpeechRecognition;
    if (!BrowserRecognition) {
      notify(
        "Voice input is not supported here. Try Chrome with microphone access.",
      );
      return;
    }
    const recognition = new BrowserRecognition();
    recognitionRef.current = recognition;
    recognition.lang =
      (
        {
          Urdu: "ur-PK",
          Hindi: "hi-IN",
          Arabic: "ar-SA",
          Spanish: "es-ES",
          French: "fr-FR",
          German: "de-DE",
          Chinese: "zh-CN",
          Japanese: "ja-JP",
          Portuguese: "pt-BR",
          English: "en-US",
        } as Record<string, string>
      )[prefs.language] || navigator.language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) =>
      setInput(
        (prev) => `${prev}${prev ? " " : ""}${event.results[0][0].transcript}`,
      );
    recognition.onerror = () => {
      setListening(false);
      notify("Microphone access failed. Check your browser permissions.");
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      notify("Could not start the microphone. Please try again.");
    }
  }
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), chats },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "xamo-conversations.json";
    link.click();
    URL.revokeObjectURL(url);
    notify("Your conversations have been exported.");
  }
  async function updateAdmin(body: object) {
    setAdminBusy(true);
    setAdminError("");
    try {
      const result = await fetch("/api/admin", {
        method: "PATCH",
        headers: await headers(),
        body: JSON.stringify(body),
      });
      if (!result.ok) throw new Error("Could not save this change.");
      const data = await getAdmin();
      if (!data) throw new Error("Could not reload administrator data.");
      setAdmin(data);
      notify("Admin settings saved.");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setAdminBusy(false);
    }
  }
  function pickPrompt(prompt: string) {
    setInput(prompt);
    setModal(null);
    inputRef.current?.focus();
  }
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "is-open" : ""}`}>
        <a className="brand" href="/" aria-label="XAMO AI home">
          <Mark />
          <span>
            XAMO<span className="brand-ai"> AI</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <button className="new-chat" onClick={newChat}>
          <Plus size={18} />
          <span>New conversation</span>
          <span className="keycap">⌘ K</span>
        </button>
        <nav className="primary-nav" aria-label="Workspace">
          <button onClick={() => setModal("search")}>
            <Search />
            <span>Search conversations</span>
          </button>
          <button onClick={() => setModal("explore")}>
            <Compass />
            <span>Explore XAMO</span>
            <span className="new-label">NEW</span>
          </button>
        </nav>
        <div className="history-heading">
          <span>YOUR CONVERSATIONS</span>
          <button
            className="icon-button"
            title="Search history"
            onClick={() => setModal("search")}
          >
            <History size={14} />
          </button>
        </div>
        <div className="history-list">
          {chats.length ? (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`history-item ${activeId === chat.id ? "active" : ""}`}
              >
                <button
                  className="chat-link"
                  onClick={() => {
                    if (busy) abortRef.current?.abort();
                    setActiveId(chat.id);
                    setSidebar(false);
                  }}
                >
                  <MessageCircle size={15} />
                  <span>{chat.title}</span>
                </button>
                <button
                  className="delete-chat"
                  aria-label={`Delete ${chat.title}`}
                  onClick={() => {
                    if (chat.id === activeId) newChat();
                    setChats((prev) => prev.filter((c) => c.id !== chat.id));
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-history">
              <MessageCircle size={18} />
              <p>A fresh start.</p>
              <span>Your conversations will live here.</span>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="possibility-card">
            <span className="mini-spark">
              <Zap size={15} />
            </span>
            <h3>A little help. A lot of possibility.</h3>
            <p>Meet your everyday thinking partner.</p>
            <button onClick={() => setModal("explore")}>
              See what’s possible <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="sidebar-settings"
            onClick={() => {
              setDraftPrefs(prefs);
              setModal("settings");
            }}
          >
            <Settings2 size={17} />
            Settings & preferences
          </button>
          {adminAllowed && (
            <button
              className="sidebar-settings"
              onClick={() => setModal("admin")}
            >
              <ShieldCheck size={17} />
              Admin dashboard
            </button>
          )}
          <div className="account-row">
            <span className="avatar">
              {(prefs.name || user?.email || "G")[0].toUpperCase()}
            </span>
            <button
              onClick={() =>
                user ? (setDraftPrefs(prefs), setModal("settings")) : openAuth()
              }
            >
              <strong>
                {prefs.name ||
                  user?.user_metadata?.full_name ||
                  (user ? user.email?.split("@")[0] : "Guest explorer")}
              </strong>
              <span>{user ? "Personal account" : "Your personal space"}</span>
            </button>
            <button
              className="icon-button"
              aria-label={user ? "Account settings" : "Sign in"}
              onClick={() =>
                user ? (setDraftPrefs(prefs), setModal("settings")) : openAuth()
              }
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="creator">
          MADE WITH CURIOSITY BY <span>ZAEEM</span>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="workspace-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span className="desktop-panel-icon">
              <PanelLeftClose size={17} />
            </span>
            <span>Personal workspace</span>
            <ChevronRight size={13} />
            <strong>{active?.title || "New conversation"}</strong>
          </div>
          <div className="topbar-actions">
            <span className="free-badge">
              <span />
              Free plan
            </span>
            {user ? (
              <button
                className="profile-button"
                aria-label="Open account settings"
                onClick={() => {
                  setDraftPrefs(prefs);
                  setModal("settings");
                }}
              >
                {(user.email || "U")[0].toUpperCase()}
              </button>
            ) : (
              <button className="signin-button" onClick={() => openAuth()}>
                Sign in <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </header>
        <div
          className={`conversation-area ${messages.length ? "has-messages" : ""}`}
        >
          {!messages.length ? (
            <section className="welcome">
              <div className="welcome-eyebrow">
                <span className="status-dot" /> YOUR EVERYDAY, REIMAGINED
              </div>
              <div className="hero-mark">
                <Sparkles strokeWidth={1.15} />
                <span className="orbit-dot" />
              </div>
              <h1>
                Good to see you{prefs.name ? `, ${prefs.name}` : ""}.<br />
                <span>What’s on your mind?</span>
              </h1>
              <p className="hero-description">
                Big questions, small curiosities, and everything in between.
                <br className="desktop-break" /> Make a little more possible
                with XAMO.
              </p>
              <div className="suggestion-grid">
                {suggestions.map(
                  ({ icon: Icon, name, detail, prompt, color }) => (
                    <button
                      className="suggestion-card"
                      key={name}
                      onClick={() => pickPrompt(prompt)}
                    >
                      <div className={`suggestion-icon ${color}`}>
                        <Icon size={19} strokeWidth={1.7} />
                      </div>
                      <h2>{name}</h2>
                      <p>{detail}</p>
                      <ArrowUpRight className="card-arrow" size={16} />
                    </button>
                  ),
                )}
              </div>
              <div className="starter-label">
                <span />A thought starter, if you need one
                <span />
              </div>
              <button
                className="daily-prompt"
                onClick={() =>
                  pickPrompt(
                    "Teach me something surprising about the world in five minutes.",
                  )
                }
              >
                <Sparkles size={13} />
                “Teach me something surprising in five minutes”
                <ArrowUpRight size={13} />
              </button>
            </section>
          ) : (
            <section className="message-list" aria-label="Conversation">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-author">
                    {message.role === "assistant" ? (
                      <Mark small />
                    ) : (
                      <span className="user-message-avatar">
                        {(prefs.name || "Y")[0]}
                      </span>
                    )}
                    <strong>
                      {message.role === "assistant" ? "XAMO" : "You"}
                    </strong>
                    {message.preview && (
                      <span className="preview-tag">Preview response</span>
                    )}
                    {!!message.sources?.length && (
                      <span className="source-tag">
                        <Globe2 size={11} />
                        Web sources
                      </span>
                    )}
                  </div>
                  <div className="message-body" dir="auto">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href && safeUrl(href) ? href : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {!!message.sources?.length && (
                    <div className="sources">
                      {message.sources.map((source, index) => (
                        <a
                          key={index}
                          href={safeUrl(source.url) ? source.url : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe2 size={12} />
                          {source.title}
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                  {message.searchSuggestions && (
                    <iframe
                      className="search-suggestions"
                      title="Google Search suggestions"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      srcDoc={message.searchSuggestions}
                    />
                  )}
                  {message.role === "assistant" && (
                    <div className="message-actions">
                      <button
                        aria-label="Copy response"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              message.content,
                            );
                            setCopied(message.id);
                            setTimeout(() => setCopied(null), 2000);
                          } catch {
                            notify(
                              "Your browser could not copy this response.",
                            );
                          }
                        }}
                      >
                        {copied === message.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        aria-label={
                          speaking === message.id
                            ? "Stop reading"
                            : "Read aloud"
                        }
                        onClick={() => speak(message.content, message.id)}
                      >
                        {speaking === message.id ? (
                          <Square size={14} />
                        ) : (
                          <Volume2 size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {busy && (
                <div className="thinking">
                  <Mark small />
                  <span>XAMO is thinking</span>
                  <span className="thinking-dots">···</span>
                </div>
              )}
              <div ref={bottomRef} />
            </section>
          )}
        </div>
        <div className="composer-area">
          <div className="composer-topline">
            <span>
              <span className="status-dot" /> A little curiosity goes a long way
            </span>
            <button
              onClick={() => {
                setDraftPrefs(prefs);
                setModal("settings");
              }}
            >
              <Globe2 size={12} />
              {prefs.language === "Auto-detect"
                ? "All languages welcome"
                : prefs.language}
              <ChevronDown size={12} />
            </button>
          </div>
          <form
            className={`composer ${listening ? "listening" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            {attachment && (
              <div className="attachment">
                <FileText size={13} />
                {attachment.name}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachment(null)}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              aria-label="Message XAMO"
              placeholder={
                listening
                  ? "Listening… tell me what’s on your mind."
                  : "Ask anything, or dream up something new…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={24000}
            />
            <div className="composer-toolbar">
              <div className="composer-tools">
                <button
                  className="icon-button"
                  title="Attach a text file"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus size={21} />
                </button>
                <span className="toolbar-divider" />
                <button
                  className={`web-toggle ${web ? "enabled" : ""}`}
                  aria-pressed={web}
                  type="button"
                  onClick={() => setWeb(!web)}
                >
                  <Globe2 size={15} />
                  <span>Web search</span>
                  {web && <span className="small-dot" />}
                </button>
                <button
                  type="button"
                  className="icon-button clock-button"
                  title="Show current date and time"
                  onClick={() =>
                    notify(
                      new Intl.DateTimeFormat(undefined, {
                        dateStyle: "full",
                        timeStyle: "short",
                      }).format(new Date()),
                    )
                  }
                >
                  <Clock3 size={16} />
                </button>
              </div>
              <div className="composer-right">
                <span className="model-name">
                  <Zap size={12} />
                  XAMO
                </span>
                <button
                  className={`icon-button mic-button ${listening ? "recording" : ""}`}
                  aria-label={
                    listening ? "Stop voice input" : "Start voice input"
                  }
                  type="button"
                  onClick={dictate}
                >
                  {listening ? <AudioLines size={18} /> : <Mic size={18} />}
                </button>
                {busy ? (
                  <button
                    className="send-button"
                    type="button"
                    aria-label="Stop generating"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <Square size={15} />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send message"
                  >
                    <ArrowUp size={20} />
                  </button>
                )}
              </div>
            </div>
          </form>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (!/\.(txt|md|csv|json)$/i.test(file.name)) {
                notify("Choose a TXT, Markdown, CSV, or JSON file.");
                return;
              }
              if (file.size > 20000) {
                notify("Please choose a text file smaller than 20 KB.");
                return;
              }
              try {
                setAttachment({ name: file.name, text: await file.text() });
                inputRef.current?.focus();
              } catch {
                notify("This file could not be read.");
              }
            }}
          />
          <div className="composer-disclaimer">
            <span>XAMO can make mistakes. A curious mind double-checks.</span>
            <span className="privacy-note">
              <ShieldCheck size={11} />
              Chats saved on this device
            </span>
          </div>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            ref={dialogRef}
            className={`modal ${modal === "auth" ? "auth-modal" : ""} ${modal === "guide" || modal === "admin" ? "wide-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "auth" && (
              <>
                <div className="auth-brand">
                  <Mark />
                </div>
                <span className="section-eyebrow">
                  YOUR NEXT CHAPTER STARTS HERE
                </span>
                <h2 id="modal-title">
                  {authMode === "signup"
                    ? "A space of your own."
                    : authMode === "forgot"
                      ? "Let’s get you back in."
                      : authMode === "reset"
                        ? "A fresh start."
                        : "Welcome to XAMO."}
                </h2>
                <p className="modal-description">
                  {authMode === "signup"
                    ? "One account. A world of possibilities."
                    : authMode === "forgot"
                      ? "We’ll email you a link to reset your password."
                      : authMode === "reset"
                        ? "Choose a strong new password for your account."
                        : "Bring your questions. We’ll bring a little spark."}
                </p>
                {(authMode === "signin" || authMode === "signup") && (
                  <>
                    <button className="google-button" onClick={googleLogin}>
                      <GoogleMark />
                      Continue with Google
                    </button>
                    <div className="or-divider">
                      <span />
                      or continue with email
                      <span />
                    </div>
                  </>
                )}
                <form onSubmit={authenticate} className="auth-form">
                  {authMode === "signup" && (
                    <label>
                      Your name
                      <input
                        name="name"
                        placeholder="How should we call you?"
                        required
                        autoComplete="name"
                        maxLength={60}
                      />
                    </label>
                  )}
                  {authMode !== "reset" && (
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                      />
                    </label>
                  )}
                  {authMode !== "forgot" && (
                    <label>
                      <span className="label-row">
                        Password
                        {authMode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("forgot");
                              setAuthInfo("");
                            }}
                          >
                            Forgot password?
                          </button>
                        )}
                      </span>
                      <input
                        name="password"
                        type="password"
                        placeholder={
                          authMode === "signup" || authMode === "reset"
                            ? "At least 8 characters"
                            : "Enter your password"
                        }
                        minLength={authMode === "signin" ? 1 : 8}
                        required
                        autoComplete={
                          authMode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                      />
                    </label>
                  )}
                  {authInfo && (
                    <p className="form-notice" role="status">
                      {authInfo}
                    </p>
                  )}
                  <button className="primary-button" disabled={authBusy}>
                    {authBusy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <>
                        {authMode === "signup"
                          ? "Create account"
                          : authMode === "forgot"
                            ? "Send reset link"
                            : authMode === "reset"
                              ? "Update password"
                              : "Sign in"}
                        <ArrowUpRight size={16} />
                      </>
                    )}
                  </button>
                </form>
                <p className="auth-switch">
                  {authMode === "signin"
                    ? "New around here?"
                    : authMode === "signup"
                      ? "Already have an account?"
                      : "Remember your password?"}{" "}
                  <button
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setAuthInfo("");
                    }}
                  >
                    {authMode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
                <button className="guest-button" onClick={() => setModal(null)}>
                  Keep exploring as a guest <ArrowUpRight size={13} />
                </button>
                <p className="auth-footnote">
                  Created by Zaeem. Built for your curiosity.
                </p>
              </>
            )}
            {modal === "search" && (
              <>
                <span className="section-eyebrow">
                  PICK UP WHERE YOU LEFT OFF
                </span>
                <h2 id="modal-title">Your conversations.</h2>
                <div className="search-field">
                  <Search size={19} />
                  <input
                    placeholder="Search your conversations…"
                    aria-label="Search conversations"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  <span>⌘ K</span>
                </div>
                <div className="search-results">
                  {chats
                    .filter((c) =>
                      `${c.title} ${c.messages.map((m) => m.content).join(" ")}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (busy) abortRef.current?.abort();
                          setActiveId(c.id);
                          setModal(null);
                          setSidebar(false);
                        }}
                      >
                        <MessageCircle size={18} />
                        <span>
                          <strong>{c.title}</strong>
                          <small>
                            {c.messages.length} messages ·{" "}
                            {new Date(c.updated).toLocaleDateString()}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  {!chats.some((c) =>
                    `${c.title} ${c.messages.map((m) => m.content).join(" ")}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  ) && (
                    <div className="empty-state">
                      <Search size={28} />
                      <h3>
                        {query
                          ? "No conversations found"
                          : "Your story starts here"}
                      </h3>
                      <p>
                        {query
                          ? "Try a different word or start something new."
                          : "Start a conversation and come back to it anytime."}
                      </p>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          newChat();
                          setModal(null);
                        }}
                      >
                        Start a conversation
                        <Plus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {modal === "explore" && (
              <>
                <span className="section-eyebrow">A LITTLE INSPIRATION</span>
                <h2 id="modal-title">Where will curiosity take you?</h2>
                <p className="modal-description">
                  A thinking partner for the things that matter to you.
                </p>
                <div className="explore-grid">
                  {[
                    ...suggestions,
                    {
                      icon: BookOpen,
                      name: "Learn something",
                      detail: "Make complex ideas click",
                      prompt:
                        "Explain a fascinating scientific idea using everyday examples.",
                      color: "blue",
                    },
                    {
                      icon: MessageCircle,
                      name: "Find your voice",
                      detail: "Practice a new language",
                      prompt:
                        "Be my language practice partner. First ask which language I want to learn and my current level.",
                      color: "purple",
                    },
                  ].map(({ icon: Icon, name, detail, prompt, color }) => (
                    <button key={name} onClick={() => pickPrompt(prompt)}>
                      <span className={`suggestion-icon ${color}`}>
                        <Icon size={20} />
                      </span>
                      <strong>{name}</strong>
                      <p>{detail}</p>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
                <div className="soft-notice">
                  <ShieldCheck size={18} />
                  <p>
                    Text, ideas, and conversations. No image or video
                    generation. Responses need a connected AI provider; voice
                    availability depends on your browser.
                  </p>
                </div>
              </>
            )}
            {modal === "settings" && (
              <>
                <span className="section-eyebrow">YOUR SPACE, YOUR WAY</span>
                <h2 id="modal-title">Make it yours.</h2>
                <p className="modal-description">
                  A few little things to help XAMO feel more like you.
                </p>
                <div className="settings-form">
                  <label>
                    What should we call you?
                    <input
                      value={draftPrefs.name}
                      placeholder="Your nickname"
                      maxLength={30}
                      onChange={(e) =>
                        setDraftPrefs({ ...draftPrefs, name: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-columns">
                    <label>
                      Response language
                      <select
                        value={draftPrefs.language}
                        onChange={(e) =>
                          setDraftPrefs({
                            ...draftPrefs,
                            language: e.target.value,
                          })
                        }
                      >
                        {[
                          "Auto-detect",
                          "English",
                          "Urdu",
                          "Hindi",
                          "Arabic",
                          "Spanish",
                          "French",
                          "German",
                          "Chinese",
                          "Japanese",
                          "Portuguese",
                        ].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assistant style
                      <select
                        value={draftPrefs.persona}
                        onChange={(e) =>
                          setDraftPrefs({
                            ...draftPrefs,
                            persona: e.target.value as Preferences["persona"],
                          })
                        }
                      >
                        {["Balanced", "Concise", "Creative", "Teacher"].map(
                          (p) => (
                            <option key={p}>{p}</option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <div className="setting-row">
                    <span className="setting-icon">
                      <Volume2 size={19} />
                    </span>
                    <div>
                      <strong>Read responses aloud</strong>
                      <p>Use your browser’s available voices.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draftPrefs.speak}
                      aria-label="Read responses aloud"
                      className={`switch ${draftPrefs.speak ? "on" : ""}`}
                      onClick={() =>
                        setDraftPrefs({
                          ...draftPrefs,
                          speak: !draftPrefs.speak,
                        })
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <div className="setting-row">
                    <span className="setting-icon">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <strong>Private by default on this device</strong>
                      <p>
                        Chats are stored locally. Prompts are sent to the AI
                        provider when connected. Signing in does not sync
                        history.
                      </p>
                    </div>
                    <span className="local-tag">LOCAL</span>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setPrefs(draftPrefs);
                      setModal(null);
                      notify("Your preferences are saved.");
                    }}
                  >
                    Save preferences
                    <Check size={16} />
                  </button>
                  <div className="settings-links">
                    <button onClick={download}>
                      <Download size={15} />
                      Export chats
                    </button>
                    <button onClick={() => setModal("guide")}>
                      <BookOpen size={15} />
                      Setup guide
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                  {user && (
                    <button
                      className="logout-button"
                      onClick={async () => {
                        const result = await supabase?.auth.signOut();
                        if (result?.error) {
                          notify(result.error.message);
                          return;
                        }
                        setUser(null);
                        setModal(null);
                        notify(
                          "You’re signed out. Local chats remain on this device.",
                        );
                      }}
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  )}
                  <details className="danger-zone">
                    <summary>Manage local data</summary>
                    <p>
                      This removes every conversation saved in this browser.
                      Export a copy first if you want to keep them.
                    </p>
                    <button
                      onClick={() => {
                        abortRef.current?.abort();
                        setChats([]);
                        setActiveId(null);
                        notify("All local conversations have been cleared.");
                      }}
                    >
                      Delete all local conversations
                      <Trash2 size={14} />
                    </button>
                  </details>
                </div>
              </>
            )}
            {modal === "guide" && (
              <>
                <span className="section-eyebrow">
                  FROM FIRST SPARK TO FIRST LAUNCH
                </span>
                <h2 id="modal-title">Your 10-day launch plan.</h2>
                <p className="modal-description">
                  Start small. Connect the essentials. Build from there.
                </p>
                <div className="guide-steps">
                  {[
                    {
                      day: "01–02",
                      title: "Make this workspace yours",
                      text: "Open this repository in VS Code. Run npm install, copy .env.example to .env.local, then run npm run dev. Guest chats and preferences work right away.",
                    },
                    {
                      day: "03–04",
                      title: "Connect AI and accounts",
                      text: "Create Google AI Studio and Supabase projects. Set the environment variables listed in .env.example. Run supabase/schema.sql in the Supabase SQL editor. Live AI requires this quota setup.",
                    },
                    {
                      day: "05–06",
                      title: "Set up sign-in and your admin account",
                      text: "In Supabase Auth, enable email confirmation and Google. Configure the Google OAuth client and callback URL. Set your verified email in the server-only ADMIN_EMAILS variable. Sign in to see the admin dashboard.",
                    },
                    {
                      day: "07–08",
                      title: "Test the complete journey",
                      text: "Test signup, email verification, Google login, password reset, AI replies, language choices, usage limits, and admin access. Enable live search only after checking your provider’s current pricing and search-display requirements.",
                    },
                    {
                      day: "09–10",
                      title: "Launch on Vercel",
                      text: "Push your project to GitHub, import it into Vercel, and add environment variables. Set the production URL and redirect allowlist in Supabase. Vercel provides a vercel.app address; a custom domain can cost extra.",
                    },
                  ].map((step) => (
                    <div className="guide-step" key={step.day}>
                      <span>{step.day}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="soft-notice">
                  <ShieldCheck size={20} />
                  <p>
                    A website cannot open and close arbitrary apps or read
                    private notifications. That needs a separately installed
                    device companion, explicit permissions, and its own
                    development phase. Free tiers have limits; unlimited usage
                    and perfect language support cannot be promised.
                  </p>
                </div>
                <div className="guide-links">
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google AI Studio
                    <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supabase
                    <ExternalLink size={13} />
                  </a>
                  <a
                    href="https://vercel.com/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vercel
                    <ExternalLink size={13} />
                  </a>
                </div>
              </>
            )}
            {modal === "admin" && (
              <>
                <span className="section-eyebrow">ZAEEM’S CONTROL ROOM</span>
                <h2 id="modal-title">Admin dashboard.</h2>
                <p className="modal-description">
                  Manage access and keep an eye on your connected services.
                </p>
                {!admin ? (
                  <p>Administrator access is unavailable.</p>
                ) : (
                  <>
                    <div className="admin-stats">
                      <div>
                        <span>ACCOUNTS SHOWN</span>
                        <strong>{admin.users.length}</strong>
                      </div>
                      <div>
                        <span>AI PROVIDER</span>
                        <strong>
                          {admin.providerConnected
                            ? "Connected"
                            : "Not connected"}
                        </strong>
                      </div>
                      <div>
                        <span>WEB SEARCH</span>
                        <strong>
                          {admin.webSearch ? "Enabled" : "Disabled"}
                        </strong>
                      </div>
                    </div>
                    <form
                      className="admin-settings"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        updateAdmin({
                          action: "settings",
                          ai_enabled: data.get("enabled") === "on",
                          daily_limit: Number(data.get("limit")),
                        });
                      }}
                    >
                      <label className="checkbox-label">
                        <input
                          name="enabled"
                          type="checkbox"
                          defaultChecked={admin.settings.ai_enabled}
                        />
                        Allow AI conversations
                      </label>
                      <label>
                        Daily messages per user
                        <input
                          name="limit"
                          type="number"
                          min="1"
                          max="1000"
                          defaultValue={admin.settings.daily_limit}
                          required
                        />
                      </label>
                      <button className="primary-button" disabled={adminBusy}>
                        Save controls
                        <Check size={15} />
                      </button>
                    </form>
                    <h3 className="admin-users-title">
                      User management <span>First 100 accounts</span>
                    </h3>
                    <div className="admin-users">
                      {admin.users.map((u) => (
                        <div key={u.id}>
                          <span>
                            <strong>{u.email}</strong>
                            <small>
                              {u.banned
                                ? "Suspended"
                                : u.verified
                                  ? "Email verified"
                                  : "Awaiting verification"}{" "}
                              · Joined{" "}
                              {new Date(u.created).toLocaleDateString()}
                            </small>
                          </span>
                          <button
                            className="secondary-button"
                            disabled={adminBusy || u.id === user?.id}
                            onClick={() =>
                              updateAdmin({
                                action: "user",
                                id: u.id,
                                banned: !u.banned,
                              })
                            }
                          >
                            {u.banned ? "Restore" : "Suspend"}
                          </button>
                        </div>
                      ))}
                    </div>
                    {adminError && (
                      <p className="form-notice" role="alert">
                        {adminError}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
