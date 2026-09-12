import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import AppSidebar from "../components/AppSidebar";

const AddExpense = () => {

  const [trips, setTrips] = useState([]);
  const navigate = useNavigate();

  const [selectedTrip, setSelectedTrip] = useState(null);

  const [formData, setFormData] = useState({
    trip_id: "",
    category: "",
    amount: "",
    expense_date: "",
  });

  const fetchTrips = useCallback(async () => {

    try {

      const token = localStorage.getItem("token");

      const res = await API.get(
        "/trips",
        {
          headers: {
            authorization: token,
          },
        }
      );

      setTrips(res.data);

    } catch (error) {

      console.log(error);

    }

  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleChange = (e) => {

    const { name, value } = e.target;

    if (name === "trip_id") {

      const currentTrip = trips.find(
        (trip) => String(trip.id) === value
      );

      setSelectedTrip(currentTrip);

      setFormData({
        ...formData,
        trip_id: value,
        expense_date: "",
      });

      return;

    }

    setFormData({
      ...formData,
      [name]: value,
    });

  };

  const handleAddExpense = async () => {

    try {

      if (!selectedTrip) {

        alert("Please select a trip");

        return;

      }

      if (!formData.category) {
        alert("Please select an expense category");
        return;
      }

      const amount = Number(formData.amount);

      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
        alert("Enter a valid positive expense amount");
        return;
      }

      if (!formData.expense_date) {
        alert("Please select an expense date");
        return;
      }

      const startDate = new Date(selectedTrip.start_date)
        .toISOString()
        .slice(0, 10);

      const endDate = new Date(selectedTrip.end_date)
        .toISOString()
        .slice(0, 10);

      if (
        formData.expense_date < startDate ||
        formData.expense_date > endDate
      ) {

        alert(
          `Expense date must be between ${startDate} and ${endDate}`
        );

        return;

      }

      const token = localStorage.getItem("token");

      const res = await API.post(
        "/trips/expense",
        formData,
        {
          headers: {
            authorization: token,
          },
        }
      );

      alert(res.data.message);

      setFormData({
        trip_id: "",
        category: "",
        amount: "",
        expense_date: "",
      });

      setSelectedTrip(null);

      navigate("/dashboard");

    } catch (error) {

      console.log(error);

      alert(
        error.response?.data?.message ||
        "Failed To Add Expense"
      );

    }

  };

  return (

    <div className="min-h-screen bg-[#f8f6f2] md:flex">
      <AppSidebar />
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">

      <div className="w-full max-w-2xl bg-white border border-[#eadfd4] rounded-[2rem] p-8 shadow-[0_20px_60px_rgba(71,53,43,0.12)]">

        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#d84944]">keep the memories, track the moments</p>
        <h1 className="font-serif text-[#2e2725] text-4xl font-black mb-2">
          Add an expense
        </h1>

        <p className="text-[#8b8077] mb-8">
          Every little detail helps tell the story of your trip.
        </p>

        <div className="space-y-4">

          {/* Trip Dropdown */}
          <select
            name="trip_id"
            value={formData.trip_id}
            onChange={handleChange}
            className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          >

            <option value="">
              Select Trip
            </option>

            {
              trips.map((trip) => (

                <option
                  key={trip.id}
                  value={trip.id}
                >
                  {trip.trip_name}
                </option>

              ))
            }

          </select>

          {/* Category */}
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          >

            <option value="">
              Select Category
            </option>

            <option value="Hotel">
              Hotel
            </option>

            <option value="Food">
              Food
            </option>

            <option value="Transport">
              Transport
            </option>

            <option value="Shopping">
              Shopping
            </option>

            <option value="Other">
              Other
            </option>

          </select>

          {/* Amount */}
          <input
            type="number"
            name="amount"
            placeholder="Enter Amount"
            value={formData.amount}
            min="0.01"
            max="100000000"
            step="0.01"
            onChange={handleChange}
            className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

          {/* Expense Date */}
          <input
            type="date"
            name="expense_date"
            value={formData.expense_date}
            min={
              selectedTrip
                ? new Date(selectedTrip.start_date)
                    .toISOString()
                    .slice(0, 10)
                : ""
            }
            max={
              selectedTrip
                ? new Date(selectedTrip.end_date)
                    .toISOString()
                    .slice(0, 10)
                : ""
            }
            disabled={!selectedTrip}
            onChange={handleChange}
            className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944] disabled:opacity-50"
          />

          <button
            onClick={handleAddExpense}
            className="w-full bg-[#d84944] hover:bg-[#bf3935] hover:-translate-y-0.5 transition-all text-white p-4 rounded-full font-bold shadow-lg shadow-[#d84944]/20"
          >
            Add Expense
          </button>

        </div>

      </div>

      </main>
    </div>

  );

};

export default AddExpense;
