const express = require("express");
const router = express.Router();
const authRoutes = require("./AuthRoutes");
const userRoutes = require("./UserRoutes");
const adminRoutes = require("./AdminRoutes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);


module.exports = router;
