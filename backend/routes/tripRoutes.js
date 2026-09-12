const express = require("express");

const router = express.Router();

const { createTrip , getTrips, addExpense, updateExpense, getTripAnalytics, deleteTrip,updateTrip,getTripExpenses,getTotalExpenses } = require("../controllers/tripController");

const verifyToken = require("../middleware/authMiddleware");

router.post("/create", verifyToken, createTrip);

router.get("/", verifyToken , getTrips);

router.post("/expense", verifyToken,addExpense);

router.put("/expense/:id", verifyToken, updateExpense);

router.get("/analytics/:tripId",verifyToken,getTripAnalytics);

router.delete("/:id",verifyToken,deleteTrip);

router.put("/:id",verifyToken,updateTrip);

router.get("/expenses/:id",verifyToken,getTripExpenses);

router.get("/total-expenses",verifyToken,getTotalExpenses);

module.exports = router;
