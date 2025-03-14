const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();


const signUp = async (req, res) => {
  let { fullname, email, current_password } = req.body;
  console.log(req.body);
  if (email) {
    email = email.toLowerCase().trim();
  }

  // Validations
  if (!fullname || !email || !current_password) {
    return res.status(400).json({ message: "Please fill all fields" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (current_password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }
  try {
    const existingUser = await prisma.users.findUnique({
      where: {
        email: email,
      },
    });

    // En caso de que encuentre el correo en la base de datos, el usuario ya existe
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(current_password, 10);

    const user = await prisma.users.create({
      data: {
        fullname,
        email,
        current_password: hashedPassword,
      },
    });

    return res.status(200).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "User wasn't created" });
  }
};

const signIn = async (req, res) => {
  let { email, current_password } = req.body;
  console.log(req.body);

  if (email) {
    email = email.toLowerCase().trim();
  }

  // Validate null/empty fields
  if (!email || !current_password) {
    return res.status(400).json({ message: "Please fill all fields" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  try {
    const findUser = await prisma.users.findUnique({
      where: { email },
    });

    // Verify if the user exists
    if (!findUser) {
      return res.status(400).json({ message: "User not found" });
    }

    // Verify if the password is correct
    const validPassword = await bcrypt.compare(
      current_password,
      findUser.current_password
    );

    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Let's create a token that expires in 1 hour
    const token = jwt.sign(
      {
        id: findUser.id,
        email: findUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "User authenticated successfully",
      token,
      id: findUser.id,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Login failed" });
  }
};

module.exports = {
  signUp,
  signIn,
};

/**
Notas: 
AuthController es el archivo que contiene la lógica de negocio de la autenticación de usuarios.
En este archivo se definen dos funciones: signUp y signIn, que se encargan de registrar y autenticar a los 
usuarios respectivamente.

La función signUp recibe los datos del usuario (nombre, correo electrónico y contraseña) y los valida.

Se usa return res.status(code).json(dataObject) para enviar una respuesta al cliente con un código de estado y un
mensaje en formato JSON.
*/
