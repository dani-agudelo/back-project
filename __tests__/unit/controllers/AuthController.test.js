jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Creamos mocks para las funciones de Prisma
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();

// Mock de PrismaClient
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    users: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  })),
}));

// Mock de bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock para generar el token en el momento de autenticación
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("test_token"),
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { signUp, signIn } = require("../../../src/controllers/AuthController");

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
      message: "Password must be at least 6 characteres long",
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
      message: "Email allready registered",
    });
  });

  //* Prueba 5: Crear usuario con éxito
  test("Should create a user successfully", async () => {
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
      },
    });
    // Verificamos que se envió la respuesta con el mensaje de éxito y los datos del usuario
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "User created successfull",
      user: createdUser,
    });
  });
});

// Prueba de la función signIn
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
      message: error,
    });
  });
});
