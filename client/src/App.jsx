import { useState, useRef, useEffect } from "react";
import axios from "axios";
import AvatarCreator from "./components/AvatarCreator";
import Avatar3D from "./components/Avatar3D";
import "./App.css";

const API_URL = "http://localhost:5000/api/chat";

const ASSISTANT_NAME = "Aria";
const ASSISTANT_ROLE = "First-Aid & Health Guide";

const DEFAULT_GREETING = {
  sender: "assistant",
  text: "Hello! I can guide you through basic first-aid steps for burns, cuts, choking, and more. Describe what's happening — in English, Sinhala, or Singlish.",
};

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
  if (!stored) return [DEFAULT_GREETING];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_GREETING];
  } catch {
    return [DEFAULT_GREETING];
  }
}

function App() {
  const [avatarUrl, setAvatarUrl] = useState(loadStoredAvatar);
  const [facingOffset, setFacingOffset] = useState(() => Number(safeGet("avatarFacing")) || 0);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const scrollRef = useRef(null);

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
    safeSet("avatarUrl", url === null ? "skip" : url);
  };

  const resetAvatar = () => {
    setAvatarUrl(undefined);
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
    setMessages([DEFAULT_GREETING]);
    safeRemove("chatHistory");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    const startedAt = performance.now();

    try {
      const res = await axios.post(API_URL, {
        message: input,
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
        { sender: "assistant", text: res.data.reply, sources: res.data.sources },
      ]);
    } catch (err) {
      setIsOnline(false);
      setMessages([
        ...newMessages,
        { sender: "assistant", text: "Sorry, something went wrong. Please try again.", isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (avatarUrl === undefined) {
    return <AvatarCreator onAvatarCreated={chooseAvatar} />;
  }

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

      <main className="app-body">
        <aside className="avatar-panel">
          <div className="assistant-card">
            <div className="avatar-card">
              <Avatar3D avatarUrl={avatarUrl} facingOffset={facingOffset} />
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
              <span className="badge">
                ⚡ {latencyMs !== null ? `${latencyMs}ms` : "—"}
              </span>
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
                <div className={`msg ${m.sender} ${m.isError ? "error" : ""}`}>
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="msg-sources">
                      Sources: {[...new Set(m.sources)].join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg-row assistant">
                <div className="msg assistant typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Describe the emergency..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;