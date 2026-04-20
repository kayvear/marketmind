"use client";

/**
 * ChatRail.tsx
 *
 * Collapsible right-rail chat panel.
 * Collapsed: 56px icon-only strip.
 * Expanded:  380px full chat interface.
 *
 * Collapsed state persisted to localStorage under key "mm-chat-collapsed".
 * SSE streaming + tool-use loop ported from ChatPanel.tsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
interface MessageMeta { model: string; tools: string[]; }
interface Message { id: number; role: Role; content: string; meta?: MessageMeta; }

const MODEL_SHORT: Record<string, string> = {
  "claude-opus-4-6":           "Opus 4.6",
  "claude-sonnet-4-6":         "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
};

const MODELS = [
  { id: "claude-opus-4-6",           label: "Opus 4.6",   desc: "Most capable" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", desc: "Balanced"     },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  desc: "Fastest"      },
] as const;
type ModelId = typeof MODELS[number]["id"];

// ─── SVG icon helper ──────────────────────────────────────────────────────────

function Icon({ name, size = 16, strokeWidth = 2 }: { name: string; size?: number; strokeWidth?: number }) {
  const paths: Record<string, React.ReactNode> = {
    sparkle:       <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />,
    plus:          <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    settings:      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    chevronRight:  <polyline points="9 18 15 12 9 6" />,
    chevronLeft:   <polyline points="15 18 9 12 15 6" />,
    send:          <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    popOut:        <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>,
    popIn:         <><polyline points="4 14 4 20 10 20"/><polyline points="20 10 20 4 14 4"/><line x1="14" y1="10" x2="4" y2="20"/><line x1="20" y1="4" x2="10" y2="14"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

// ─── Text renderer ────────────────────────────────────────────────────────────

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

function MessageBubble({ message, isThinking }: { message: Message; isThinking?: boolean }) {
  const isUser = message.role === "user";
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
      <div style={{
        maxWidth: "88%",
        padding: "10px 14px",
        fontFamily: "var(--sans)",
        fontSize: 13,
        lineHeight: 1.5,
        background: isUser ? "var(--bg-user-msg)" : "var(--bg-chat-ai)",
        color: "var(--fg1)",
        borderRadius: isUser ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
      }}>
        {isThinking ? (
          <span style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
            {[0, 150, 300].map((delay) => (
              <span key={delay} style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--fg3)",
                display: "inline-block",
                animation: `bounce 1s ${delay}ms infinite`,
              }} />
            ))}
          </span>
        ) : (
          formatContent(message.content)
        )}
      </div>

      {/* Meta tooltip */}
      {!isUser && message.meta && (
        <div
          style={{ position: "relative", paddingLeft: 4 }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span style={{ fontSize: 11, color: "var(--fg3)", cursor: "default", userSelect: "none" }}>ⓘ</span>
          {showTooltip && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 100,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)", padding: "8px 12px",
              whiteSpace: "nowrap", boxShadow: "var(--shadow-2)",
              lineHeight: 1.7,
            }}>
              <div style={{ fontSize: 11 }}>
                <span style={{ color: "var(--fg3)" }}>Model  </span>
                <span style={{ color: "var(--fg1)", fontWeight: 500 }}>
                  {MODEL_SHORT[message.meta.model] ?? message.meta.model}
                </span>
              </div>
              <div style={{ fontSize: 11 }}>
                <span style={{ color: "var(--fg3)" }}>Tools  </span>
                <span style={{ color: "var(--fg1)", fontWeight: 500 }}>
                  {message.meta.tools.length > 0 ? message.meta.tools.join(", ") : "none"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ghost icon button ────────────────────────────────────────────────────────

function IconBtn({ icon, onClick, title }: { icon: string; onClick?: () => void; title?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
        background: hover ? "var(--bg-hover)" : "transparent",
        color: hover ? "var(--fg1)" : "var(--fg2)",
        border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

export default function ChatRail() {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [popped, setPopped] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore persisted values after hydration (avoids SSR/client mismatch)
  useEffect(() => {
    setMounted(true);
    const c = localStorage.getItem("mm-chat-collapsed");
    if (c === "true") setCollapsed(true);
    const w = localStorage.getItem("mm-chat-width");
    if (w) setWidth(parseInt(w, 10));
    const p = localStorage.getItem("mm-chat-popped");
    if (p === "true") setPopped(true);
  }, []);

  const togglePopped = useCallback(() => {
    setPopped((v) => {
      const next = !v;
      localStorage.setItem("mm-chat-popped", String(next));
      return next;
    });
  }, []);

  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [verbosity, setVerbosity] = useState<"brief" | "normal" | "detailed">("normal");
  const [model, setModel]         = useState<ModelId>("claude-opus-4-6");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const settingsRef    = useRef<HTMLDivElement>(null);
  const widthRef       = useRef(width);
  const isDragging     = useRef(false);
  const dragStartX     = useRef(0);
  const dragStartWidth = useRef(0);

  // Persist collapsed state
  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("mm-chat-collapsed", String(next));
      return next;
    });
  }, []);

  // Document-level drag handlers (registered once)
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX; // drag left = wider
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      widthRef.current = next;
      setWidth(next);
    }
    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("mm-chat-width", String(widthRef.current));
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handle(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [settingsOpen]);

  // ─── SSE streaming ──────────────────────────────────────────────────────────

  const SYSTEM_PROMPTS = {
    brief:    "You are a concise financial assistant. Answer in 1–3 short sentences or a tight bullet list.",
    normal:   "You are a helpful financial assistant. Give clear, accurate answers with enough context to be useful.",
    detailed: "You are a thorough financial analyst. Provide comprehensive answers with context, trends, and caveats.",
  };

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    const userMsg: Message = { id: Date.now(),     role: "user",      content: text };
    const aiMsg:   Message = { id: Date.now() + 1, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, verbosity, model }),
      });

      if (!response.ok || !response.body) throw new Error(`Server returned ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isDone = false;

      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = "message";
          let eventData = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (eventType === "done") { isDone = true; break; }

          if (eventType === "meta" && eventData) {
            try {
              const meta: MessageMeta = JSON.parse(eventData);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], meta };
                return updated;
              });
            } catch { /* skip */ }
          }

          if (eventType === "message" && eventData) {
            try {
              const token: string = JSON.parse(eventData);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + token };
                return updated;
              });
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `⚠ Could not reach the AI — ${err instanceof Error ? err.message : "unknown error"}. Is the backend running?`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  // ─── Collapsed view ─────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <aside style={{
        width: 56, flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 8, padding: "16px 0",
        background: "var(--bg-surface)", borderLeft: "1px solid var(--border)",
      }}>
        <button
          onClick={toggle}
          title="Expand Assistant"
          style={{
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", cursor: "pointer", color: "var(--fg1)",
          }}
        >
          <Icon name="sparkle" size={16} />
        </button>
        <button
          onClick={() => { setMessages([]); toggle(); }}
          title="New chat"
          style={{
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: "var(--fg2)",
          }}
        >
          <Icon name="plus" size={14} />
        </button>
        <button
          onClick={() => { toggle(); setTimeout(() => setSettingsOpen(true), 300); }}
          title="Settings"
          style={{
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: "var(--fg2)",
          }}
        >
          <Icon name="settings" size={14} />
        </button>
      </aside>
    );
  }

  // ─── Shared chat UI (header + messages + input) ─────────────────────────────

  const chatUI = (
    <>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}><Icon name="sparkle" size={15} /></span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--fg1)" }}>
            Assistant
          </span>
        </div>
        <div style={{ display: "flex", gap: 2, position: "relative" }} ref={settingsRef}>
          <IconBtn icon="settings" onClick={() => setSettingsOpen((v) => !v)} title="Settings" />
          <IconBtn icon={popped ? "popIn" : "popOut"} onClick={togglePopped} title={popped ? "Merge back" : "Pop out"} />
          {!popped && <IconBtn icon="chevronRight" onClick={toggle} title="Collapse" />}
          {settingsOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
              width: 220, padding: 14,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-2)",
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              <div>
                <p style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg3)", marginBottom: 8 }}>
                  Verbosity
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["brief", "normal", "detailed"] as const).map((v) => (
                    <button key={v} onClick={() => setVerbosity(v)} style={{
                      flex: 1, padding: "6px 0",
                      fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500,
                      background: verbosity === v ? "var(--accent)" : "var(--bg-hover)",
                      color: verbosity === v ? "var(--fg-on-accent)" : "var(--fg2)",
                      border: "none", borderRadius: "var(--r-sm)", cursor: "pointer",
                    } as React.CSSProperties}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg3)", marginBottom: 8 }}>
                  Model
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {MODELS.map((m) => (
                    <button key={m.id} onClick={() => setModel(m.id)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", border: "none", cursor: "pointer",
                      background: model === m.id ? "var(--bg-active)" : "transparent",
                      color: "var(--fg1)", borderRadius: "var(--r-sm)",
                      fontFamily: "var(--sans)", fontSize: 12, textAlign: "left",
                    } as React.CSSProperties}>
                      <span style={{ fontWeight: 500 }}>{m.label}</span>
                      <span style={{ color: "var(--fg3)", fontSize: 11 }}>{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 ? (
          <p style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--fg3)", textAlign: "center", marginTop: 16 }}>
            Ask about a stock, index, or market trend.
          </p>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isThinking={isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.content === ""}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8, flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          placeholder="Ask about a stock, index, or trend…"
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          style={{
            flex: 1, padding: "9px 12px",
            fontFamily: "var(--sans)", fontSize: 13,
            background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", color: "var(--fg1)", outline: "none",
            opacity: isStreaming ? 0.6 : 1,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          style={{
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            background: input.trim() && !isStreaming ? "var(--accent)" : "var(--bg-hover)",
            color: input.trim() && !isStreaming ? "var(--fg-on-accent)" : "var(--fg3)",
            border: "none", borderRadius: "var(--r-md)",
            cursor: input.trim() && !isStreaming ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          <Icon name="send" size={13} strokeWidth={2.5} />
        </button>
      </div>
    </>
  );

  // ─── Floating modal (popped out) ─────────────────────────────────────────────

  if (popped && mounted) {
    return createPortal(
      <>
        {/* Backdrop — click to merge back */}
        <div
          onClick={togglePopped}
          style={{
            position: "fixed", inset: 0, zIndex: 99,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(3px)",
          }}
        />
        {/* Floating chat window */}
        <div style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520, height: "72vh",
          zIndex: 100,
          display: "flex", flexDirection: "column",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 32px 96px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}>
          {chatUI}
        </div>
      </>,
      document.body
    );
  }

  // ─── Inline right rail ────────────────────────────────────────────────────────

  return (
    <aside style={{
      position: "relative",
      width, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "var(--bg-surface)", borderLeft: "1px solid var(--border)",
    }}>
      {/* Drag handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          isDragging.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = widthRef.current;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 10 }}
      >
        <div style={{ width: 2, margin: "auto 2px", height: "100%", background: "transparent", transition: "background 0.15s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--border)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
        />
      </div>
      {chatUI}
    </aside>
  );
}
