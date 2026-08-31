const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        service: "architectural-geometry-suggestions",
        environment: "staging",
      });
    }

    return jsonResponse(
      {
        status: "error",
        error: "Not found",
      },
      404,
    );
  },
};