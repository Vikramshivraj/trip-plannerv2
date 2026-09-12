import axios from "axios";

const API = axios.create({
   // baseURL: "https://trip-planner-pw9x.onrender.com/api",
   baseURL: "http://localhost:5000/api",
   
});

export default API;