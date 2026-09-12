import { useEffect, useRef, useState } from "react";
import { FaPaperPlane, FaRobot, FaTimes } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import API from "../api/api";

const AIChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I’m your AI travel assistant. Ask me about destinations, budgets, packing, food, or itineraries." },
  ]);
  const bottomRef = useRef(null);

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
        { message: text, history: nextMessages.slice(-8) },
        { headers: { authorization: token } }
      );
      setMessages((current) => [...current, { role: "assistant", text: res.data.reply }]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [...current, { role: "assistant", text: "I couldn't answer that right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[560px] w-[calc(100vw-2.5rem)] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-violet-700 to-blue-600 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 p-2"><FaRobot /></div>
              <div><h3 className="font-bold">AI Travel Assistant</h3><p className="text-xs text-white/75">Powered by LangChain AI (RAG)</p></div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close chat"><FaTimes /></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((item, index) => (
              <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "bg-blue-600" : "bg-zinc-800"}`}>
                  <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{item.text}</ReactMarkdown></div>
                </div>
              </div>
            ))}
            {loading && <div className="w-fit rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-300">Thinking...</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
              {["What's the weather in Goa?", "Convert 5000 INR to USD", "Show my trips & budget"].map((prompt) => (
                <button key={prompt} onClick={() => sendMessage(prompt)} className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-2 hover:bg-zinc-800">{prompt}</button>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-zinc-800 p-3">
            <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Ask anything about travel..." className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-4 py-3 outline-none ring-violet-500 focus:ring-2" />
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
