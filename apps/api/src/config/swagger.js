import swaggerJsdoc from "swagger-jsdoc";

const definition = {
  openapi: "3.0.3",
  info: {
    title: "Event QR Check-in API",
    version: "1.0.0",
    description:
      "Full-stack event management and QR check-in system. Admins create events, register attendees, generate QR tickets, and validate them at the venue."
  },
  servers: [{ url: "http://localhost:4000", description: "Local development" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      UserPublic: {
        type: "object",
        properties: {
          id: { type: "string", example: "663a1f..." },
          name: { type: "string", example: "Alice Admin" },
          email: { type: "string", format: "email", example: "alice@example.com" },
          role: { type: "string", enum: ["admin", "staff"] }
        }
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT Bearer token" },
          user: { $ref: "#/components/schemas/UserPublic" }
        }
      },
      Event: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string", example: "Tech Summit 2026" },
          date: { type: "string", format: "date-time" },
          location: { type: "string", example: "Convention Centre, Mumbai" },
          description: { type: "string" },
          publicSlug: { type: "string", example: "tech-summit-2026-ab12cd" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Attendee: {
        type: "object",
        properties: {
          _id: { type: "string" },
          eventId: { type: "string" },
          name: { type: "string", example: "Bob Smith" },
          email: { type: "string", format: "email" },
          phoneNumber: { type: "string" },
          ticketUuid: { type: "string", format: "uuid" },
          qrCodeDataUrl: { type: "string", description: "Base64-encoded PNG data URL of QR code" },
          isCheckedIn: { type: "boolean" },
          checkedInAt: { type: "string", format: "date-time", nullable: true }
        }
      },
      EventStats: {
        type: "object",
        properties: {
          totalRegistrations: { type: "integer" },
          checkedIn: { type: "integer" },
          pending: { type: "integer" },
          recentLogs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                attendeeId: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" }
                  }
                },
                timestamp: { type: "string", format: "date-time" },
                gateNumber: { type: "string" }
              }
            }
          }
        }
      },
      ScanResult: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["granted", "already_checked_in", "invalid"]
          },
          message: { type: "string" },
          checkedInAt: { type: "string", format: "date-time", nullable: true },
          attendee: { $ref: "#/components/schemas/Attendee" }
        }
      },
      BulkUploadResult: {
        type: "object",
        properties: {
          totalRows: { type: "integer" },
          created: { type: "integer" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string" },
                reason: { type: "string" }
              }
            }
          }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" }
        }
      }
    }
  }
};

const options = {
  definition,
  apis: ["./src/routes/*.js"]
};

export const swaggerSpec = swaggerJsdoc(options);

