const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const {
  registerUser,
  loginUser,
  getUserPreferences,
  updateUserPreferences
} = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/preferences", verifyToken, getUserPreferences);
router.post("/preferences", verifyToken, updateUserPreferences);

module.exports = router;