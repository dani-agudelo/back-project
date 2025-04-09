/**
 * Middleware para manejar la autorización basada en roles.
 */
const jwt = require("jsonwebtoken");


const authorizeRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      // Verifica el token del usuario
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
      }

      // Decodifica el token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(decoded);
      req.user = decoded;
      console.log(decoded)
      // Verifica el rol del usuario
      console.log(req.user.role);
      if (req.user.role !== requiredRole) {
        return res.status(403).json({ message: "Access denied. Insufficient permissions." });
      }

      next(); // Permite el acceso si el rol es válido
    } catch (error) {
      res.status(401).json({ message: "Invalid token." });
    }
  };
};

module.exports = { authorizeRole };