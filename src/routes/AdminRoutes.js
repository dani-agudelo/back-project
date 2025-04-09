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
  getCitiesAndDepartments,
  getLogs,
} = require("../controllers/AdminController");

const router = express.Router();

router.get("/dashboard", authorizeRole("SUPERADMIN"), getDashboard);
router.post(
  "/process-csv",
  authorizeRole("SUPERADMIN"),
  upload.single("file"),
  processCsv
);

router.post(
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

router.get(
    "/logs", 
    authorizeRole("SUPERADMIN"), 
    getLogs);

module.exports = router;
