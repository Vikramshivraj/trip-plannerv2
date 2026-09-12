import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import AppSidebar from "../components/AppSidebar";

const CreateTrip = () => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    trip_name: "",
    destination: "",
    start_date: "",
    end_date: "",
    budget: "",
  });

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };

  const handleCreateTrip = async () => {
    try {
      const destination = formData.destination.trim();
      const destinationRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s,.'-]{1,59}$/;
      const unsupported = ["mars", "moon", "jupiter", "saturn", "venus", "mercury", "uranus", "neptune", "pluto"];
      const budget = Number(formData.budget);

      // Date must be YYYY-MM-DD with exactly a 4-digit year
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (formData.trip_name.trim().length < 2 || formData.trip_name.trim().length > 80) {
        alert("Trip name must be between 2 and 80 characters");
        return;
      }

      if (!destinationRegex.test(destination)) {
        alert("Enter a valid destination, for example Goa or New Delhi");
        return;
      }

      if (unsupported.includes(destination.toLowerCase())) {
        alert("Please enter a real-world destination on Earth");
        return;
      }

      if (!Number.isFinite(budget) || budget <= 0 || budget > 100000000) {
        alert("Enter a valid positive budget");
        return;
      }

      if (!formData.start_date || !formData.end_date) {
        alert("Enter valid start and end dates");
        return;
      }

      if (
        !dateRegex.test(formData.start_date) ||
        !dateRegex.test(formData.end_date)
      ) {
        alert("Year must contain exactly 4 digits");
        return;
      }

      const startYear = Number(formData.start_date.split("-")[0]);
      const endYear = Number(formData.end_date.split("-")[0]);

      if (
        startYear < 1000 ||
        startYear > 9999 ||
        endYear < 1000 ||
        endYear > 9999
      ) {
        alert("Year must contain exactly 4 digits");
        return;
      }

      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
      ) {
        alert("Enter valid start and end dates");
        return;
      }

      if (end < start) {
        alert("End date cannot be before start date");
        return;
      }

      const durationDays = Math.floor((end - start) / 86400000) + 1;

      if (durationDays > 30) {
        alert("Trip duration must be 30 days or less");
        return;
      }

      const token = localStorage.getItem("token");

      const res = await API.post(
        "/trips/create",
        formData,
        {
          headers: {
            authorization: token,
          },
        }
      );

      alert(res.data.message);

      setFormData({
        trip_name: "",
        destination: "",
        start_date: "",
        end_date: "",
        budget: "",
      });

      navigate("/dashboard");

    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Trip Creation Failed");
    }

  };

  return (

    <div className="min-h-screen bg-[#f8f6f2] md:flex">
      <AppSidebar />
      <main className="flex flex-1 items-center justify-center p-6 md:p-10">

      <div className="w-full max-w-2xl bg-white border border-[#eadfd4] rounded-[2rem] p-8 shadow-[0_20px_60px_rgba(71,53,43,0.12)]">

        <h1 className="font-serif text-[#2e2725] text-4xl font-black mb-2">
          Create New Trip ✈️
        </h1>

        <p className="text-[#8b8077] mb-8">
          Start with a place that makes your heart skip a beat.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input
            type="text"
            name="trip_name"
            placeholder="Trip Name"
            value={formData.trip_name}
            minLength={2}
            maxLength={80}
            onChange={handleChange}
            className="p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

          <input
            type="text"
            name="destination"
            placeholder="Destination"
            value={formData.destination}
            maxLength={60}
            onChange={handleChange}
            className="p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

          <input
            type="date"
            name="start_date"
            value={formData.start_date}
            min="1000-01-01"
            max="9999-12-31"
            onChange={handleChange}
            className="p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

          <input
            type="date"
            name="end_date"
            value={formData.end_date}
            min={formData.start_date || "1000-01-01"}
            max="9999-12-31"
            onChange={handleChange}
            className="p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

          <input
            type="number"
            name="budget"
            placeholder="Budget"
            value={formData.budget}
            min="1"
            max="100000000"
            onChange={handleChange}
            className="md:col-span-2 p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none focus:border-[#d84944]"
          />

        </div>

        <button
          onClick={handleCreateTrip}
          className="w-full mt-8 bg-[#d84944] hover:bg-[#bf3935] hover:-translate-y-0.5 transition-all text-white p-4 rounded-full font-bold shadow-lg shadow-[#d84944]/20"
        >
          Create Trip
        </button>

      </div>

      </main>
    </div>

  );

};

export default CreateTrip;
