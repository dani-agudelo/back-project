const multer = require("multer");
const storage = multer.memoryStorage(); // Guarda en memoria, no en disco
const upload = multer({ storage });

module.exports = upload;
