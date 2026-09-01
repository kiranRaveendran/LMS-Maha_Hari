document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const BATCHES_URL = `${API.BASE_URL}/api/academic-manager/batches/`;

let tableBody;
let batchModal;
let deleteModal;
let form;
let formError;

let pendingDeleteId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;
let searchQuery = "";
let searchDebounceTimer = null;
let lastRenderedCount = 0;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("batchTableBody");
    batchModal = new bootstrap.Modal(document.getElementById("batchModal"));
    deleteModal = new bootstrap.Modal(document.getElementById("deleteBatchModal"));
    form = document.getElementById("batchForm");
    formError = document.getElementById("batchFormError");

    document.getElementById("openCreateBatchBtn").addEventListener("click", openCreateModal);
    form.addEventListener("submit", submitBatchForm);
    document.getElementById("confirmDeleteBatchBtn").addEventListener("click", confirmDelete);

    document.getElementById("searchInput").addEventListener("keyup", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchQuery = document.getElementById("searchInput").value.trim();
            loadBatches(1);
        }, 350);
    });

    loadBatches(1);

}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ===============================
// Load + render (server-side paginated + searched)
// ===============================

async function loadBatches(page = 1) {

    currentPage = page;

    tableBody.innerHTML = `
    <tr><td colspan="6" class="text-center py-5">
        <div class="text-muted">
            <div class="spinner-border text-primary mb-3"></div>
            <br>Loading Batches...
        </div>
    </td></tr>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (searchQuery) {
            params.search = searchQuery;
        }

        const response = await api.get(BATCHES_URL, { params });

        totalCount = response.data.count;
        renderBatches(response.data.results);
        renderShowingText(response.data.results.length);
        renderPagination();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-danger py-5">
            ${extractApiError(error, "Failed to load batches.")}
        </td></tr>`;

    }

}

function renderBatches(batches) {

    lastRenderedCount = batches.length;

    if (!batches.length) {
        tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-diagram-3 fs-1"></i><br><br>
            No Batches Found
        </td></tr>`;
        return;
    }

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    tableBody.innerHTML = batches.map((b, i) => `
        <tr>
            <td>${startIndex + i + 1}</td>
            <td class="fw-medium">${b.name}</td>
            <td>${fmtDate(b.start_date)}</td>
            <td>${fmtDate(b.end_date)}</td>
            <td><span class="badge bg-light text-dark border">${b.course_count}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-secondary me-1 edit-batch-btn" data-id="${b.id}" data-name="${b.name}" data-start="${b.start_date}" data-end="${b.end_date}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-batch-btn" data-id="${b.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    tableBody.querySelectorAll(".edit-batch-btn").forEach(btn => {
        btn.addEventListener("click", () => openEditModal(btn.dataset));
    });
    tableBody.querySelectorAll(".delete-batch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            pendingDeleteId = btn.dataset.id;
            deleteModal.show();
        });
    });

}

function renderShowingText(resultsOnPage) {

    const el = document.getElementById("showingRangeText");
    if (!el) return;

    if (totalCount === 0) {
        el.textContent = "Showing 0 of 0";
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + resultsOnPage - 1;

    el.textContent = `Showing ${start}–${end} of ${totalCount}`;

}

function renderPagination() {

    const container = document.getElementById("batchesPagination");
    if (!container) return;

    renderPaginationControls(
        container,
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadBatches(page)
    );

}

// ===============================
// Create / Edit
// ===============================

function openCreateModal() {
    form.reset();
    formError.textContent = "";
    document.getElementById("batchId").value = "";
    document.getElementById("batchModalTitle").textContent = "New Batch";
    batchModal.show();
}

function openEditModal(data) {
    formError.textContent = "";
    document.getElementById("batchId").value = data.id;
    document.getElementById("batchName").value = data.name;
    document.getElementById("batchStartDate").value = data.start;
    document.getElementById("batchEndDate").value = data.end;
    document.getElementById("batchModalTitle").textContent = "Edit Batch";
    batchModal.show();
}

async function submitBatchForm(e) {

    e.preventDefault();
    formError.textContent = "";

    const id = document.getElementById("batchId").value;
    const payload = {
        name: document.getElementById("batchName").value.trim(),
        start_date: document.getElementById("batchStartDate").value,
        end_date: document.getElementById("batchEndDate").value,
    };

    const saveBtn = document.getElementById("saveBatchBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        if (id) {
            await api.patch(`${BATCHES_URL}${id}/`, payload);
            showToast("Batch updated.");
            batchModal.hide();
            loadBatches(currentPage);
        } else {
            await api.post(BATCHES_URL, payload);
            showToast("Batch created.");
            batchModal.hide();
            loadBatches(1);
        }

    } catch (error) {

        console.error(error);
        formError.textContent = extractApiError(error, "Could not save batch.");

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save";

    }

}

// ===============================
// Delete
// ===============================

async function confirmDelete() {

    if (!pendingDeleteId) return;

    try {

        await api.delete(`${BATCHES_URL}${pendingDeleteId}/`);
        showToast("Batch deleted.");
        deleteModal.hide();

        // If this was the last item on the current page (and we're not
        // already on page 1), step back a page instead of landing on an
        // empty results page.
        const isLastItemOnPage = lastRenderedCount <= 1;
        loadBatches(isLastItemOnPage && currentPage > 1 ? currentPage - 1 : currentPage);

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Could not delete batch."), true);
        deleteModal.hide();

    } finally {

        pendingDeleteId = null;

    }

}