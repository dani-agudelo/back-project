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

/**
 * Procesa el archivo CSV subido por el usuario.
 *
 */
const processCsv = async (req, res) => {
  console.log("Archivo recibido:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const decodedBuffer = iconv.decode(req.file.buffer, "latin1");
    const stream = Readable.from(decodedBuffer);

    const departmentsMap = new Map();
    const citiesDataRaw = [];

    // Leer y procesar el archivo CSV
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
          // Obtener todos los departamentos y ciudades existentes en una sola consulta
          const [existingDepartments, existingCities] = await Promise.all([
            prisma.departments.findMany(),
            prisma.cities.findMany(),
          ]);

          // Crear mapas para búsquedas rápidas
          const existingDepartmentNames = new Set(
            existingDepartments.map((dept) => dept.name)
          );
          const existingCityNames = new Set(
            existingCities.map((city) => city.name)
          );

          // Identificar departamentos faltantes
          const missingDepartments = [];
          for (const [name, department] of departmentsMap.entries()) {
            if (!existingDepartmentNames.has(name)) {
              missingDepartments.push(department);
            }
          }

          // Insertar departamentos faltantes en una sola operación
          if (missingDepartments.length > 0) {
            await prisma.departments.createMany({
              data: missingDepartments,
              skipDuplicates: true, // Evitar duplicados
            });
          }

          // Actualizar el mapa de departamentos con IDs
          const allDepartments = await prisma.departments.findMany();
          const departmentIdMap = new Map(
            allDepartments.map((dept) => [dept.name, dept.id])
          );

          // Identificar ciudades faltantes
          const missingCities = [];
          for (const city of citiesDataRaw) {
            const departmentId = departmentIdMap.get(city.department);
            if (departmentId && !existingCityNames.has(city.name)) {
              missingCities.push({
                name: city.name,
                departmentId,
              });
            }
          }

          // Insertar ciudades faltantes en una sola operación
          if (missingCities.length > 0) {
            await prisma.cities.createMany({
              data: missingCities,
              skipDuplicates: true, // Evitar duplicados
            });
          }

          // Responder con los resultados
          res.status(200).json({
            message: "CSV processed successfully",
            missingDepartments: missingDepartments.map((dept) => dept.name),
            missingCities: missingCities.map((city) => city.name),
          });
        } catch (error) {
          console.error("Error al guardar datos:", error);
          res
            .status(500)
            .json({ message: "Failed to save data", error: error.message });
        }
      });
  } catch (error) {
    console.error("Error al procesar CSV:", error);
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
          console.error(" Error al validar datos:", error);
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
    const { page = 1, limit = 10 } = req.query; 

    const skip = (page - 1) * limit;
    const take = parseInt(limit); 

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
    res.status(500).json({
      message: "Failed to retrieve cities and departments",
      error: error.message,
    });
  }
};

module.exports = {
  processCsv,
  validateCsv,
  getCitiesAndDepartments,
};
