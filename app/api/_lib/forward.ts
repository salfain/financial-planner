export function jsonRequest(
  request: Request,
  pathname: string,
  payload: Record<string, unknown>,
  method = "POST",
): Request {
  const url = new URL(pathname, request.url);
  url.search = new URL(request.url).search;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });
}

export function requestWithoutBody(request: Request, pathname: string, method: string): Request {
  const url = new URL(pathname, request.url);
  url.search = new URL(request.url).search;
  return new Request(url, { method, headers: request.headers });
}
