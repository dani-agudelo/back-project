/**
 * Rutas específicas para las funcionalidades del rol SuperAdmin.
 * Usa el middleware para proteger las rutas
 */

const express = require("express");
const { authorizeRole } = require("../middlewares/authMiddleware");
const { uploadFile, getDashboard } = require("../controllers/AdminController");

const router = express.Router();

console.log("AdminRoutes.js loaded", authorizeRole);
// Ruta para subir archivos (solo SUPERADMIN)
router.post("/upload", authorizeRole("SUPERADMIN"), uploadFile);

// Ruta para acceder al dashboard (solo SUPERADMIN)
router.get("/dashboard", authorizeRole("SUPERADMIN"), getDashboard);

module.exports = router;