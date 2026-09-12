import { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaMapMarkerAlt, FaMoneyBillWave, FaPlus, FaWallet } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import API from "../api/api";
import AppSidebar from "../components/AppSidebar";

const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  const fetchExpenses = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await API.get(`/trips/expenses/${id}`, { headers: { authorization: token } });
      setExpenses(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load expenses.");
    }
  }, [id]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await API.get(`/trips/analytics/${id}`, { headers: { authorization: token } });
      setAnalytics(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load this trip.");
    }
  }, [id]);

  useEffect(() => {
    fetchExpenses();
    fetchAnalytics();
  }, [fetchAnalytics, fetchExpenses]);

  const money = (value) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);

  const editExpense = async (expense) => {
    const category = window.prompt("Expense category (Hotel, Food, Transport, Shopping, or Other)", expense.category);
    if (!category) return;
    const amountInput = window.prompt("Expense amount", expense.amount);
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      alert("Enter a valid positive expense amount");
      return;
    }
    const currentDate = String(expense.expense_date).slice(0, 10);
    const expenseDate = window.prompt("Expense date (YYYY-MM-DD)", currentDate);
    if (!expenseDate) return;

    try {
      const token = localStorage.getItem("token");
      await API.put(`/trips/expense/${expense.id}`, {
        category: category.trim(), amount, expense_date: expenseDate,
      }, { headers: { authorization: token } });
      fetchExpenses();
      fetchAnalytics();
    } catch (requestError) {
      alert(requestError.response?.data?.message || "Could not update expense.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] text-[#2e2725] md:flex">
      <AppSidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-5xl">
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#756960] transition hover:bg-white"><FaArrowLeft />Back to board</button>
          {error ? <div className="mt-5 rounded-2xl border border-[#e9b3af] bg-[#f9e5e2] p-4 text-[#943c36]">{error}</div> : !analytics ? <div className="grid min-h-80 place-items-center"><p className="font-serif text-2xl font-black">Loading your travel story…</p></div> : <>
            <header className="mt-6 rounded-[2rem] bg-[#2e2725] p-7 text-white shadow-[0_20px_60px_rgba(71,53,43,0.2)] md:p-9">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#efaaa5]">your travel pin</p>
              <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="font-serif text-4xl font-black md:text-5xl">{analytics.trip_name}</h1><p className="mt-3 flex items-center gap-2 text-[#d8cec8]"><FaMapMarkerAlt className="text-[#efaaa5]" />A trip worth remembering</p></div><Link to="/add-expense" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#d84944] px-5 py-3 font-bold text-white transition hover:bg-[#bf3935]"><FaPlus />Add expense</Link></div>
            </header>

            <section className="mt-7 grid gap-4 sm:grid-cols-3">
              {[["Trip budget", analytics.budget, FaWallet, "bg-[#e6d6c5]"], ["Spent so far", analytics.total_spent, FaMoneyBillWave, "bg-[#ddd5e9]"], [Number(analytics.remaining_budget) < 0 ? "Over budget" : "Budget remaining", Math.abs(Number(analytics.remaining_budget)), FaMapMarkerAlt, Number(analytics.remaining_budget) < 0 ? "bg-[#f3d7d3]" : "bg-[#dbe6d4]"]].map(([label, value, Icon, color]) => <div key={label} className={`${color} rounded-3xl p-5`}><Icon className="mb-6 text-lg text-[#6c5f56]" /><p className="text-xs font-bold uppercase tracking-wider text-[#776a62]">{label}</p><p className="mt-1 font-serif text-3xl font-black">₹{money(value)}</p></div>)}
            </section>

            <section className="mt-7 rounded-[2rem] border border-[#eadfd4] bg-white p-6 shadow-[0_20px_60px_rgba(71,53,43,0.08)] md:p-8">
              <div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#d84944]">little moments</p><h2 className="mt-1 font-serif text-3xl font-black">Expense journal</h2></div><span className="rounded-full bg-[#f5f1eb] px-3 py-1.5 text-sm font-bold text-[#756960]">{expenses.length} entries</span></div>
              {expenses.length === 0 ? <div className="rounded-3xl bg-[#faf8f5] p-10 text-center"><p className="font-serif text-2xl font-black">Nothing pinned here yet.</p><p className="mt-2 text-[#8b8077]">Add an expense to start your trip journal.</p></div> : <div className="grid gap-3">{expenses.map((expense) => <div key={expense.id} className="flex items-center justify-between gap-4 rounded-2xl bg-[#faf8f5] p-4 transition hover:bg-[#f5f1eb]"><div><p className="font-bold">{expense.category}</p><p className="mt-1 text-sm text-[#91857d]">Trip memory</p></div><div className="flex items-center gap-3"><p className="font-serif text-xl font-black text-[#d84944]">₹{money(expense.amount)}</p><button onClick={() => editExpense(expense)} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#665c55] shadow-sm transition hover:bg-[#eadfd4]">Edit</button></div></div>)}</div>}
            </section>
          </>}
        </div>
      </main>
    </div>
  );
};

export default TripDetails;
