/**
 * Rutas específicas para las funcionalidades del rol SuperAdmin.
 * Usa el middleware para proteger las rutas
 */

const express = require("express");
const { authorizeRole } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const {
  processCsv,
  validateCsv,
  getCitiesAndDepartments,
} = require("../controllers/AdminController");

const router = express.Router();

router.post(
  "/process-csv",
  authorizeRole("SUPERADMIN"),
  upload.single("file"),
  processCsv
);

router.get(
  "/validate-csv",
  authorizeRole("SUPERADMIN"),
  upload.single("file"),
  validateCsv
);

router.get(
    "/get-cities",
    authorizeRole("SUPERADMIN"),
    getCitiesAndDepartments
)

module.exports = router;
