const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed in protect:', err.message, 'Token:', token);
    res.status(401).json({ message: "Invalid token" });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Optional auth: attach req.user if valid token present; otherwise continue
exports.optionalProtect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // ignore invalid token to keep route public
  }
  next();
};

// Combined middleware for admin routes
exports.admin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized" });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (err) {
    console.error('JWT verification failed in admin:', err.message, 'Token:', token);
    res.status(401).json({ message: "Invalid token" });
  }
};
