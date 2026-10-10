"use strict";

/**
 * Sends an HTTP request to the Django backend.
 * Includes CSRF protection and same-origin credentials.
 */
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

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof data === "object" && data !== null
            ? (
                data.error?.message ||
                data.detail ||
                Object.entries(data)
                    .map(([key, value]) =>
                        `${key}: ${Array.isArray(value)
                            ? value.join(", ")
                            : typeof value === "object"
                                ? JSON.stringify(value)
                                : value}`
                    )
                    .join(" | ")
            )
            : data;

        const error = new Error(
            message || `Request failed (${response.status})`
        );
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}

function apiGet(url) {
    return apiRequest(url, { method: "GET" });
}

function apiPost(url, body = {}) {
    return apiRequest(url, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function apiPatch(url, body = {}) {
    return apiRequest(url, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

function apiPut(url, body = {}) {
    return apiRequest(url, {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function apiDelete(url) {
    return apiRequest(url, { method: "DELETE" });
}

window.API = {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    put: apiPut,
    delete: apiDelete,
};

console.log("SurplusLink API helper loaded successfully.");
