import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaGlobeAsia } from "react-icons/fa";
import API from "../api/api";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async () => {
    // Clean the input before validation
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Name validation
    if (!name) {
      alert("Name is required");
      return;
    }

    if (name.length < 2) {
      alert("Name must be at least 2 characters long");
      return;
    }

    if (name.length > 50) {
      alert("Name must not exceed 50 characters");
      return;
    }

    // Email validation
    if (!email) {
      alert("Email is required");
      return;
    }

    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address");
      return;
    }

    // Password validation
    if (!password) {
      alert("Password is required");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    try {
      const res = await API.post(
        "/auth/register",
        {
          name,
          email,
          password,
        }
      );

      alert(res.data.message);

      navigate("/");
    } catch (error) {
      console.log(error);

      alert(
        error.response?.data?.message ||
        "Registration Failed"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white border border-[#eadfd4] rounded-[2rem] p-8 shadow-[0_20px_60px_rgba(71,53,43,0.12)]">

        <div className="flex justify-center mb-6">
          <div className="bg-[#d84944] p-4 rounded-2xl shadow-lg shadow-[#d84944]/20">
            <FaGlobeAsia className="text-white text-3xl" />
          </div>
        </div>

        <h1 className="font-serif text-[#2e2725] text-4xl font-black text-center mb-2">
          Make a new board
        </h1>

        <p className="text-[#8b8077] text-center mb-8">
          Save every place that calls your name.
        </p>

        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter Name"
          autoComplete="name"
          className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none mb-4 focus:border-[#d84944] transition-all"
        />

        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter Email"
          autoComplete="email"
          className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none mb-4 focus:border-[#d84944] transition-all"
        />

        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter Password"
          autoComplete="new-password"
          className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none mb-6 focus:border-[#d84944] transition-all"
        />

        <button
          onClick={handleRegister}
          className="w-full bg-[#2e2725] hover:bg-[#443b37] hover:-translate-y-0.5 transition-all text-white p-4 rounded-full font-bold shadow-lg"
        >
          Register
        </button>

        <p className="text-[#8b8077] text-center mt-6">
          Already have an account?

          <Link
            to="/"
            className="text-[#d84944] ml-1 font-bold hover:underline"
          >
            Login
          </Link>
        </p>

      </div>

    </div>
  );
};

export default Register;
