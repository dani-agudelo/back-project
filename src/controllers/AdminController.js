/**
 * Lógica de negocio para el controlador AdminController
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const csv = require("csv-parser");
const { Readable } = require("stream");
const iconv = require("iconv-lite");
const fs = require("fs");
const path = require("path");

const getDashboard = async (req, res) => {
  try {
    res.status(200).json({ message: "Welcome to the SUPERADMIN dashboard." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load dashboard.", error: error.message });
  }
};

/**
 * Procesa el archivo CSV subido por el usuario.
 *
 */
const processCsv = async (req, res) => {
  console.log("📥 Archivo recibido:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const decodedBuffer = iconv.decode(req.file.buffer, "latin1");
    const stream = Readable.from(decodedBuffer);

    const departmentsMap = new Map();
    const citiesDataRaw = [];
    const logs = []; // Array para almacenar los logs

    stream
      .pipe(csv())
      .on("data", (row) => {
        const normalizedRow = Object.keys(row).reduce((acc, key) => {
          acc[key.toLowerCase()] = row[key];
          return acc;
        }, {});

        const department =
          normalizedRow["departamento"] || normalizedRow["department"];
        const city = normalizedRow["municipio"] || normalizedRow["city"];

        if (department && city) {
          if (!departmentsMap.has(department)) {
            departmentsMap.set(department, { name: department });
          }

          citiesDataRaw.push({ name: city, department });
        }
      })
      .on("end", async () => {
        try {
          console.log("🧠 Verificando y procesando departamentos...");
          const departments = Array.from(departmentsMap.values());
          const existingDepartments = await prisma.departments.findMany({
            where: {
              name: { in: departments.map((dept) => dept.name) },
            },
          });

          const existingDepartmentNames = new Set(
            existingDepartments.map((dept) => dept.name)
          );

          const missingDepartments = departments.filter(
            (dept) => !existingDepartmentNames.has(dept.name)
          );

          for (const dept of missingDepartments) {
            await prisma.departments.create({
              data: { name: dept.name },
            });
            logs.push({
              action: "create",
              entity: "department",
              message: `Department '${dept.name}' created successfully.`,
            });
          }

          logs.push(
            ...existingDepartments.map((dept) => ({
              action: "exists",
              entity: "department",
              message: `Department '${dept.name}' already exists.`,
            }))
          );

          console.log("🔍 Verificando ciudades...");
          const allDepartments = await prisma.departments.findMany();
          const departmentIdMap = new Map();
          allDepartments.forEach((dept) => {
            departmentIdMap.set(dept.name, dept.id);
          });

          const citiesData = citiesDataRaw
            .map((city) => {
              const departmentId = departmentIdMap.get(city.department);
              if (departmentId) {
                return {
                  name: city.name,
                  departmentId,
                };
              }
              logs.push({
                action: "error",
                entity: "city",
                message: `City '${city.name}' could not be created because department '${city.department}' does not exist.`,
              });
              return null;
            })
            .filter(Boolean);

          const existingCities = await prisma.cities.findMany({
            where: {
              name: { in: citiesData.map((city) => city.name) },
            },
          });

          const existingCityNames = new Set(
            existingCities.map((city) => city.name)
          );

          const missingCities = citiesData.filter(
            (city) => !existingCityNames.has(city.name)
          );

          for (const city of missingCities) {
            await prisma.cities.create({
              data: city,
            });
            logs.push({
              action: "create",
              entity: "city",
              message: `City '${city.name}' created successfully.`,
            });
          }

          logs.push(
            ...existingCities.map((city) => ({
              action: "exists",
              entity: "city",
              message: `City '${city.name}' already exists.`,
            }))
          );

          // Guardar los logs en la base de datos
          await prisma.logs.createMany({ data: logs });

          res.status(200).json({
            message: "CSV processed successfully",
            logs,
            missingDepartments: missingDepartments.map((dept) => dept.name),
            missingCities: missingCities.map((city) => city.name),
          });
        } catch (error) {
          console.error("❌ Error al guardar datos:", error);
          res
            .status(500)
            .json({ message: "Failed to save data", error: error.message });
        }
      });
  } catch (error) {
    console.error("❌ Error al procesar CSV:", error);
    res
      .status(500)
      .json({ message: "Error processing CSV", error: error.message });
  }
};

const validateCsv = async (req, res) => {
  try {
    const goodCsvPath = path.join(
      __dirname,
      "../../data/departamentos_ciudades.csv"
    );

    if (!fs.existsSync(goodCsvPath)) {
      return res.status(500).json({ message: "Good CSV file not found" });
    }

    const goodDepartmentsMap = new Map();
    const goodCitiesData = [];

    // Leer y decodificar el archivo CSV "bueno" con latin1
    const fileBuffer = fs.readFileSync(goodCsvPath);
    const decodedBuffer = iconv.decode(fileBuffer, "latin1");
    const stream = Readable.from(decodedBuffer);

    stream
      .pipe(csv())
      .on("data", (row) => {
        const normalizedRow = Object.keys(row).reduce((acc, key) => {
          acc[key.toLowerCase()] = row[key];
          return acc;
        }, {});

        const department =
          normalizedRow["departamento"] || normalizedRow["department"];
        const city = normalizedRow["municipio"] || normalizedRow["city"];

        if (department && city) {
          if (!goodDepartmentsMap.has(department)) {
            goodDepartmentsMap.set(department, { name: department });
          }

          goodCitiesData.push({ name: city, department });
        }
      })
      .on("end", async () => {
        try {
          const allDepartments = await prisma.departments.findMany();
          const allCities = await prisma.cities.findMany();

          const existingDepartmentNames = new Set(
            allDepartments.map((dept) => dept.name)
          );
          const existingCityNames = new Set(allCities.map((city) => city.name));

          const missingDepartments = Array.from(
            goodDepartmentsMap.values()
          ).filter((dept) => !existingDepartmentNames.has(dept.name));

          const missingCities = goodCitiesData.filter(
            (city) => !existingCityNames.has(city.name)
          );

          res.status(200).json({
            message: "Validation completed",
            missingDepartments: missingDepartments.map((dept) => dept.name),
            missingCities: missingCities.map((city) => city.name),
          });
        } catch (error) {
          console.error("❌ Error al validar datos:", error);
          res
            .status(500)
            .json({ message: "Failed to validate data", error: error.message });
        }
      });
  } catch (error) {
    console.error("❌ Error al procesar CSV:", error);
    res
      .status(500)
      .json({ message: "Error validating CSV", error: error.message });
  }
};

/**
 * Obtiene las ciudades y departamentos de la base de datos.
 * Permite paginación de los resultados.
 */
const getCitiesAndDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query; // Parámetros de paginación (valores predeterminados: página 1, 10 elementos por página)

    const skip = (page - 1) * limit; // Calcular cuántos registros omitir
    const take = parseInt(limit); // Número de registros a devolver

    // Obtener ciudades con sus departamentos
    const cities = await prisma.cities.findMany({
      skip,
      take,
      include: {
        department: true, // Incluir información del departamento relacionado
      },
    });

    // Contar el total de ciudades para calcular el número total de páginas
    const totalCities = await prisma.cities.count();
    const totalPages = Math.ceil(totalCities / limit);

    res.status(200).json({
      message: "Cities and departments retrieved successfully",
      data: cities,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCities,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving cities and departments:", error);
    res.status(500).json({
      message: "Failed to retrieve cities and departments",
      error: error.message,
    });
  }
};

/**
 * Obtiene los logs de la base de datos.
 *
 */
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const logs = await prisma.logs.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });

    const totalLogs = await prisma.logs.count();
    const totalPages = Math.ceil(totalLogs / limit);

    res.status(200).json({
      message: "Logs retrieved successfully",
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalLogs,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving logs:", error);
    res.status(500).json({
      message: "Failed to retrieve logs",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboard,
  processCsv,
  validateCsv,
  getCitiesAndDepartments,
  getLogs,
};
