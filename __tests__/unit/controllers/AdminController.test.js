jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock de PrismaClient
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockCreateMany = jest.fn();
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    departments: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    cities: {
      findMany: mockFindMany,
      create: mockCreate,
    }
  })),
}));

const fs = require("fs");
const iconv = require("iconv-lite");
const { Readable } = require("stream");
const {
  processCsv,
  validateCsv,
  getCitiesAndDepartments,
} = require("../../../src/controllers/AdminController");

// Mock para omitir console.log
jest.spyOn(console, "log").mockImplementation(() => {});

describe("AdminController Tests", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      file: null,
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  // Pruebas para processCsv
  describe("processCsv", () => {
    test("Should return error if no file is uploaded", async () => {
      await processCsv(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
    });

    test("Should process CSV and create missing departments and cities", async () => {
      req.file = {
        buffer: Buffer.from(
          "departamento,municipio\nAntioquia,Medellín\nCundinamarca,Bogotá",
          "latin1"
        ),
      };

      // Simular que no hay departamentos ni ciudades existentes
      mockFindMany.mockResolvedValueOnce([]); // Departamentos existentes
      mockFindMany.mockResolvedValueOnce([]); // Ciudades existentes

      // Simular creación de departamentos
      mockCreate.mockResolvedValueOnce({ id: 1, name: "Antioquia" });
      mockCreate.mockResolvedValueOnce({ id: 2, name: "Cundinamarca" });

      // Simular creación de ciudades
      mockCreate.mockResolvedValueOnce({
        id: 1,
        name: "Medellín",
        departmentId: 1,
      });
      mockCreate.mockResolvedValueOnce({
        id: 2,
        name: "Bogotá",
        departmentId: 2,
      });

      await processCsv(req, res);

      expect(mockCreate).toHaveBeenCalledWith({ data: { name: "Antioquia" } });
      expect(mockCreate).toHaveBeenCalledWith({
        data: { name: "Cundinamarca" },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: { name: "Medellín", departmentId: 1 },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: { name: "Bogotá", departmentId: 2 },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "CSV processed successfully",
        })
      );
    });
  });

  // Pruebas para validateCsv
  describe("validateCsv", () => {
    test("Should return error if good CSV file is not found", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(false);

      await validateCsv(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Good CSV file not found",
      });
    });

    test("Should validate CSV and return missing departments and cities", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(
          Buffer.from(
            "departamento,municipio\nAntioquia,Medellín\nCundinamarca,Bogotá",
            "latin1"
          )
        );

      // Simular departamentos y ciudades existentes
      mockFindMany.mockResolvedValueOnce([{ name: "Antioquia" }]); // Departamentos existentes
      mockFindMany.mockResolvedValueOnce([{ name: "Medellín" }]); // Ciudades existentes

      await validateCsv(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Validation completed",
        missingDepartments: ["Cundinamarca"],
        missingCities: ["Bogotá"],
      });
    });
  });

  // Pruebas para getCitiesAndDepartments
  describe("getCitiesAndDepartments", () => {
    test("Should return paginated cities and departments", async () => {
        req.query = { page: 1, limit: 2 };
      
        // Simular ciudades con sus departamentos
        mockFindMany.mockResolvedValue([
          { name: "Medellín", department: { name: "Antioquia" } },
          { name: "Bogotá", department: { name: "Cundinamarca" } },
        ]);
      
        // Simular el total de ciudades
        mockFindMany.mockResolvedValueOnce(2);
      
        await getCitiesAndDepartments(req, res);
      
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: "Cities and departments retrieved successfully",
          data: [
            { name: "Medellín", department: { name: "Antioquia" } },
            { name: "Bogotá", department: { name: "Cundinamarca" } },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCities: 2,
            limit: 2,
          },
        });
      });
});
})