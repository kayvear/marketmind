"use client";

/**
 * ChatPanel.tsx — Phase 6B
 *
 * Two display modes (unchanged from Phase 5):
 *   1. ACCORDION — 75%-wide panel docked to the bottom, slides open/closed.
 *   2. MODAL     — centered overlay with backdrop blur.
 *
 * Phase 6B additions:
 *   - Live SSE streaming from POST /api/chat
 *   - Conversation stored in useState (cleared on page refresh)
 *   - InputBar is now interactive (controlled input + Enter / send button)
 *   - "Thinking" dots while the first token hasn't arrived yet
 *   - Error bubble if the backend is unreachable
 *
 * Phase 7 will add a gear ⚙ settings popover in the header for:
 *   - Verbosity toggle  (Brief / Normal / Detailed)
 *   - Model selector    (Opus / Sonnet / Haiku)
 * The backend already accepts these as optional fields in the request body.
 */

import { useRef, useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
interface Message {
  id: number;
  role: Role;
  content: string;
}

// ─── Text renderer ────────────────────────────────────────────────────────────
// Handles **bold** and newlines. Full markdown via react-markdown in a later phase.

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

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isThinking,
}: {
  message: Message;
  isThinking?: boolean;
}) {
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
        {isThinking ? (
          // Animated "thinking" dots while waiting for the first token
          <span className="flex gap-1 items-center py-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  backgroundColor: "var(--text-muted)",
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </span>
        ) : (
          formatContent(message.content)
        )}
      </div>
    </div>
  );
}

// ─── Input bar ────────────────────────────────────────────────────────────────

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

function InputBar({ value, onChange, onSubmit, disabled }: InputBarProps) {
  return (
    <div
      className="px-4 py-3 border-t shrink-0 flex items-center gap-2"
      style={{ borderColor: "var(--border)" }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Ask about a stock, index, or market trend…"
        disabled={disabled}
        className="flex-1 rounded-xl px-4 py-2 text-sm outline-none border"
        style={{
          backgroundColor: "var(--bg-input)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          opacity: disabled ? 0.6 : 1,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white shrink-0"
        style={{
          backgroundColor: "var(--blue)",
          opacity: disabled || !value.trim() ? 0.4 : 1,
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          transition: "opacity 0.15s ease",
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCORDION_HEIGHT = 380;

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen]     = useState(false);
  const [isModal, setIsModal]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // Scroll to bottom when the panel opens or switches to modal
  useEffect(() => {
    if (isOpen || isModal) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 320);
    }
  }, [isOpen, isModal]);

  // Auto-scroll as tokens stream in
  useEffect(() => {
    if ((isOpen || isModal) && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isModal]);

  // Close modal on Escape
  useEffect(() => {
    if (!isModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModal]);

  // ─── Send message + SSE stream ────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Snapshot history BEFORE adding the new user message
    const history = messages.map(({ role, content }) => ({ role, content }));

    // Show user bubble immediately; add empty assistant bubble as placeholder
    const userMsg: Message = { id: Date.now(),     role: "user",      content: text };
    const aiMsg:   Message = { id: Date.now() + 1, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isDone = false;

      // Read the SSE stream chunk by chunk.
      // Each SSE event ends with \n\n. Chunks from the network may contain
      // several complete events, or split an event across multiple reads,
      // so we buffer and split on \n\n to get clean event blocks.
      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? ""; // last slice may be an incomplete event

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventType = "message";
          let eventData = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: "))  eventData = line.slice(6);
          }

          if (eventType === "done") { isDone = true; break; }

          if (eventData) {
            try {
              const token: string = JSON.parse(eventData);
              setMessages((prev) => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + token,
                };
                return updated;
              });
            } catch {
              // Malformed JSON in a data field — skip silently
            }
          }
        }
      }
    } catch (err) {
      // Replace the empty assistant placeholder with an inline error
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `⚠ Could not reach the AI — ${
            err instanceof Error ? err.message : "unknown error"
          }. Is the backend running?`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  // ─── Shared JSX fragments ─────────────────────────────────────────────────

  const messageList = (
    <>
      {messages.length === 0 ? (
        <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
          Ask me anything about stocks, indices, or market trends.
        </p>
      ) : (
        messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isThinking={
              isStreaming &&
              i === messages.length - 1 &&
              msg.role === "assistant" &&
              msg.content === ""
            }
          />
        ))
      )}
      <div ref={bottomRef} />
    </>
  );

  const inputBar = (
    <InputBar
      value={input}
      onChange={setInput}
      onSubmit={sendMessage}
      disabled={isStreaming}
    />
  );

  // ─── MODAL MODE ──────────────────────────────────────────────────────────────

  if (isModal) {
    return (
      <>
        <AccordionStub onOpen={() => setIsModal(true)} />

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
          onClick={() => setIsModal(false)}
        >
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" style={{ color: "var(--blue)" }}
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  AI Assistant
                </span>
              </div>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messageList}
            </div>
            {inputBar}
          </div>
        </div>
      </>
    );
  }

  // ─── ACCORDION MODE ──────────────────────────────────────────────────────────

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
        {/* Accordion header */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center justify-between w-full px-5 py-3 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
          aria-expanded={isOpen}
          aria-controls="chat-panel-body"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" style={{ color: "var(--blue)" }}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>AI Assistant</span>
            {!isOpen && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isStreaming
                  ? "Thinking…"
                  : "Ask about stocks, indices, or market trends…"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Pop-out button */}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </span>

            {/* Chevron */}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round"
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

        {/* Expandable body */}
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
              {messageList}
            </div>
            {inputBar}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Accordion stub (shown behind the modal to prevent layout shift) ──────────

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" style={{ color: "var(--blue)" }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>AI Assistant</span>
        </button>
      </div>
    </div>
  );
}
