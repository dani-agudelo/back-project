/**
 * Lógica de negocio para el controlador AdminController
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const csv = require("csv-parser");
const { Readable } = require("stream");
const iconv = require("iconv-lite");

const uploadFile = async (req, res) => {
  try {
    res.status(200).json({ message: "File uploaded successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to upload file.", error: error.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    res.status(200).json({ message: "Welcome to the SUPERADMIN dashboard." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load dashboard.", error: error.message });
  }
};

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
          console.log("🧠 Procesando departamentos...");
          const departments = Array.from(departmentsMap.values());

          for (const dept of departments) {
            await prisma.departments.upsert({
              where: { name: dept.name },
              update: {},
              create: { name: dept.name },
            });
          }

          console.log("🔍 Obteniendo IDs de departamentos...");
          const allDepartments = await prisma.departments.findMany();
          const departmentIdMap = new Map();
          allDepartments.forEach((dept) => {
            departmentIdMap.set(dept.name, dept.id);
          });

          console.log("🏙️ Preparando datos de ciudades...");
          const citiesData = citiesDataRaw
            .map((city) => {
              const departmentId = departmentIdMap.get(city.department);
              if (departmentId) {
                return {
                  name: city.name,
                  departmentId,
                };
              }
              return null;
            })
            .filter(Boolean); // Elimina nulos si algún departamento no se encontró

          console.log("💾 Insertando ciudades...");
          for (const city of citiesData) {
            await prisma.cities.upsert({
              where: { name: city.name },
              update: {},
              create: city,
            });
          }

          res.status(200).json({
            message: "CSV processed successfully",
            departments: departments.length,
            cities: citiesData.length,
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
    const { file, goodCsv } = req.body;
    if (!file || !goodCsv) {
      return res.status(400).json({ message: "Both files are required" });
    }

    const uploadedBuffer = Buffer.from(file, "base64");
    const goodBuffer = Buffer.from(goodCsv, "base64");

    const uploadedData = [];
    const goodData = [];

    Readable.from(uploadedBuffer.toString())
      .pipe(csv())
      .on("data", (row) => {
        uploadedData.push(row);
      })
      .on("end", () => {
        Readable.from(goodBuffer.toString())
          .pipe(csv())
          .on("data", (row) => {
            goodData.push(row);
          })
          .on("end", () => {
            const missingCities = goodData.filter(
              (goodRow) =>
                !uploadedData.some(
                  (uploadedRow) =>
                    uploadedRow.department === goodRow.department &&
                    uploadedRow.city === goodRow.city
                )
            );

            if (missingCities.length > 0) {
              return res.status(400).json({
                message: "Uploaded CSV is missing cities",
                missingCities,
              });
            }

            res.status(200).json({ message: "CSV is valid" });
          });
      });
  } catch (error) {
    console.error("Error validating CSV:", error);
    res
      .status(500)
      .json({ message: "Failed to validate CSV", error: error.message });
  }
};

module.exports = {
  uploadFile,
  getDashboard,
  processCsv,
  validateCsv,
};
