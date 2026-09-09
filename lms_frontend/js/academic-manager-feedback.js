// ===============================================================
// Academic Manager — Student Feedback page. Views feedback/concerns
// addressed to this Academic Manager and responds to them. Feedback
// is rendered as a card list (not a table) since messages/responses
// are free text and don't compress well into table cells.
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const FEEDBACK_URL = `${API.BASE_URL}/api/academic-manager/feedback/`;
const PAGE_SIZE = 10;

let statusFilter;
let listContainer;
let respondModal;
let respondForm;
let respondError;

let currentPage = 1;
let totalCount = 0;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    statusFilter = document.getElementById("statusFilter");
    listContainer = document.getElementById("feedbackList");
    respondModal = new bootstrap.Modal(document.getElementById("respondModal"));
    respondForm = document.getElementById("respondForm");
    respondError = document.getElementById("respondFormError");

    statusFilter.addEventListener("change", () => loadFeedback(1));
    respondForm.addEventListener("submit", submitResponse);

    loadFeedback(1);

}

async function loadFeedback(page = 1) {

    currentPage = page;

    listContainer.innerHTML = `
    <div class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </div>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (statusFilter.value) params.status = statusFilter.value;

        const response = await api.get(FEEDBACK_URL, { params });

        totalCount = response.data.count;
        renderList(response.data.results);
        renderShowingText(response.data.results.length);
        renderPagination();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        listContainer.innerHTML = `<div class="text-center text-danger py-5">Failed to load feedback.</div>`;

    }

}

function renderList(records) {

    if (!records || records.length === 0) {
        listContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
            <i class="bi bi-chat-left-text fs-1"></i><br><br>
            No feedback to show.
        </div>`;
        document.getElementById("showingRangeText").textContent = "Showing 0 of 0";
        document.getElementById("feedbackPagination").innerHTML = "";
        return;
    }

    listContainer.innerHTML = records.map(f => `
        <div class="border rounded p-3 mb-3" data-id="${f.id}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <strong>${f.student_username}</strong>
                    <span class="text-muted small ms-2">${new Date(f.created_at).toLocaleString()}</span>
                </div>
                ${f.responded_at
                    ? `<span class="badge bg-success">Responded</span>`
                    : `<span class="badge bg-warning text-dark">Awaiting response</span>`
                }
            </div>
            <p class="mb-2">${f.message}</p>
            ${f.responded_at
                ? `
                <div class="bg-light rounded p-2 mt-2">
                    <p class="text-muted small mb-1">Your response — ${new Date(f.responded_at).toLocaleString()}</p>
                    <p class="mb-0">${f.response}</p>
                </div>
                `
                : `
                <button class="btn btn-sm btn-primary respond-btn"
                        data-id="${f.id}"
                        data-student="${f.student_username}"
                        data-message="${escapeAttr(f.message)}">
                    <i class="bi bi-reply me-1"></i>Respond
                </button>
                `
            }
        </div>
    `).join("");

    document.querySelectorAll(".respond-btn").forEach(button => {
        button.addEventListener("click", () => openRespondModal(button));
    });

}

function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
}

function renderShowingText(resultsOnPage) {

    const el = document.getElementById("showingRangeText");

    if (totalCount === 0) {
        el.textContent = "Showing 0 of 0";
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + resultsOnPage - 1;

    el.textContent = `Showing ${start}–${end} of ${totalCount}`;

}

function renderPagination() {

    renderPaginationControls(
        document.getElementById("feedbackPagination"),
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadFeedback(page)
    );

}

function openRespondModal(button) {

    document.getElementById("respondFeedbackId").value = button.dataset.id;
    document.getElementById("respondStudentName").textContent = button.dataset.student;
    document.getElementById("respondOriginalMessage").textContent = button.dataset.message;
    document.getElementById("respondText").value = "";
    respondError.textContent = "";

    respondModal.show();

}

async function submitResponse(e) {

    e.preventDefault();

    respondError.textContent = "";

    const id = document.getElementById("respondFeedbackId").value;
    const responseText = document.getElementById("respondText").value.trim();

    const saveBtn = document.getElementById("saveRespondBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Sending...`;

    try {

        await api.patch(`${FEEDBACK_URL}${id}/`, { response: responseText });

        respondModal.hide();
        showToast("Response sent.");
        loadFeedback(currentPage);

    } catch (error) {

        console.error(error);
        respondError.textContent = extractApiError(error, "Failed to send response.");

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = "Send Response";

    }

}
