import { useState, useRef, useEffect } from "react";
import axios from "axios";
import AvatarCreator from "./components/AvatarCreator";
import Avatar3D from "./components/Avatar3D";
import "./App.css";

const API_URL = "http://localhost:5000/api/chat";

const ASSISTANT_NAME = "Aria";
const ASSISTANT_ROLE = "First-Aid & Health Guide";

const GREETING_TEXT =
  "Hello! I can guide you through basic first-aid steps for burns, cuts, choking, and more. Describe what's happening — in English, Sinhala, or Singlish.";

function createGreeting() {
  return { sender: "assistant", text: GREETING_TEXT, time: Date.now() };
}

// Common emergencies shown as tappable starter chips when the chat is
// fresh — lets a panicked user get going in one tap instead of typing.
const QUICK_PROMPTS = [
  { label: "🔥 Burns", text: "Someone has a burn, what should I do?" },
  { label: "🫁 Choking", text: "Someone is choking, how do I help?" },
  { label: "🩸 Cuts & bleeding", text: "There's a deep cut that's bleeding a lot." },
  { label: "🤧 Allergic reaction", text: "Someone is having a severe allergic reaction." },
  { label: "🦴 Sprain / fracture", text: "I think someone has a sprained or broken ankle." },
];

// Wrapped so private-browsing / storage-disabled users never crash the app —
// worst case, persistence just silently doesn't work for them.
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — fail silently */
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable — fail silently */
  }
}

function loadStoredAvatar() {
  const stored = safeGet("avatarUrl");
  if (stored === null) return undefined; // never chosen yet → show creator
  if (stored === "skip") return null; // explicitly skipped
  return stored;
}

function loadStoredMessages() {
  const stored = safeGet("chatHistory");
  if (!stored) return [createGreeting()];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createGreeting()];
  } catch {
    return [createGreeting()];
  }
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function App() {
  const [avatarUrl, setAvatarUrl] = useState(loadStoredAvatar);
  const [avatarSnapshot, setAvatarSnapshot] = useState(null);
  const [facingOffset, setFacingOffset] = useState(() => Number(safeGet("avatarFacing")) || 0);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    safeSet("chatHistory", JSON.stringify(messages));
  }, [messages]);

  // Light "is the backend up" ping so the status badge reflects reality
  // instead of always claiming "Online".
  useEffect(() => {
    let cancelled = false;
    axios
      .get(API_URL.replace("/api/chat", "/api/health"))
      .then(() => !cancelled && setIsOnline(true))
      .catch(() => !cancelled && setIsOnline(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseAvatar = (url) => {
    setAvatarUrl(url);
    setAvatarSnapshot(null);
    safeSet("avatarUrl", url === null ? "skip" : url);
  };

  const resetAvatar = () => {
    setAvatarUrl(undefined);
    setAvatarSnapshot(null);
    setFacingOffset(0);
    safeRemove("avatarUrl");
    safeRemove("avatarFacing");
  };

  const flipAvatar = () => {
    setFacingOffset((prev) => {
      const next = prev + Math.PI;
      safeSet("avatarFacing", String(next));
      return next;
    });
  };

  const resetChat = () => {
    setMessages([createGreeting()]);
    safeRemove("chatHistory");
  };

  const sendMessage = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const newMessages = [...messages, { sender: "user", text, time: Date.now() }];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    const startedAt = performance.now();

    try {
      const res = await axios.post(API_URL, {
        message: text,
        history: messages
          .filter((m) => m.sender === "user" || m.sender === "assistant")
          .map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          })),
      });
      setLatencyMs(Math.round(performance.now() - startedAt));
      setIsOnline(true);
      setMessages([
        ...newMessages,
        {
          sender: "assistant",
          text: res.data.reply,
          sources: res.data.sources,
          time: Date.now(),
        },
      ]);
    } catch (err) {
      setIsOnline(false);
      setMessages([
        ...newMessages,
        {
          sender: "assistant",
          text: "Sorry, something went wrong. Please try again.",
          isError: true,
          retryText: text,
          time: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (text, index) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
      })
      .catch(() => {});
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (avatarUrl === undefined) {
    return <AvatarCreator onAvatarCreated={chooseAvatar} />;
  }

  const showQuickPrompts = messages.length === 1 && !loading;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">🩺</span>
          <div>
            <h1>Smart First-Aid Assistant</h1>
            <p>AI-guided emergency first-aid, grounded in IFRC guidelines</p>
          </div>
        </div>
        <a href="tel:1990" className="emergency-btn">
          🚑 Call 1990
        </a>
      </header>

      {/* Signature motif: a quiet heartbeat pulse-line under the header,
          tying the visual identity directly to "health guide" rather than
          a generic decorative gradient. */}
      <div className="pulse-strip" aria-hidden="true" />

      <main className="app-body">
        <aside className="avatar-panel">
          <div className="assistant-card">
            <div className="avatar-card">
              <Avatar3D avatarUrl={avatarUrl} facingOffset={facingOffset} onSnapshot={setAvatarSnapshot} />
            </div>

            <div className="assistant-identity">
              <div className="assistant-name-row">
                <h2>{ASSISTANT_NAME}</h2>
                <span className={`status-pill ${isOnline ? "online" : "offline"}`}>
                  <span className="status-dot" />
                  {isOnline ? "Ready" : "Reconnecting…"}
                </span>
              </div>
              <p className="assistant-role">{ASSISTANT_ROLE}</p>
            </div>

            <div className="tech-badges">
              <span className="badge">🧠 Gemini + RAG</span>
              <span className="badge">🌐 EN · SI</span>
              {latencyMs !== null && (
                <span className="badge badge-muted">⚡ {latencyMs}ms</span>
              )}
            </div>
          </div>

          <div className="avatar-actions">
            <button className="secondary-btn" onClick={flipAvatar}>
              🔄 Turn Around
            </button>
            <button className="secondary-btn" onClick={resetAvatar}>
              ✏️ Change Avatar
            </button>
            <button className="secondary-btn subtle" onClick={resetChat}>
              🗑️ Clear Chat
            </button>
          </div>

          <div className="disclaimer-box">
            <span className="disclaimer-icon">⚠️</span>
            <p>
              Not a substitute for professional medical advice. In a real
              emergency, call <strong>1990</strong> immediately.
            </p>
          </div>
        </aside>

        <section className="chat-panel">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg-row ${m.sender}`}>
                {m.sender === "assistant" && (
                  <div
                    className="msg-avatar assistant"
                    aria-hidden="true"
                    style={avatarSnapshot ? { backgroundImage: `url(${avatarSnapshot})` } : undefined}
                  >
                    {!avatarSnapshot && "🩺"}
                  </div>
                )}

                <div className="msg-col">
                  <span className="msg-meta">
                    {m.sender === "assistant" && <span className="msg-sender">{ASSISTANT_NAME}</span>}
                    {m.time && <span className="msg-time">{formatTime(m.time)}</span>}
                  </span>

                  <div className={`msg ${m.sender} ${m.isError ? "error" : ""}`}>
                    {m.isError && <span className="msg-error-icon">⚠️</span>}
                    <p>{m.text}</p>

                    {m.sources && m.sources.length > 0 && (
                      <div className="msg-sources">
                        {[...new Set(m.sources)].map((src, si) => (
                          <span className="source-chip" key={si}>📄 {src}</span>
                        ))}
                      </div>
                    )}

                    {m.isError && m.retryText && (
                      <button className="retry-btn" onClick={() => sendMessage(m.retryText)}>
                        ↻ Retry
                      </button>
                    )}
                  </div>

                  {m.sender === "assistant" && !m.isError && (
                    <button
                      className="copy-btn"
                      onClick={() => copyMessage(m.text, i)}
                      title="Copy message"
                    >
                      {copiedIndex === i ? "✓ Copied" : "⧉ Copy"}
                    </button>
                  )}
                </div>

                {m.sender === "user" && (
                  <div className="msg-avatar user" aria-hidden="true">🙂</div>
                )}
              </div>
            ))}

            {loading && (
              <div className="msg-row assistant">
                <div
                  className="msg-avatar assistant"
                  aria-hidden="true"
                  style={avatarSnapshot ? { backgroundImage: `url(${avatarSnapshot})` } : undefined}
                >
                  {!avatarSnapshot && "🩺"}
                </div>
                <div className="msg-col">
                  <span className="msg-meta">
                    <span className="msg-sender">{ASSISTANT_NAME}</span>
                    <span className="msg-time typing-label">is thinking…</span>
                  </span>
                  <div className="msg assistant typing">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                </div>
              </div>
            )}

            {showQuickPrompts && (
              <div className="quick-prompts" role="group" aria-label="Common emergencies">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    className="quick-prompt-chip"
                    onClick={() => sendMessage(q.text)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          <div className="input-row">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Describe the emergency... (Shift+Enter for new line)"
              disabled={loading}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;