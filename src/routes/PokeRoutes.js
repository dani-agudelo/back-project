const express = require("express");
const router = express.Router();
const { getAllPokemon } = require("../controllers/PokeController");

router.get("/pokemon", getAllPokemon);

module.exports = router;