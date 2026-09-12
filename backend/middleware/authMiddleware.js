const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : authorization;

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid Token",
    });
  }
};

module.exports = verifyToken;
