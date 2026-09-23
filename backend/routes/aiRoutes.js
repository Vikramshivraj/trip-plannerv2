const express = require("express");

const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
  generateTripPlan,
  chatWithAssistant,
} = require("../controllers/aiController");

router.post("/generate", verifyToken, generateTripPlan);
router.post("/chat", verifyToken, chatWithAssistant);

module.exports = router;