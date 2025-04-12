const express = require("express");
const router = express.Router();
const authRoutes = require("./AuthRoutes");
const userRoutes = require("./UserRoutes");
const adminRoutes = require("./AdminRoutes");
const pokeRoutes = require("./PokeRoutes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/poke", pokeRoutes);



module.exports = router;
