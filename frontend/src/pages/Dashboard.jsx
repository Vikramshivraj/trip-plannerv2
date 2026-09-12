import { useCallback, useEffect, useState } from "react";
import {
  FaArrowRight, FaCompass, FaMagic, FaMapMarkedAlt, FaMoneyBillWave,
  FaPlus, FaSignOutAlt, FaWallet,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";
import AIChatAssistant from "../components/AIChatAssistant";

const pinImages = [
  "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1496372412473-e8548ffd82bc?auto=format&fit=crop&w=900&q=80",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const fetchTrips = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/trips", { headers: { authorization: token } });
      setTrips(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchTotalExpenses = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/trips/total-expenses", { headers: { authorization: token } });
      setTotalExpenses(res.data.totalExpenses);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    fetchTotalExpenses();
  }, [fetchTrips, fetchTotalExpenses]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this trip and its expenses?")) return;
    try {
      const token = localStorage.getItem("token");
      await API.delete(`/trips/${id}`, { headers: { authorization: token } });
      fetchTrips();
      fetchTotalExpenses();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Delete failed");
    }
  };

  const handleUpdate = async (trip) => {
    const newName = window.prompt("Name your adventure", trip.trip_name);
    if (!newName) return;
    if (newName.trim().length < 2 || newName.trim().length > 80) {
      alert("Trip name must be between 2 and 80 characters");
      return;
    }
    const newDestination = window.prompt("Destination", trip.destination);
    if (!newDestination) return;
    const newBudget = window.prompt("Trip budget", trip.budget);
    const budget = Number(newBudget);
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100000000) {
      alert("Enter a valid positive budget");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await API.put(`/trips/${trip.id}`, {
        trip_name: newName.trim(), destination: newDestination.trim(), budget,
      }, { headers: { authorization: token } });
      fetchTrips();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Update failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const totalBudget = trips.reduce((total, trip) => total + Number(trip.budget), 0);
  const formatMoney = (amount) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount || 0);

  return (
    <main className="min-h-screen bg-[#f8f6f2] text-[#2e2725]">
      <header className="sticky top-0 z-40 border-b border-[#e8e1d8] bg-[#f8f6f2]/90 px-5 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d84944] text-lg text-white shadow-lg shadow-[#d84944]/25"><FaCompass /></span>
            <span><span className="block font-serif text-2xl font-black tracking-tight">Roamly</span><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a69b91]">travel journal</span></span>
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Link to="/create-trip" className="inline-flex items-center gap-2 rounded-full bg-[#2e2725] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#443b37]"><FaPlus />New trip</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 md:grid-cols-[210px_1fr] md:px-10">
        <aside className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          <Link to="/dashboard" className="whitespace-nowrap rounded-2xl bg-[#2e2725] px-4 py-3 text-sm font-bold text-white"><FaMapMarkedAlt className="mr-3 inline" />My board</Link>
          <Link to="/create-trip" className="whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-bold text-[#665c55] transition hover:bg-white"><FaPlus className="mr-3 inline text-[#d84944]" />Plan a trip</Link>
          <Link to="/add-expense" className="whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-bold text-[#665c55] transition hover:bg-white"><FaMoneyBillWave className="mr-3 inline text-[#d84944]" />Add expense</Link>
          <Link to="/ai-planner" className="whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-bold text-[#665c55] transition hover:bg-white"><FaMagic className="mr-3 inline text-[#d84944]" />AI planner</Link>
          <button onClick={handleLogout} className="whitespace-nowrap rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#8b8077] transition hover:bg-white hover:text-[#d84944]"><FaSignOutAlt className="mr-3 inline" />Log out</button>
        </aside>

        <section className="min-w-0">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#d84944]">your collection</p>
              <h1 className="font-serif text-4xl font-black tracking-tight md:text-5xl">Save the feeling, not just the plan.</h1>
              <p className="mt-3 max-w-xl text-[#81756d]">A beautiful board for every place you want to remember.</p>
            </div>
            <Link to="/create-trip" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#d84944] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#d84944]/20 transition hover:-translate-y-0.5"><FaPlus />Create a pin</Link>
          </div>

          <div className="mb-9 grid gap-4 sm:grid-cols-3">
            {[
              ["Trips planned", trips.length, FaMapMarkedAlt, "bg-[#e6d6c5]"],
              ["Dream budget", `₹${formatMoney(totalBudget)}`, FaWallet, "bg-[#dbe6d4]"],
              ["Already spent", `₹${formatMoney(totalExpenses)}`, FaMoneyBillWave, "bg-[#ddd5e9]"],
            ].map(([label, value, Icon, color]) => (
              <div key={label} className={`${color} rounded-3xl p-5`}>
                <Icon className="mb-6 text-lg text-[#6c5f56]" />
                <p className="text-xs font-bold uppercase tracking-wider text-[#776a62]">{label}</p>
                <p className="mt-1 font-serif text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>

          {trips.length === 0 ? (
            <div className="grid min-h-80 place-items-center rounded-[2rem] border-2 border-dashed border-[#ded5ca] bg-[#fffdf9] p-8 text-center">
              <div><span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#f4e7e1] text-2xl text-[#d84944]"><FaCompass /></span><h2 className="font-serif text-3xl font-black">Your board is ready.</h2><p className="mt-2 text-[#81756d]">Pin your first adventure and make it yours.</p><Link to="/create-trip" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2e2725] px-5 py-3 font-bold text-white"><FaPlus />Plan my first trip</Link></div>
            </div>
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
              {trips.map((trip, index) => (
                <article key={trip.id} className="group mb-5 break-inside-avoid overflow-hidden rounded-[1.6rem] bg-white shadow-[0_10px_35px_rgba(71,53,43,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(71,53,43,0.16)]">
                  <div className={`relative overflow-hidden ${index % 3 === 0 ? "h-72" : "h-52"}`}>
                    <img src={pinImages[index % pinImages.length]} alt={trip.destination} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-[#453b36] backdrop-blur">₹{formatMoney(trip.budget)}</span>
                  </div>
                  <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d84944]">{trip.destination}</p><h2 className="mt-1 font-serif text-2xl font-black leading-tight">{trip.trip_name}</h2>
                    <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigate(`/trip/${trip.id}`)} className="rounded-full bg-[#2e2725] px-4 py-2 text-sm font-bold text-white">Open <FaArrowRight className="ml-1 inline text-xs" /></button><button onClick={() => handleUpdate(trip)} className="rounded-full bg-[#f5f1eb] px-4 py-2 text-sm font-bold text-[#665c55]">Edit</button><button onClick={() => handleDelete(trip.id)} className="rounded-full px-3 py-2 text-sm font-bold text-[#ad817d] hover:bg-[#fff0ed]">Delete</button></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <AIChatAssistant />
    </main>
  );
};

export default Dashboard;
