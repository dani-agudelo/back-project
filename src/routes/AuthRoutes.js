const express = require("express");
const router = express.Router();
const { signUp, signIn, verifyCode } = require("../controllers/AuthController");

router.post("/signup", signUp);
router.post("/signin", signIn);
router.post("/verify", verifyCode);

module.exports = router;
