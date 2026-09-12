import { FaCompass, FaMapMarkedAlt, FaMoneyBillWave, FaPlus, FaSignOutAlt } from "react-icons/fa";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { Link, useLocation, useNavigate } from "react-router-dom";

const navigation = [
  { to: "/dashboard", label: "My board", icon: FaMapMarkedAlt },
  { to: "/create-trip", label: "Plan a trip", icon: FaPlus },
  { to: "/add-expense", label: "Add expense", icon: FaMoneyBillWave },
  { to: "/ai-planner", label: "AI planner", icon: FaWandMagicSparkles },
];

const AppSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <aside className="border-b border-[#e8e1d8] bg-[#f8f6f2] p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r md:p-6">
      <Link to="/dashboard" className="mb-5 flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d84944] text-white shadow-lg shadow-[#d84944]/25"><FaCompass /></span>
        <span><span className="block font-serif text-2xl font-black tracking-tight">Roamly</span><span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a69b91]">travel journal</span></span>
      </Link>
      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {navigation.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return <Link key={to} to={to} className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-[#2e2725] text-white" : "text-[#665c55] hover:bg-white"}`}><Icon className={`mr-3 inline ${active ? "" : "text-[#d84944]"}`} />{label}</Link>;
        })}
      </nav>
      <button onClick={logout} className="mt-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#8b8077] transition hover:bg-white hover:text-[#d84944] md:mt-auto"><FaSignOutAlt className="mr-3 inline" />Log out</button>
    </aside>
  );
};

export default AppSidebar;
