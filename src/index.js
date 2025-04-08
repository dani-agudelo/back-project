const express = require("express");
require("dotenv").config();
const connnectionDB = require("./config/database");
const routes = require("./routes/routes");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3005;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors())
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(bodyParser.json());
app.use("/api/v1", routes);

connnectionDB();

/**
Notas: 
Index es el archivo principal de la aplicación, es el punto de entrada de la aplicación.
*/
