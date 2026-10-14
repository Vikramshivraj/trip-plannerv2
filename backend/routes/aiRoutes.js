const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const {
  generateTripPlan,
  chatWithAssistant,
  getChatConversation,
  confirmExpense,
} = require("../controllers/aiController");

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  message: { message: "Chat rate limit reached. Please try again later." },
});

router.post("/generate", verifyToken, generateTripPlan);
router.post("/chat", verifyToken, chatLimiter, chatWithAssistant);
router.get("/chat/:conversationId", verifyToken, getChatConversation);
router.post("/chat/confirm-expense", verifyToken, confirmExpense);

module.exports = router;



