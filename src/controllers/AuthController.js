const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { sendSMS } = require('../service/TwilioService');
require("dotenv").config();

// Configuración del transporte de correo electrónico, se hará usando Gmail
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Función para generar un código aleatorio de 6 dígitos para verificar la cuenta
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Función para enviar el correo electrónico con el código de verificación
const sendVerificationEmail = async (email, code, fullname) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Código de verificación para tu cuenta",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Verificación de cuenta</h2>
          <p>Hola ${fullname},</p>
          <p>Gracias por registrarte. Para completar tu registro, por favor utiliza el siguiente código de verificación:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Este código expirará en 15 minutos.</p>
          <p>Si no has solicitado este código, por favor ignora este correo.</p>
          <p>Saludos,<br>El equipo de soporte</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

// Función para registrar un nuevo usuario
const signUp = async (req, res) => {
  let { fullname, email, current_password, role } = req.body;

  if (email) {
    email = email.toLowerCase().trim();
  }

  // Validate null/empty field
  if (!fullname || !email || !current_password) {
    return res.status(400).json({
      message: "All required fields: fullname, email and password",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Invalid email format",
    });
  }

  // Validate password length
  if (current_password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters long",
    });
  }

  // Verificar si el correo electrónico ya está registrado
  try {
    const existinguser = await prisma.users.findUnique({
      where: { email },
    });

    // En caso de que encuentre el correo electrónico en la BD
    // El usuario ya existe
    if (existinguser) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(current_password, 10);

    // Generar código de verificación, el de 6 dígitos
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 15); // Expira en 15 minutos

    // Guardar usuario con estado pendiente y código de verificación
    const user = await prisma.users.create({
      data: {
        fullname,
        email,
        current_password: hashedPassword,
        role: role || "EDITOR", // Asignar rol por defecto
        status: "PENDING",
        verificationCode,
        verificationCodeExpires: expirationTime,
      },
    });
    console.log("Nodemailer transport:", nodemailer.createTransport);

    // Enviar correo con código de verificación
    console.log("Calling sendVerificationEmail...");
    const emailSent = await sendVerificationEmail(
      email,
      verificationCode,
      fullname
    );
    console.log("Email sent status:", emailSent);

    if (!emailSent) {
      // Si falla el envío del correo, eliminamos el usuario creado
      await prisma.users.delete({
        where: { id: user.id },
      });

      return res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    // No enviamos el código ni datos sensibles en la respuesta
    res.status(201).json({
      message:
        "User registered successfully. Please check your email for verification code.",
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.log("Error details:", error);
    res.status(500).json({
      message: "User was not created",
      error: error.message,
    });
  }
};

// Nueva función para verificar el código de autenticación
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      message: "Email and verification code are required",
    });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({
        message: "User is already verified",
      });
    }

    // Verificar si el código ha expirado
    const now = new Date();
    if (now > user.verificationCodeExpires) {
      return res.status(400).json({
        message: "Verification code has expired. Please request a new one.",
      });
    }

    // Verificar si el código es correcto
    if (user.verificationCode !== code) {
      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    // Actualizar estado del usuario a activo
    await prisma.users.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        verificationCode: null,
        verificationCodeExpires: null,
      },
    });

    // Generar token de autenticación
    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );

    res.status(200).json({
      message: "Account verified successfully",
      token,
    });
  } catch (error) {
    console.log("Error during verification:", error);
    res.status(500).json({
      message: "Verification failed",
      error: error.message,
    });
  }
  
};

// Función para reenviar el código de verificación
const resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
    });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({
        message: "User is already verified",
      });
    }

    // Generar nuevo código y actualizar fecha de expiración
    const newCode = generateVerificationCode();
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 15);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        verificationCode: newCode,
        verificationCodeExpires: expirationTime,
      },
    });

    // Enviar nuevo código por correo
    const emailSent = await sendVerificationEmail(
      email,
      newCode,
      user.fullname
    );

    if (!emailSent) {
      return res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    res.status(200).json({
      message: "Verification code sent successfully. Please check your email.",
    });
  } catch (error) {
    console.log("Error resending code:", error);
    res.status(500).json({
      message: "Failed to resend verification code",
      error: error.message,
    });
  }
};

// Función para iniciar sesión
const signIn = async (req, res) => {
  let { email, current_password } = req.body;
  console.log(req.body);

  if (email) {
    email = email.toLowerCase().trim();
  }

  // Validate null/empty field
  if (!email || !current_password) {
    return res.status(400).json({
      message: "Both fields are required",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Invalid email format",
    });
  }

  try {
    const findUser = await prisma.users.findUnique({
      where: { email },
    });

    console.log("usuario", findUser)
    // Verify user exists
    if (!findUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify password
    const validatePassword = await bcrypt.compare(
      current_password,
      findUser.current_password
    );
    console.log("contraseña", validatePassword)

    if (!validatePassword) {
      return res.status(400).json({
        message: "Password doesn't match",
      });
    }


    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 5 * 60000); // 5 minutos
    // const expires = new Date(Date.now() + 1 * 60000); // 1 minuto
    console.log("twilio", code)
    await prisma.users.update({
      where: { id: findUser.id },
      data: {
        twoFactorCode: code,
        twoFactorExpires: expires,
      },
    });

    await sendSMS(process.env.MY_PHONE_NUMBER, code); //servicio de twilio

    return res.status(200).json({
      message: 'Verification code sent via SMS',
      userId: findUser.id,
    });

  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
    
  }
};

const verifyTwoFactorCode = async (req, res) => {
  const { userId, code } = req.body;

  const user = await prisma.users.findUnique({ where: { id: userId } });

  if (!user?.twoFactorCode || !user?.twoFactorExpires) {
    return res.status(400).json({ message: "Invalid verification process" });
  }
  
  const now = new Date();
  if (user.twoFactorCode !== code || now > user.twoFactorExpires) {
    return res.status(400).json({ message: "Invalid or expired verification code" });
  }

  // Código correcto: generar token
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });

  // Limpiar el código para seguridad
  await prisma.users.update({
    where: { id: user.id },
    data: {
      twoFactorCode: null,
      twoFactorExpires: null,
    },
  });

  return res.status(200).json({
    message: "Login successful",
    token,
  });
};

module.exports = {
  signUp,
  signIn,
  verifyCode,
  resendVerificationCode,
  verifyTwoFactorCode
};
