jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Creamos mocks para las funciones de Prisma
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

// Mock de PrismaClient
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    users: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  })),
}));

// Mock de bcrypt
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock para generar el token en el momento de autenticación
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("test_token"),
}));

// Mock de nodemailer
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ response: "Email sent" }),
  }),
}));

const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  signUp,
  signIn,
  verifyCode,
  resendVerificationCode,
} = require("../../../src/controllers/AuthController");

// Mock que omite algunos de los console.log del AuthController
jest.spyOn(console, "log").mockImplementation(() => {});

// Prueba de la función signUp
describe("SignUp Controller Method", () => {
  let req;
  let res;

  // Reiniciar mocks antes de cada prueba
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(), // Simula el comportamiento de res.status(200)
      json: jest.fn(), // Simula el comportamiento de res.json({ message: "User created successfully" })
    };
  });

  //* Prueba 1: Todos los campos requeridos
  test("Return message all required fields", async () => {
    // Pasamos el request body de la solicitud
    req.body = {
      fullname: "User Test",
      // email y current_password no se enviaron
    };
    // Ejecutamos la prueba
    await signUp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "All required fields: fullname, email and password",
    });
  });

  //* Prueba 2: Formato de correo electrónico inválido
  test("Should return error for invalid email format", async () => {
    req.body = {
      fullname: "User Test",
      email: "test.com",
      current_password: "test123",
    };
    await signUp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid email format" });
  });

  //* Prueba 3: Longitud de la contraseña
  test("Should return error for length password", async () => {
    req.body = {
      fullname: "User Test",
      email: "test@test.com",
      current_password: "test1",
    };
    await signUp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Password must be at least 6 characters long",
    });
  });

  //* Prueba 4: Correo electrónico ya registrado
  test("Should return error if email already exists", async () => {
    req.body = {
      fullname: "User Test",
      email: "test1@test.com",
      current_password: "test123",
    };

    // Configuramos el comportamiento del mock, simula que encuentra un usuario con el correo electrónico
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test1@test.com",
    });

    await signUp(req, res);

    // Verificamos que se llamó al método findUnique con el correo electrónico
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test1@test.com" },
    });
    // Verificamos que se envió la respuesta con el mensaje de error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email already registered",
    });
  });

  //* Prueba 5: Crear usuario con éxito
  test("Should create a user successfully and send verification email", async () => {
    req.body = {
      fullname: "User Test",
      email: "test@test.com",
      current_password: "test123",
    };

    // Se simula que no se encuentra el usuario
    mockFindUnique.mockResolvedValue(null);

    // Se simula el hash de la contraseña
    const hashedPassword = "hashed_password";
    bcrypt.hash.mockResolvedValue(hashedPassword);

    // Se simula la creación del usuario
    const createdUser = {
      id: 1,
      fullname: "User Test",
      email: "test@test.com",
    };
    mockCreate.mockResolvedValue(createdUser);

    await signUp(req, res);

    // Verificamos que se llamó a los métodos con los argumentos correctos
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
    // Verificamos que se llamó a la función hash con la contraseña y el número de rondas
    expect(bcrypt.hash).toHaveBeenCalledWith("test123", 10);
    // Verificamos que se llamó a la función create con los datos del usuario
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        fullname: "User Test",
        email: "test@test.com",
        current_password: hashedPassword,
        status: "PENDING",
        verificationCode: expect.any(String), // Verificamos que se genera un código de verificación
        verificationCodeExpires: expect.any(Date), // Verificamos que se genera una fecha de expiración
      },
    });
    // Verificamos que se envió el correo electrónico con el código de verificación
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        subject: "Código de verificación para tu cuenta",
        html: expect.stringContaining("User Test"),
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "User registered successfully. Please check your email for verification code.",
      userId: 1,
      email: "test@test.com",
    });
  });
});

// Pruebas de la función signIn
describe("SignIn Controller Method", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  //* Prueba 1: Todos los campos requeridos
  test("Should return error when email and password are not provided", async () => {
    req.body = {};

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Both fields are required",
    });
  });

  //* Prueba 2: Formato de correo electrónico inválido
  test("Should return error when email is invalid", async () => {
    req.body = {
      email: "invalidEmail",
      current_password: "password123",
    };

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid email format",
    });
  });

  //* Prueba 3: Usuario no encontrado
  test("Should return error when user is not found", async () => {
    req.body = {
      email: "notfound@test.com",
      current_password: "password123",
    };

    // Simulamos que no se encuentra el usuario
    mockFindUnique.mockResolvedValue(null);

    await signIn(req, res);
    // Verificamos que se llamó al método findUnique con el correo electrónico
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "notfound@test.com" },
    });
    // Verificamos que se envió la respuesta con el mensaje de error
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not found",
    });
  });

  //* Prueba 4: Contraseña incorrecta
  test("Should return error when password doesn't match", async () => {
    req.body = {
      email: "test@test.com",
      current_password: "wrongpassword",
    };

    // Simulamos que se encuentra el usuario
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      current_password: "hashedCorrectPassword",
    });

    // Simulamos que la contraseña no coincide
    bcrypt.compare.mockResolvedValue(false);

    await signIn(req, res);

    // Verificamos que se llamó al método findUnique con el correo electrónico
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
    // Verificamos que se llamó a la función compare con la contraseña correcta y la contraseña proporcionada
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "wrongpassword",
      "hashedCorrectPassword"
    );
    // Verificamos que se envió la respuesta con el mensaje de error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Password doesn't match",
    });
  });

  //* Prueba 5: Iniciar sesión con éxito
  test("Should sign in user successfully and return token", async () => {
    const mockUserId = 1;
    req.body = {
      email: "test@test.com",
      current_password: "correctpassword",
    };

    // Simulamos que se encuentra el usuario
    mockFindUnique.mockResolvedValue({
      id: mockUserId,
      email: "test@test.com",
      current_password: "hashedCorrectPassword",
    });

    // Simulamos que la contraseña coincide
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

    // Simulamos el entorno para JWT
    process.env.JWT_SECRET = "test_secret";

    await signIn(req, res);

    // Verificamos que se llamó a los métodos con los argumentos correctos
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
    // Verificamos que se llamó a la función compare con la contraseña correcta y la contraseña proporcionada
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "correctpassword",
      "hashedCorrectPassword"
    );
    // Verificamos que se llamó a la función sign con el ID del usuario, el secreto y el tiempo de exp
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: mockUserId },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    // Verificamos que se envió la respuesta con el mensaje de éxito y el token
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Login successfull",
      token: "test_token",
    });
  });

  //* Prueba 6: Error del servidor durante el inicio de sesión
  test("Should handle server error during sign in", async () => {
    req.body = {
      email: "test@test.com",
      current_password: "password123",
    };

    // Simulamos un error al consultar en la base de datos
    mockFindUnique.mockRejectedValue(new Error("Database error"));

    await signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Login failed",
    });
  });
});

// Prueba de la función verifyCode
describe("VerifyCode Controller Method", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  //* Prueba 1: Verificar código y devolver token
  test("Should verify code successfully and return token", async () => {
    req.body = {
      email: "test@test.com",
      code: "123456",
    };

    // Simulamos que se encuentra el usuario
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      status: "PENDING",
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000), // Código válido
    });

    mockUpdate.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      status: "ACTIVE",
      verificationCode: null,
      verificationCodeExpires: null,
    });

    jwt.sign.mockReturnValue("test_token");

    await verifyCode(req, res);

    // Simulamos que se llama la funcion buscar usuario con el correo
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });

    // Simulaos que se genera el token
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 1 },
      expect.any(String), // Usamos `expect.any(String)` porque `process.env.JWT_SECRET` puede cambiar
      { expiresIn: "2h" }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Account verified successfully",
      token: "test_token",
    });
  });

  //* Prueba 2: Código de verificación inválido
  test("Should return error if code is invalid", async () => {
    req.body = {
      email: "test@test.com",
      code: "wrongcode",
    };

    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      status: "PENDING",
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    await verifyCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    // Simulamos que está incorrecto el código
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid verification code",
    });
  });

  //* Prueba 3: Código de verificación expirado
  test("Should return error if verification code has expired", async () => {
    req.body = {
      email: "test@test.com",
      code: "123456",
    };

    // Simulamos que se encuentra el usuario, pero el código ya expiró
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      status: "PENDING",
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() - 1 * 60 * 1000), // Código expirado (1 minuto en el pasado)
    });

    await verifyCode(req, res);

    // Verificamos que se llamó al método findUnique con el correo proporcionado
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });

    // Verificamos que se devolvió el estado 400 y el mensaje de error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Verification code has expired. Please request a new one.",
    });
  });

  //* Prueba 4: Usuario ya verificado o activo
  test("Should return error if user is already verified", async () => {
    req.body = {
      email: "test@test.com",
      code: "123456",
    };

    // Simulamos que se encuentra el usuario con estado "ACTIVE"
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      status: "ACTIVE", // Usuario ya verificado
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000), // Código válido
    });

    await verifyCode(req, res);

    // Verificamos que se llamó al método findUnique con el correo proporcionado
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });

    // Verificamos que se devolvió el estado 400 y el mensaje de error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "User is already verified",
    });
  });

  //* Prueba 5: Campos requeridos
  test("Should return error if email or code is not provided", async () => {
    req.body = {
      email: "", // Campo vacío
      code: "", // Campo vacío
    };

    await verifyCode(req, res);

    // Verificamos que se devolvió el estado 400 y el mensaje de error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email and verification code are required",
    });
  });

  //* Prueba 6: Usuario no encontrado
  test("Should return error if user is not found", async () => {
    req.body = {
      email: "notfound@test.com",
      code: "123456",
    };

    // Simulamos que no se encuentra el usuario
    mockFindUnique.mockResolvedValue(null);

    await verifyCode(req, res);

    // Verificamos que se llamó al método findUnique con el correo proporcionado
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "notfound@test.com" },
    });

    // Verificamos que se devolvió el estado 404 y el mensaje de error
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not found",
    });
  });

  //* Prueba 7: Error del servidor al verificar el código
  test("Should handle server error during verification", async () => {
    req.body = {
      email: "test@test.com",
      code: "123456",
    };

    // Simulamos un error al consultar en la base de datos
    mockFindUnique.mockRejectedValue(new Error("Database error"));

    await verifyCode(req, res);

    // Verificamos que se devolvió el estado 500 y el mensaje de error
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Verification failed",
      error: "Database error",
    });
  });
});

describe("ResendVerificationCode Controller Method", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  test("Should resend verification code successfully", async () => {
    req.body = {
      email: "test@test.com",
    };
  
    // Simulamos que se encuentra el usuario
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "PENDING",
    });
  
    // Simulamos la actualización del usuario
    mockUpdate.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "PENDING",
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    });
  
    // Simulamos el envío del correo
    const sendMailMock = jest.fn().mockResolvedValue({ response: "Email sent" });
    nodemailer.createTransport.mockReturnValue({
      sendMail: sendMailMock,
    });
  
    await resendVerificationCode(req, res);
  
    // Verificamos que se llamó a mockFindUnique con los argumentos correctos
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
  
    // Verificamos que se llamó a mockUpdate para actualizar el código de verificación
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        verificationCode: expect.any(String),
        verificationCodeExpires: expect.any(Date),
      },
    });
  
    // Verificamos que se llamó a nodemailer.createTransport y sendMail
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        subject: "Verification Code",
        html: expect.stringContaining("User Test"),
      })
    );
  
    // Verificamos que se devolvió el estado 200 y el mensaje
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Verification code sent successfully. Please check your email.",
    });
  });

  test("Should return error if user is already verified", async () => {
    req.body = {
      email: "test@test.com",
    };

    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "ACTIVE",
    });

    await resendVerificationCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "User is already verified",
    });
  });

  test("Should return error if email is not provided", async () => {
    req.body = {};

    await resendVerificationCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email is required",
    });
  });

  test("Should return error if user is not found", async () => {
    req.body = {
      email: "notfound@test.com",
    };

    // Simulamos que no se encuentra el usuario
    mockFindUnique.mockResolvedValue(null);

    await resendVerificationCode(req, res);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "notfound@test.com" },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not found",
    });
  });

  test("Should return error if user is already verified", async () => {
    req.body = {
      email: "test@test.com",
    };

    // Simulamos que el usuario ya está verificado
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "ACTIVE",
    });

    await resendVerificationCode(req, res);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "User is already verified",
    });
  });

  test("Should return error if email sending fails", async () => {
    req.body = {
      email: "test@test.com",
    };

    // Simulamos que se encuentra el usuario
    mockFindUnique.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "PENDING",
    });

    // Simulamos la actualización del usuario
    mockUpdate.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      fullname: "User Test",
      status: "PENDING",
      verificationCode: "123456",
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Simulamos un fallo al enviar el correo
    const sendMailMock = jest.fn().mockResolvedValue(false);
    nodemailer.createTransport.mockReturnValue({
      sendMail: sendMailMock,
    });

    await resendVerificationCode(req, res);

    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to send verification email. Please try again later.",
    });
  });
});
