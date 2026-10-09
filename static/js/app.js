
async function apiRequest(url, options = {}) {
    const csrfToken = document.querySelector(
        "[name=csrfmiddlewaretoken]"
    )?.value;

    const headers = {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin",
    });

    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof data === "object"
            ? Object.entries(data)
                .map(([key, value]) =>
                    `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
                )
                .join(" | ")
            : data;

        throw new Error(message || `Request failed (${response.status})`);
    }

    return data;
}
