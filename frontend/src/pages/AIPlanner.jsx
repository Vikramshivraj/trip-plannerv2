import { useState } from "react";
import { FaDownload, FaWandMagicSparkles } from "react-icons/fa6";
import { FaMagic } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import API from "../api/api";
import AppSidebar from "../components/AppSidebar";
import MapComponent from "../components/MapComponent";

const AIPlanner = () => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("");
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    destination: "",
    budget: "",
    days: "",
    travelType: "Solo",
  });

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const validateForm = () => {
    const destination = formData.destination.trim();
    const destinationRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s,.'-]{1,59}$/;
    const unsupported = ["mars", "moon", "jupiter", "saturn", "venus", "mercury", "uranus", "neptune", "pluto"];
    const budget = Number(formData.budget);
    const days = Number(formData.days);
    if (!destinationRegex.test(destination)) return "Enter a valid destination, for example Goa or New Delhi.";
    if (unsupported.includes(destination.toLowerCase())) return "Please enter a real-world destination on Earth.";
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100000000) return "Enter a valid positive budget.";
    if (!Number.isInteger(days) || days < 1 || days > 30) return "Trip duration must be between 1 and 30 days.";
    return "";
  };

  const generatePlan = async () => {
    const validationError = validateForm();
    if (validationError) return setError(validationError);

    try {
      setError("");
      setLoading(true);
      setPlan("");
      setLocations([]);

      const token = localStorage.getItem("token");
      const response = await API.post("/ai/generate", formData, {
        headers: { authorization: token },
        timeout: 120000, // 2 minute timeout for AI generation
      });

      const rawPlan = response.data.plan;
      if (!rawPlan) {
        throw new Error("Server returned empty plan.");
      }

      // Extract map locations JSON if embedded in the markdown
      let parsedLocations = [];
      let cleanPlan = rawPlan;

      const jsonMatch = rawPlan.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsedLocations = JSON.parse(jsonMatch[1].trim());
          cleanPlan = rawPlan.replace(jsonMatch[0], "").trim();
        } catch (e) {
          console.error("Failed to parse map locations JSON", e);
        }
      }

      setPlan(cleanPlan);
      setLocations(parsedLocations);
    } catch (requestError) {
      console.error("AI Planner error:", requestError);
      const serverMsg = requestError.response?.data?.message;
      const statusCode = requestError.response?.status;

      if (statusCode === 429) {
        setError("AI rate limit reached. Please wait a minute and try again.");
      } else if (statusCode === 503) {
        setError("AI service is temporarily busy. Please try again in a moment.");
      } else if (statusCode === 401) {
        setError("Your session has expired. Please log in again.");
      } else {
        setError(serverMsg || requestError.message || "Failed to generate plan. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPlan = () => {
    if (!plan) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return alert("Please allow pop-ups to download the itinerary");
    const safeText = plan.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    printWindow.document.write(`<!doctype html><html><head><title>${formData.destination || "Trip"} Itinerary</title><style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;padding:0 24px;color:#2e2725;line-height:1.6}h1{margin-bottom:4px}.meta{color:#81756d;margin-bottom:28px}.plan{white-space:pre-wrap;font-family:Arial,sans-serif}@media print{button{display:none}}</style></head><body><h1>${formData.destination || "AI Trip"} Itinerary</h1><div class="meta">Budget: ₹${formData.budget || "-"} · ${formData.days || "-"} days · ${formData.travelType}</div><div class="plan">${safeText}</div><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-[#2e2725] md:flex">
      <AppSidebar />
      <main className="flex-1 px-5 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] bg-[#2e2725] p-7 text-white shadow-[0_20px_60px_rgba(71,53,43,0.2)] md:p-9">
            <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#d84944] text-xl shadow-lg shadow-black/20"><FaWandMagicSparkles /></span>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#efaaa5]">your personal guide</p>
            <h1 className="mt-2 font-serif text-4xl font-black leading-tight">Let's design a trip worth pinning.</h1>
            <p className="mt-4 max-w-md text-[#c8bfba]">Give us the essentials. Your AI travel companion will shape the moments in between.</p>

            <div className="mt-8 space-y-4">
              <label className="block text-sm font-bold text-[#e8ddd6]">Where are you going?
                <input type="text" name="destination" placeholder="Goa, Jaipur, New Delhi…" value={formData.destination} maxLength={60} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-white placeholder:text-[#aca09a] outline-none transition focus:border-[#efaaa5] focus:bg-white/15" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-bold text-[#e8ddd6]">Your budget
                  <input type="number" name="budget" placeholder="25,000" value={formData.budget} min="1" max="100000000" onChange={handleChange} className="mt-2 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-white placeholder:text-[#aca09a] outline-none focus:border-[#efaaa5]" />
                </label>
                <label className="block text-sm font-bold text-[#e8ddd6]">Number of days
                  <input type="number" name="days" placeholder="3" value={formData.days} min="1" max="30" step="1" onChange={handleChange} className="mt-2 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-white placeholder:text-[#aca09a] outline-none focus:border-[#efaaa5]" />
                </label>
              </div>
              <label className="block text-sm font-bold text-[#e8ddd6]">Your travel style
                <select name="travelType" value={formData.travelType} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-white outline-none focus:border-[#efaaa5]">
                  <option className="text-[#2e2725]">Solo</option><option className="text-[#2e2725]">Friends</option><option className="text-[#2e2725]">Family</option><option className="text-[#2e2725]">Couple</option>
                </select>
              </label>
              {error && <div className="rounded-2xl border border-[#efaaa5]/40 bg-[#d84944]/20 p-3 text-sm text-[#ffd4d0]">{error}</div>}
              <button onClick={generatePlan} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d84944] p-4 font-bold text-white transition hover:bg-[#bf3935] disabled:cursor-wait disabled:opacity-60"><FaMagic />{loading ? "Dreaming up your itinerary…" : "Create my itinerary"}</button>
            </div>
          </section>

          <section className="min-h-[560px] rounded-[2rem] border border-[#eadfd4] bg-white p-7 shadow-[0_20px_60px_rgba(71,53,43,0.08)] md:p-9">
            {plan ? (
              <>
                <div className="mb-7 flex items-start justify-between gap-4 border-b border-[#eee7df] pb-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d84944]">your itinerary</p>
                    <h2 className="mt-1 font-serif text-3xl font-black">{formData.destination} in focus</h2>
                  </div>
                  <button onClick={downloadPlan} title="Download as PDF" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#f5f1eb] px-4 py-2 text-sm font-bold text-[#655950] transition hover:bg-[#eadfd4]"><FaDownload />Download itinerary</button>
                </div>
                
                {locations.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-serif text-xl font-bold mb-2">Trip Highlights Map</h3>
                    <MapComponent locations={locations} />
                  </div>
                )}
                
                <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:font-black prose-h1:text-4xl prose-h2:text-2xl">
                  <ReactMarkdown>{plan}</ReactMarkdown>
                </article>
              </>
            ) : (
              <div className="grid h-full min-h-[490px] place-items-center text-center">
                <div>
                  <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-[#f4e7e1] text-3xl text-[#d84944]"><FaWandMagicSparkles /></span>
                  <h2 className="font-serif text-3xl font-black">Your itinerary will live here.</h2>
                  <p className="mx-auto mt-3 max-w-sm text-[#8b8077]">Choose a destination and a few details, then let the spark happen.</p>
                </div>
              </div>
            )}
          </section>
        </div>
        </div>
      </main>
    </div>
  );
};

export default AIPlanner;
