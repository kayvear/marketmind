"use client";

/**
 * ChatPanel.tsx
 *
 * Two display modes:
 *
 *  1. ACCORDION (default)
 *     A 75%-wide panel centered at the bottom of the screen.
 *     The header bar is always visible; clicking it slides the chat area
 *     open or closed. A pop-out button in the header switches to Modal mode.
 *
 *  2. MODAL
 *     A centered overlay that covers the page with a dark backdrop.
 *     Useful when the user wants more chat space without scrolling the page.
 *     Closed via the × button or by clicking outside the modal.
 *
 * Phase 6: replace STATIC_MESSAGES with useState + live SSE streaming.
 */

import { useRef, useEffect, useState } from "react";

type Role = "user" | "assistant";
interface Message {
  id: number;
  role: Role;
  content: string;
}

const STATIC_MESSAGES: Message[] = [
  {
    id: 1,
    role: "user",
    content: "What is Apple's current stock price and how has it been trending?",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "Apple Inc. (AAPL) is currently trading at **$247.18**, up **$2.46 (+1.00%)** today.\n\nOver the past month, AAPL has risen ~8.6% from ~$227. Brief dip in mid-February before recovering strongly in the final week.\n\nWould you like the detailed price chart, or a comparison with another stock?",
  },
  {
    id: 3,
    role: "user",
    content: "How is the broader market doing today?",
  },
  {
    id: 4,
    role: "assistant",
    content:
      "US markets are mostly positive today:\n\n• **S&P 500** — 5,789.15 · +28.47 (+0.49%)\n• **NASDAQ** — 18,342.67 · +156.23 (+0.86%)\n• **Dow Jones** — 42,156.34 · -89.12 (-0.21%)\n\nTech is leading gains. The Dow is slightly negative, dragged by industrials.",
  },
];

// Renders **bold** and line breaks — full markdown via react-markdown in Phase 6
function formatContent(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>
      {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
      )}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          backgroundColor: isUser ? "var(--bg-chat-user)" : "var(--bg-chat-ai)",
          color: isUser ? "var(--text-chat-user)" : "var(--text-chat-ai)",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        }}
      >
        {formatContent(message.content)}
      </div>
    </div>
  );
}

// Reusable input bar — used in both accordion and modal
function InputBar() {
  return (
    <div
      className="px-4 py-3 border-t shrink-0 flex items-center gap-2"
      style={{ borderColor: "var(--border)" }}
    >
      <input
        type="text"
        placeholder="Ask about a stock, index, or market trend…"
        disabled
        className="flex-1 rounded-xl px-4 py-2 text-sm outline-none border"
        style={{
          backgroundColor: "var(--bg-input)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      />
      <button
        disabled
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white shrink-0 opacity-50 cursor-not-allowed"
        style={{ backgroundColor: "var(--blue)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}

const ACCORDION_HEIGHT = 380; // px — height of the expanded accordion body

export default function ChatPanel() {
  const [isOpen, setIsOpen]   = useState(false);
  const [isModal, setIsModal] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  // Scroll to latest message when accordion opens or modal mounts
  useEffect(() => {
    if (isOpen || isModal) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 320);
    }
  }, [isOpen, isModal]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModal]);

  // ─── MODAL MODE ────────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <>
        {/* ── Accordion stub stays visible behind the modal ── */}
        <AccordionStub onOpen={() => setIsModal(true)} />

        {/* ── Modal overlay ── */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(2px)",
          }}
          // Click backdrop to close
          onClick={() => setIsModal(false)}
        >
          {/* Modal card — stop clicks propagating to backdrop */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "60%",
              height: "72vh",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
            }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  AI Assistant
                </span>
              </div>
              {/* Close button */}
              <button
                onClick={() => setIsModal(false)}
                className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }}
                aria-label="Close modal"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {STATIC_MESSAGES.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>

            <InputBar />
          </div>
        </div>
      </>
    );
  }

  // ─── ACCORDION MODE ────────────────────────────────────────────────────────
  return (
    // Full-width row — gives the panel something to sit inside in the flex layout
    <div className="shrink-0" style={{ backgroundColor: "var(--bg-base)" }}>

      {/*
       * The visible panel is 75% wide and centred.
       * borderBottom: none + rounded top corners make it look like a tray
       * rising from the bottom of the page.
       */}
      <div
        style={{
          width: "75%",
          margin: "0 auto",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "12px 12px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── Accordion header ── */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
          aria-expanded={isOpen}
          aria-controls="chat-panel-body"
        >
          {/* Left: chat icon + label + hint */}
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>AI Assistant</span>
            {!isOpen && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ask about stocks, indices, or market trends…
              </span>
            )}
          </div>

          {/* Right: pop-out button + chevron */}
          <div className="flex items-center gap-2">
            {/*
             * Pop-out button — opens modal mode.
             * stopPropagation prevents the accordion from toggling when
             * the user clicks this button instead of the header bar.
             */}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setIsModal(true); }}
              className="flex items-center justify-center w-6 h-6 rounded transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
              title="Open in modal"
              aria-label="Open in modal"
            >
              {/* External / expand icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </span>

            {/* Chevron — rotates when open */}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{
                color: "var(--text-secondary)",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
              }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </div>
        </button>

        {/* ── Expandable body ── */}
        <div
          id="chat-panel-body"
          style={{
            height: isOpen ? `${ACCORDION_HEIGHT}px` : "0px",
            overflow: "hidden",
            transition: "height 0.3s ease",
          }}
        >
          <div
            className="flex flex-col border-t"
            style={{ height: `${ACCORDION_HEIGHT}px`, borderColor: "var(--border)" }}
          >
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
              {STATIC_MESSAGES.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
            <InputBar />
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal stub shown behind the modal so the layout doesn't shift
function AccordionStub({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="shrink-0" style={{ backgroundColor: "var(--bg-base)" }}>
      <div
        style={{
          width: "75%",
          margin: "0 auto",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "12px 12px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <button
          onClick={onOpen}
          className="flex items-center gap-2.5 w-full px-5 py-3 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--blue)" }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>AI Assistant</span>
        </button>
      </div>
    </div>
  );
}
