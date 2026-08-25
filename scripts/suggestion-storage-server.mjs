// Import Node's built-in HTTP server.
//
// No web framework is required for this first local prototype: keeping the
// server small makes each request and each security decision visible.
import { createServer } from "node:http";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Ajv validates incoming data against JSON Schema draft 2020-12.
import Ajv2020 from "ajv/dist/2020.js";

/* ========================================================================== */
/* SERVER CONFIGURATION                                                       */
/* ========================================================================== */

// Bind only to the current computer. The development storage server must not
// become accessible to other machines on the local network.
const serverHost = "127.0.0.1";

// A future environment variable can override the port without changing code.
const requestedPort = Number.parseInt(
  process.env.SUGGESTION_STORAGE_PORT ?? "8787",
  10,
);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
  throw new Error(
    "SUGGESTION_STORAGE_PORT must be an integer between 1 and 65535.",
  );
}

const serverPort = requestedPort;

// Refuse unexpectedly large submissions before they consume excessive memory.
const maximumRequestBodyBytes = 64 * 1024;

/* ========================================================================== */
/* PROJECT PATHS AND SCHEMA                                                   */
/* ========================================================================== */

const scriptFile = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptFile);
const repositoryRoot = path.resolve(scriptDirectory, "..");
const suggestionSchemaPath = path.join(
  repositoryRoot,
  "prototype",
  "suggest-edit",
  "content-suggestion.schema.json",
);
const suggestionStorageDirectory = path.join(
  repositoryRoot,
  ".local-data",
  "suggestions",
);

const suggestionSchemaText = await readFile(suggestionSchemaPath, "utf8");
const suggestionSchema = JSON.parse(suggestionSchemaText);

const ajv = new Ajv2020({
  allErrors: true,
});

const validateSuggestion = ajv.compile(suggestionSchema);

/* ========================================================================== */
/* RESPONSE UTILITIES                                                         */
/* ========================================================================== */

function isAllowedDevelopmentOrigin(origin) {
  if (!origin) {
    return false;
  }

  // Jupyter Book generally starts on port 3000, but may select another local
  // port when it is already occupied. Only local HTTP origins are accepted.
  return /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;

  if (isAllowedDevelopmentOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type",
  );
}

function sendJson(response, statusCode, payload) {
  const responseBody = `${JSON.stringify(payload, null, 2)}\n`;

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(responseBody),
    "Cache-Control": "no-store",
  });

  response.end(responseBody);
}

class RequestError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function assertJsonContentType(request) {
  const contentType = request.headers["content-type"] ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new RequestError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number.parseInt(
      request.headers["content-length"] ?? "0",
      10,
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumRequestBodyBytes
    ) {
      request.resume();
      reject(
        new RequestError(
          413,
          "payload_too_large",
          `The request body must not exceed ${maximumRequestBodyBytes} bytes.`,
        ),
      );
      return;
    }

    const bodyChunks = [];
    let receivedBytes = 0;
    let bodyIsTooLarge = false;

    request.on("data", (chunk) => {
      receivedBytes += chunk.length;

      if (receivedBytes > maximumRequestBodyBytes) {
        bodyIsTooLarge = true;
        bodyChunks.length = 0;
        return;
      }

      if (!bodyIsTooLarge) {
        bodyChunks.push(chunk);
      }
    });

    request.on("end", () => {
      if (bodyIsTooLarge) {
        reject(
          new RequestError(
            413,
            "payload_too_large",
            `The request body must not exceed ${maximumRequestBodyBytes} bytes.`,
          ),
        );
        return;
      }

      resolve(Buffer.concat(bodyChunks).toString("utf8"));
    });

    request.on("error", () => {
      reject(
        new RequestError(
          400,
          "request_read_error",
          "The request body could not be read.",
        ),
      );
    });
  });
}

async function readJsonRequest(request) {
  assertJsonContentType(request);

  const requestBody = await readRequestBody(request);

  if (!requestBody.trim()) {
    throw new RequestError(
      400,
      "empty_request_body",
      "The request body must contain a JSON suggestion.",
    );
  }

  try {
    return JSON.parse(requestBody);
  } catch {
    throw new RequestError(
      400,
      "invalid_json",
      "The request body is not valid JSON.",
    );
  }
}

function formatValidationErrors(validationErrors = []) {
  return validationErrors.map((validationError) => ({
    path: validationError.instancePath || "/",
    keyword: validationError.keyword,
    message: validationError.message ?? "The value is invalid.",
  }));
}

/* ========================================================================== */
/* LOCAL PERSISTENCE                                                          */
/* ========================================================================== */

async function persistSuggestion(suggestion) {
  // These values are assigned by the server. The browser cannot choose an ID,
  // forge the submission time or decide the moderation status.
  const suggestionId = randomUUID();
  const submittedAt = new Date().toISOString();

  const storedRecord = {
    recordVersion: 1,
    id: suggestionId,
    status: "open",
    submittedAt,
    suggestion,
  };

  await mkdir(suggestionStorageDirectory, {
    recursive: true,
  });

  const finalFilePath = path.join(
    suggestionStorageDirectory,
    `${suggestionId}.json`,
  );
  const temporaryFilePath = path.join(
    suggestionStorageDirectory,
    `.${suggestionId}.${process.pid}.tmp`,
  );
  const serializedRecord = `${JSON.stringify(storedRecord, null, 2)}\n`;

  try {
    // "wx" refuses to overwrite an existing temporary file. The completed
    // file only becomes visible under its final name after the write succeeds.
    await writeFile(temporaryFilePath, serializedRecord, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryFilePath, finalFilePath);
  } catch (error) {
    // Remove an incomplete temporary file without ever touching a completed
    // suggestion record.
    await rm(temporaryFilePath, {
      force: true,
    });
    throw error;
  }

  return {
    id: suggestionId,
    status: storedRecord.status,
    submittedAt,
  };
}

/* ========================================================================== */
/* REQUEST HANDLING                                                           */
/* ========================================================================== */

const server = createServer(async (request, response) => {
  applyCorsHeaders(request, response);

  // Browsers may send this preliminary request before a cross-origin POST.
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(
    request.url ?? "/",
    `http://${serverHost}:${serverPort}`,
  );

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "architectural-geometry-suggestion-storage",
      storage: "local-files",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/suggestions"
  ) {
    try {
      const suggestion = await readJsonRequest(request);
      const suggestionIsValid = validateSuggestion(suggestion);

      if (!suggestionIsValid) {
        sendJson(response, 422, {
          error: "invalid_suggestion",
          message: "The suggestion does not satisfy the content schema.",
          details: formatValidationErrors(validateSuggestion.errors),
        });
        return;
      }

      const storedSuggestion = await persistSuggestion(suggestion);

      sendJson(response, 201, {
        ...storedSuggestion,
        persisted: true,
        message: "The suggestion has been stored successfully.",
      });

      console.info(
        `[Suggestion storage] Stored ${storedSuggestion.id}.`,
      );
      return;
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.statusCode, {
          error: error.errorCode,
          message: error.message,
        });
        return;
      }

      console.error("Unexpected suggestion validation error.", error);
      sendJson(response, 500, {
        error: "internal_server_error",
        message: "The suggestion could not be processed.",
      });
      return;
    }
  }

  if (requestUrl.pathname === "/api/suggestions") {
    response.setHeader("Allow", "POST, OPTIONS");
    sendJson(response, 405, {
      error: "method_not_allowed",
      message: "This endpoint only accepts POST requests.",
    });
    return;
  }

  sendJson(response, 404, {
    error: "not_found",
    message: "The requested endpoint does not exist.",
  });
});

// Handle malformed connections without crashing the process.
server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

/* ========================================================================== */
/* STARTUP AND SHUTDOWN                                                       */
/* ========================================================================== */

server.listen(serverPort, serverHost, () => {
  console.log("");
  console.log("Suggestion storage server is running.");
  console.log(`Health check: http://${serverHost}:${serverPort}/health`);
  console.log(
    `Store suggestion: POST http://${serverHost}:${serverPort}/api/suggestions`,
  );
  console.log(`Storage directory: ${suggestionStorageDirectory}`);
  console.log("Press Ctrl+C to stop the server.");
  console.log("");
});

function stopServer(signal) {
  console.log("");
  console.log(`${signal} received. Stopping suggestion storage server...`);

  server.close((error) => {
    if (error) {
      console.error("Unable to stop the server cleanly.", error);
      process.exitCode = 1;
      return;
    }

    console.log("Suggestion storage server stopped.");
  });
}

process.on("SIGINT", () => stopServer("SIGINT"));
process.on("SIGTERM", () => stopServer("SIGTERM"));