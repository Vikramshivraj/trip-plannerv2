import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaPlaneDeparture } from "react-icons/fa";
import API from "../api/api";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async () => {
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    try {
      const res = await API.post(
        "/auth/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem(
        "token",
        res.data.token
      );

      alert(res.data.message);

      navigate("/dashboard");
    } catch (error) {
      console.log(error);

      alert(
        error.response?.data?.message ||
        "Login Failed"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white border border-[#eadfd4] rounded-[2rem] p-8 shadow-[0_20px_60px_rgba(71,53,43,0.12)]">

        <div className="flex justify-center mb-6">
          <div className="bg-[#d84944] p-4 rounded-2xl shadow-lg shadow-[#d84944]/20">
            <FaPlaneDeparture className="text-white text-3xl" />
          </div>
        </div>

        <h1 className="font-serif text-[#2e2725] text-4xl font-black text-center mb-2">
          Welcome back
        </h1>

        <p className="text-[#8b8077] text-center mb-8">
          Your next saved place is waiting.
        </p>

        <input
          type="email"
          name="email"
          value={formData.email}
          placeholder="Enter Email"
          onChange={handleChange}
          autoComplete="email"
          className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none mb-4 focus:border-[#d84944]"
        />

        <input
          type="password"
          name="password"
          value={formData.password}
          placeholder="Enter Password"
          onChange={handleChange}
          autoComplete="current-password"
          className="w-full p-4 rounded-2xl bg-[#faf8f5] border border-[#e7ddd3] text-[#2e2725] outline-none mb-6 focus:border-[#d84944]"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-[#2e2725] hover:bg-[#443b37] hover:-translate-y-0.5 transition-all text-white p-4 rounded-full font-bold shadow-lg"
        >
          Login
        </button>

        <p className="text-[#8b8077] text-center mt-6">
          Don’t have an account?

          <Link
            to="/register"
            className="text-[#d84944] ml-1 font-bold hover:underline"
          >
            Register
          </Link>
        </p>

      </div>

    </div>
  );
};

export default Login;
