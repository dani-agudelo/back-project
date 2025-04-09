/**
 * Rutas específicas para las funcionalidades del rol SuperAdmin.
 * Usa el middleware para proteger las rutas
 */

const express = require("express");
const { authorizeRole } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const {
  uploadFile,
  getDashboard,
  processCsv,
  validateCsv,
} = require("../controllers/AdminController");

const router = express.Router();

// Ruta para subir archivos (solo SUPERADMIN)
router.post("/upload", authorizeRole("SUPERADMIN"), uploadFile);
// Ruta para acceder al dashboard (solo SUPERADMIN)
router.get("/dashboard", authorizeRole("SUPERADMIN"), getDashboard);
// Ruta para procesar el archivo CSV (solo SUPERADMIN)
router.post(
  "/process-csv",
  authorizeRole("SUPERADMIN"),
  upload.single("file"),
  processCsv
);

// Ruta para validar el archivo CSV (solo SUPERADMIN)
router.post(
  "/validate-csv",
  authorizeRole("SUPERADMIN"),
  upload.single("file"),
  validateCsv
);

module.exports = router;
