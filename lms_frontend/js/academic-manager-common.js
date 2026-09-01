// ===============================================================
// Shared helpers for every Academic Manager page. Depends on the
// #appToast / #toastMessage markup that academic-manager-layout.js's
// shell injects on every page. Page templates should NOT include
// their own copy of this markup — a duplicate #appToast id was
// removed from the dashboard/batches pages during integration.
// ===============================================================

function showToast(message, isError = false) {
    const toastEl = document.getElementById("appToast");
    const toastMessageEl = document.getElementById("toastMessage");
    if (!toastEl || !toastMessageEl) {
        console.log(message);
        return;
    }

    toastMessageEl.textContent = message;
    toastEl.classList.toggle("text-bg-danger", isError);
    toastEl.classList.toggle("text-bg-success", !isError);

    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
}

// Extracts a readable message out of a DRF error response body,
// whether it's {"detail": "..."}, {"field": ["..."]}, or a plain
// non_field_errors / validation error list.
function extractApiError(error, fallback = "Something went wrong.") {
    const data = error?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    const firstKey = Object.keys(data)[0];
    if (firstKey) {
        const val = data[firstKey];
        const msg = Array.isArray(val) ? val[0] : val;
        return `${firstKey}: ${msg}`;
    }

    return fallback;
}