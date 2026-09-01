import validateSuggestion from "./generated/validate-suggestion.mjs";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function jsonResponse(payload, status = 200, additionalHeaders = {}) {
  const headers = new Headers(additionalHeaders);

  headers.set("Content-Type", JSON_CONTENT_TYPE);

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers,
  });
}

function formatValidationErrors(errors = []) {
  return errors.map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  }));
}

async function persistSuggestion(env, suggestion) {
  const id = crypto.randomUUID();
  const submittedAt = new Date().toISOString();

  const storedRecord = {
    recordVersion: 2,
    id,
    status: "open",
    submittedAt,
    suggestion,
    delivery: {
      status: "not-requested",
    },
  };

  const result = await env.DB
    .prepare(`
      INSERT INTO suggestions (
        id,
        record_version,
        schema_version,
        moderation_status,
        submitted_at,
        suggestion_json,
        delivery_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      storedRecord.id,
      storedRecord.recordVersion,
      suggestion.schemaVersion,
      storedRecord.status,
      storedRecord.submittedAt,
      JSON.stringify(storedRecord.suggestion),
      storedRecord.delivery.status,
      storedRecord.submittedAt,
      storedRecord.submittedAt,
    )
    .run();

  if (!result.success) {
    throw new Error("D1 did not confirm the suggestion insertion.");
  }

  return storedRecord;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        service: "architectural-geometry-suggestions",
        environment: env.ENVIRONMENT,
        storage: "d1",
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/suggestions"
    ) {
      const contentType = request.headers.get("Content-Type") ?? "";

      if (!contentType.toLowerCase().startsWith("application/json")) {
        return jsonResponse(
          {
            error: "unsupported_media_type",
            message: "The request body must use application/json.",
          },
          415,
        );
      }

      let suggestion;

      try {
        suggestion = await request.json();
      } catch {
        return jsonResponse(
          {
            error: "invalid_json",
            message: "The request body is not valid JSON.",
          },
          400,
        );
      }

      const suggestionIsValid = validateSuggestion(suggestion);

      if (!suggestionIsValid) {
        return jsonResponse(
          {
            error: "invalid_suggestion",
            message: "The suggestion does not satisfy the content schema.",
            details: formatValidationErrors(validateSuggestion.errors),
          },
          422,
        );
      }

      try {
        const storedRecord = await persistSuggestion(env, suggestion);

        return jsonResponse(
          {
            persisted: true,
            id: storedRecord.id,
            status: storedRecord.status,
            submittedAt: storedRecord.submittedAt,
            delivery: storedRecord.delivery,
          },
          201,
        );
      } catch (error) {
        console.error("Unable to persist the suggestion in D1.", error);

        return jsonResponse(
          {
            error: "storage_failure",
            message: "The suggestion could not be stored.",
          },
          500,
        );
      }
    }

    if (url.pathname === "/api/suggestions") {
      return jsonResponse(
        {
          error: "method_not_allowed",
          message: "This endpoint only accepts POST requests.",
        },
        405,
        {
          Allow: "POST",
        },
      );
    }

    return jsonResponse(
      {
        error: "not_found",
        message: "The requested endpoint does not exist.",
      },
      404,
    );
  },
};