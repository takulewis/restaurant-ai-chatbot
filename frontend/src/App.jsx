import { useState, useRef, useEffect } from "react";

const API_URL = "http://localhost:8000";

function StarRating({ rating }) {
  return (
    <span style={{ color: "#e8a838", fontSize: 12, letterSpacing: 1 }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "#888", marginLeft: 4, fontSize: 11 }}>{rating}/5</span>
    </span>
  );
}

function SourceCard({ source, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{
      background: "#f8f6f1", border: "1px solid #e4ddd0",
      borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "#5c3d1e" }}>Review #{index + 1}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {source.rating && <StarRating rating={source.rating} />}
          <span style={{ color: "#aaa", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <p style={{ margin: "8px 0 0", color: "#555", lineHeight: 1.5, fontSize: 12 }}>
          {source.content}
        </p>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isError = msg.role === "error";
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 20, gap: 6,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        flexDirection: isUser ? "row-reverse" : "row",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isUser ? "#5c3d1e" : isError ? "#c0392b" : "#c8a97a",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {isUser ? "You" : isError ? "!" : "🍕"}
        </div>
        <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
          {isUser ? "you" : isError ? "error" : "PizzaBot"}
        </span>
      </div>
      <div style={{
        maxWidth: "75%",
        background: isUser ? "#5c3d1e" : isError ? "#fdecea" : "#fff",
        color: isUser ? "#fff" : isError ? "#c0392b" : "#2c1a0e",
        border: isUser ? "none" : `1px solid ${isError ? "#f5c6c2" : "#e4ddd0"}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "12px 16px", lineHeight: 1.6, fontSize: 14, whiteSpace: "pre-wrap",
      }}>
        {msg.text}
        {msg.streaming && (
          <span style={{
            display: "inline-block", width: 2, height: 14,
            background: "#c8a97a", marginLeft: 2, verticalAlign: "middle",
            animation: "blink 1s infinite",
          }} />
        )}
      </div>
      {msg.sources && msg.sources.length > 0 && (
        <div style={{ maxWidth: "75%", width: "100%" }}>
          <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Based on {msg.sources.length} reviews — click to expand
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {msg.sources.map((s, i) => <SourceCard key={i} source={s} index={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", background: "#c8a97a",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
      }}>🍕</div>
      <div style={{
        background: "#fff", border: "1px solid #e4ddd0",
        borderRadius: "16px 16px 16px 4px", padding: "14px 18px",
        display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%", background: "#c8a97a",
            animation: "bounce 1s infinite", animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What do customers say about the pizza crust?",
  "Is this place good for families?",
  "What are the most common complaints?",
  "Would you recommend this restaurant?",
];

export default function App() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hey! Ask me anything about this pizza restaurant — I'll search through real customer reviews to answer you." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minRating, setMinRating] = useState(0); // Feature 6: rating filter
  const bottomRef = useRef(null);

  // Feature 4: build conversation history from messages for the API
  const buildHistory = (currentMessages) => {
    return currentMessages
      .filter(m => m.role === "user" || (m.role === "bot" && m.text))
      .map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput("");

    const updatedMessages = [...messages, { role: "user", text: q }];
    setMessages(updatedMessages);
    setLoading(true);

    // Add empty bot message to stream into
    setMessages(prev => [...prev, { role: "bot", text: "", sources: [], streaming: true }]);

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: buildHistory(updatedMessages),          // Feature 4
          min_rating: minRating > 0 ? minRating : null,   // Feature 6
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const data = JSON.parse(line.replace("data: ", ""));
          if (data.type === "sources") {
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, sources: data.sources } : m
            ));
          } else if (data.type === "token") {
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, text: m.text + data.token } : m
            ));
          } else if (data.type === "done") {
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, streaming: false } : m
            ));
          }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: "error",
          text: `Could not reach the API. Make sure the FastAPI server is running on port 8000.\n\nError: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Georgia', serif; background: #faf6f0; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        textarea:focus { outline: none; box-shadow: 0 0 0 2px #c8a97a44; }
        input[type=range] { accent-color: #5c3d1e; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          background: "#fff", borderBottom: "1px solid #e4ddd0",
          padding: "14px 24px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%", background: "#5c3d1e",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🍕</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: "#2c1a0e" }}>PizzaBot</h1>
              <p style={{ fontSize: 12, color: "#aaa" }}>RAG · llama3.2 · ChromaDB · 122 reviews</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27ae60" }} />
              <span style={{ fontSize: 12, color: "#aaa" }}>Local</span>
            </div>
          </div>

          {/* Feature 6: Rating filter bar */}
          <div style={{
            marginTop: 10, padding: "8px 12px", background: "#faf6f0",
            borderRadius: 10, border: "1px solid #e4ddd0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 12, color: "#5c3d1e", whiteSpace: "nowrap" }}>
              Filter reviews:
            </span>
            <input
              type="range" min={0} max={5} step={0.5}
              value={minRating}
              onChange={e => setMinRating(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, color: "#5c3d1e", minWidth: 90, textAlign: "right" }}>
              {minRating > 0 ? `★ ${minRating}+ only` : "All reviews"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "24px 24px 12px",
          display: "flex", flexDirection: "column",
        }}>
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {loading && messages[messages.length - 1]?.text === "" && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div style={{ padding: "0 24px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{
                background: "#fff", border: "1px solid #e4ddd0", borderRadius: 20,
                padding: "6px 14px", fontSize: 12, color: "#5c3d1e", cursor: "pointer",
                fontFamily: "inherit",
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          background: "#fff", borderTop: "1px solid #e4ddd0",
          padding: "14px 24px", flexShrink: 0,
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about the restaurant..."
            rows={1}
            style={{
              flex: 1, resize: "none", border: "1px solid #e4ddd0", borderRadius: 12,
              padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
              background: "#faf6f0", color: "#2c1a0e", lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? "#5c3d1e" : "#d0c9c0",
              color: "#fff", border: "none", borderRadius: 10,
              width: 40, height: 40,
              cursor: input.trim() && !loading ? "pointer" : "default",
              fontSize: 18, transition: "background 0.2s", flexShrink: 0,
            }}
          >↑</button>
        </div>
      </div>
    </>
  );
}