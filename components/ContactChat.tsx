"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { site } from "@/content/site";

type ContactChatContextValue = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
};

const ContactChatContext = createContext<ContactChatContextValue | null>(null);

export function useContactChat() {
  const ctx = useContext(ContactChatContext);
  if (!ctx) {
    throw new Error("useContactChat must be used within ContactChatProvider");
  }
  return ctx;
}

export function ContactChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);

  return (
    <ContactChatContext.Provider value={{ open, openChat, closeChat }}>
      {children}
      <ContactChatPanel />
    </ContactChatContext.Provider>
  );
}

export function ContactEmailLink({ className = "" }: { className?: string }) {
  const { openChat } = useContactChat();

  return (
    <button
      type="button"
      onClick={openChat}
      className={className}
    >
      {site.email}
    </button>
  );
}

export function ContactMessageButton({ className = "" }: { className?: string }) {
  const { openChat } = useContactChat();

  return (
    <button type="button" onClick={openChat} className={className}>
      Send a message
    </button>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContactChatPanel() {
  const { open, openChat, closeChat } = useContactChat();
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => emailRef.current?.focus(), 40);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open, closeChat]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("sending");
    setError("");

    if (String(formData.get("website") ?? "").trim()) {
      setStatus("sent");
      setMessage("");
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim();
    if (!accessKey) {
      setStatus("error");
      setError("Email sent failed.");
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    if (trimmedMessage.length < 2) {
      setStatus("error");
      setError("Please include a short message.");
      return;
    }

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: `Portfolio contact from ${trimmedEmail}`,
          from_name: site.name,
          email: trimmedEmail,
          message: trimmedMessage,
          replyto: trimmedEmail,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean | string;
        message?: string;
      };
      const ok = data.success === true || data.success === "true";
      if (!response.ok || !ok) {
        setStatus("error");
        setError("Email sent failed.");
        return;
      }
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
      setError("Email sent failed.");
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-5 sm:bottom-5">
      {open ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-hairline bg-rail shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
        >
          <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div>
              <p
                id={titleId}
                className="font-display text-sm font-semibold tracking-tight"
              >
                Chat
              </p>
              <p className="mt-0.5 text-xs text-muted">Message {site.name}</p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Close chat"
            >
              <span className="relative block h-3.5 w-3.5" aria-hidden>
                <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 rotate-45 bg-current" />
                <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 -rotate-45 bg-current" />
              </span>
            </button>
          </header>

          {status === "sent" || (status === "error" && error) ? (
            <div className="flex max-h-[min(28rem,55vh)] flex-col gap-3 overflow-y-auto px-4 py-4">
              {status === "sent" ? (
                <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm leading-relaxed text-foreground">
                  Email sent successfully.
                </p>
              ) : null}
              {status === "error" && error ? (
                <p className="max-w-[90%] rounded-2xl rounded-tl-sm border border-hairline px-3 py-2 text-sm leading-relaxed text-muted">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-2 border-t border-hairline px-4 py-3"
          >
            <label className="sr-only" htmlFor="contact-email">
              Your email
            </label>
            <input
              ref={emailRef}
              id="contact-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="Your email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
            />
            <label className="sr-only" htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={3}
              placeholder="Write a message…"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              className="w-full resize-none rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
            />
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              aria-hidden
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={open ? closeChat : openChat}
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Open chat"}
        className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white bg-rail text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent in-[html.light]:border-zinc-900"
      >
        <ChatIcon />
      </button>
    </div>
  );
}
