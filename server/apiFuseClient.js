const APIFUSE_BASE_URL = process.env.APIFUSE_BASE_URL || "https://api.apifuse.com";

export function hasApiFuseKey() {
  return Boolean(process.env.APIFUSE_API_KEY);
}

export async function callApiFuse(providerId, operationId, payload) {
  if (!process.env.APIFUSE_API_KEY) {
    throw new Error("APIFUSE_API_KEY is not configured");
  }
  if (!providerId || !operationId) {
    throw new Error("ApiFuse providerId and operationId are required");
  }

  const response = await fetch(`${APIFUSE_BASE_URL}/v1/${providerId}/${operationId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.APIFUSE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload || {})
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ApiFuse ${providerId}/${operationId} failed with ${response.status}: ${body.slice(0, 180)}`);
  }

  return response.json();
}

