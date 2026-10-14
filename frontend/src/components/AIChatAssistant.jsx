import { useEffect, useRef, useState } from "react";
import { FaPaperPlane, FaRobot, FaTimes } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import API from "../api/api";

const AIChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    const stored = Number(sessionStorage.getItem("trip_planner_chat_conversation_id"));
    return Number.isSafeInteger(stored) && stored > 0 ? stored : null;
  });
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I’m your AI travel assistant. Ask me about your trips, weather, travel policies, or expenses." },
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!conversationId) return undefined;
    let active = true;
    const token = localStorage.getItem("token");
    API.get(`/ai/chat/${conversationId}`, { headers: { authorization: token } })
      .then(({ data }) => {
        if (active) setMessages([{ role: "assistant", text: "Hi! I’m your AI travel assistant. Ask me about your trips, weather, travel policies, or expenses." }, ...data.messages]);
      })
      .catch((error) => {
        if (error.response?.status === 404) {
          sessionStorage.removeItem("trip_planner_chat_conversation_id");
          setConversationId(null);
        }
      });
    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (preset) => {
    const text = (preset || message).trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setMessage("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await API.post(
        "/ai/chat",
        { message: text, conversationId },
        { headers: { authorization: token } }
      );
      sessionStorage.setItem("trip_planner_chat_conversation_id", String(res.data.conversationId));
      setConversationId(res.data.conversationId);
      setMessages((current) => [...current, { role: "assistant", text: res.data.reply, pendingExpense: res.data.pendingExpense || null }]);
    } catch (error) {
      if (error.response?.status === 404) {
        sessionStorage.removeItem("trip_planner_chat_conversation_id");
        setConversationId(null);
      }
      console.error("AI chat request failed:", error.response?.status || error.message);
      setMessages((current) => [...current, { role: "assistant", text: "I couldn't answer that right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmExpense = async (expense, messageIndex) => {
    if (loading) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await API.post("/ai/chat/confirm-expense", { expense, conversationId }, { headers: { authorization: token } });
      setMessages((current) => [...current.map((item, index) => index === messageIndex ? { ...item, pendingExpense: null } : item), { role: "assistant", text: res.data.message }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error.response?.data?.message || "Could not save the expense. The draft remains available." }]);
    } finally {
      setLoading(false);
    }
  };

  const cancelExpense = (messageIndex) => setMessages((current) =>
    current.map((item, index) => index === messageIndex ? { ...item, pendingExpense: null } : item)
  );
  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[560px] w-[calc(100vw-2.5rem)] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-violet-700 to-blue-600 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 p-2"><FaRobot /></div>
              <div><h3 className="font-bold">AI Travel Assistant</h3><p className="text-xs text-white/75">Gemini with trip tools and travel knowledge search</p></div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close chat"><FaTimes /></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((item, index) => (
              <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "bg-blue-600" : "bg-zinc-800"}`}>
                  <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{item.text}</ReactMarkdown></div>
                  {item.pendingExpense && (
                    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3">
                      <p className="mb-2 text-xs text-amber-100">This draft is not saved. Confirm to add it to your trip.</p>
                      <p className="mb-3 text-xs text-zinc-200">Trip #{item.pendingExpense.tripId} · {item.pendingExpense.category} · ₹{item.pendingExpense.amount} · {item.pendingExpense.expenseDate}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => confirmExpense(item.pendingExpense, index)} disabled={loading} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50">{loading ? "Saving..." : "Confirm expense"}</button>
                        <button type="button" onClick={() => cancelExpense(index)} disabled={loading} className="rounded-lg border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="w-fit rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-300">Thinking...</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
              {["What's the weather in Goa?", "What is the baggage policy?", "Show my trips & budget"].map((prompt) => (
                <button key={prompt} onClick={() => sendMessage(prompt)} className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-2 hover:bg-zinc-800">{prompt}</button>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-zinc-800 p-3">
            <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Ask about trips, weather, or travel policies..." className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-4 py-3 outline-none ring-violet-500 focus:ring-2" />
            <button onClick={() => sendMessage()} disabled={loading} className="rounded-xl bg-violet-600 px-4 hover:bg-violet-500 disabled:opacity-50" aria-label="Send message"><FaPaperPlane /></button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((value) => !value)} className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-2xl text-white shadow-2xl transition hover:scale-105" aria-label="Open AI assistant">
        {open ? <FaTimes /> : <FaRobot />}
      </button>
    </>
  );
};

export default AIChatAssistant;









