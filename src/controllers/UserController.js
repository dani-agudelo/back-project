const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Obtiene todos los usuarios de la base de datos.
 *
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany();
    res.status(200).json(users);
  } catch (error) {
    console.log("Error getting users:", error);
    res.status(500).json({
      message: "Error getting users",
      error: error.message,
    });
  }
};

/**
 * Obtiene un usuario por su ID.
 *
 */
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({
      where: { id },
    });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    res.status(200).json(user);
  } catch (error) {
    console.log("Error getting user:", error);
    res.status(500).json({
      message: "Error getting user",
      error: error.message,
    });
  }
};  

module.exports = {
  getAllUsers,
  getUserById,
};
