import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import "./index.css";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateTrip from "./pages/CreateTrip";
import AddExpense from "./pages/AddExpense";
import TripDetails from "./pages/TripDetails";
import AIPlanner from "./pages/AIPlanner";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /> </ProtectedRoute>}/>
      <Route
  path="/create-trip"
  element={
    <ProtectedRoute>
      <CreateTrip />
    </ProtectedRoute>
  }
/>
     <Route
  path="/add-expense"
  element={
    <ProtectedRoute>
      <AddExpense />
    </ProtectedRoute>
  }
/>
  <Route
  path="/trip/:id"
  element={
    <ProtectedRoute>
      <TripDetails />
    </ProtectedRoute>
  }
/>    
    <Route
      path="/ai-planner"
      element={
        <ProtectedRoute>
          <AIPlanner />
        </ProtectedRoute>
      }
    />
    </Routes>
  </BrowserRouter>
);
