document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const ADMIN_LEAVE_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/leave-requests/`;
const PAGE_SIZE = 10;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    APPROVED: `<span class="badge bg-success">Approved</span>`,
    REJECTED: `<span class="badge bg-danger">Rejected</span>`,
};

let tableBody;
let statusFilter;

let currentPage = 1;
let totalCount = 0;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("leaveTableBody");
    statusFilter = document.getElementById("statusFilter");

    // Filter changes always reset back to page 1
    statusFilter.addEventListener("change", () => loadRequests(1));

    loadRequests(1);

}

async function loadRequests(page = 1) {

    currentPage = page;

    tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (statusFilter.value) {
            params.status = statusFilter.value;
        }

        const response = await api.get(ADMIN_LEAVE_ENDPOINT, { params });

        totalCount = response.data.count;
        renderTable(response.data.results);
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
        <tr><td colspan="7" class="text-center text-danger py-5">
            Failed to load requests.
        </td></tr>`;

    }

}

function renderTable(records) {

    if (!records || records.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-1"></i><br><br>
            No leave requests found.
        </td></tr>`;
        document.getElementById("showingRangeText").textContent = "Showing 0 of 0";
        document.getElementById("leavePagination").innerHTML = "";
        return;
    }

    tableBody.innerHTML = "";

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    records.forEach((record, i) => {

        const statusBadge = STATUS_BADGES[record.status] || record.status;

        const actions = record.status === "PENDING"
            ? `
                <button class="btn btn-sm btn-outline-success me-2 approve-btn" data-id="${record.id}">
                    <i class="bi bi-check-lg"></i> Approve
                </button>
                <button class="btn btn-sm btn-outline-danger reject-btn" data-id="${record.id}">
                    <i class="bi bi-x-lg"></i> Reject
                </button>
            `
            : `<span class="text-muted small">No action needed</span>`;

        tableBody.innerHTML += `
        <tr>
            <td>${startIndex + i + 1}</td>
            <td><strong>${record.applicant_username}</strong></td>
            <td>${record.reason}</td>
            <td>${record.start_date}</td>
            <td>${record.end_date}</td>
            <td>${statusBadge}</td>
            <td class="text-center">${actions}</td>
        </tr>
        `;

    });

    document.querySelectorAll(".approve-btn").forEach(button => {
        button.addEventListener("click", () => reviewRequest(button.dataset.id, "APPROVED"));
    });

    document.querySelectorAll(".reject-btn").forEach(button => {
        button.addEventListener("click", () => reviewRequest(button.dataset.id, "REJECTED"));
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

    const container = document.getElementById("leavePagination");
    if (!container) return;

    renderPaginationControls(
        container,
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadRequests(page)
    );

}

async function reviewRequest(id, status) {

    try {

        await api.patch(`${ADMIN_LEAVE_ENDPOINT}${id}/`, { status });

        showSuccessMessage(`Request ${status === "APPROVED" ? "approved" : "rejected"}.`);
        loadRequests(currentPage);

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to update request.", true);

    }

}

function showSuccessMessage(message, isError = false) {

    const successBox = document.getElementById("successMessage");
    successBox.classList.toggle("alert-success", !isError);
    successBox.classList.toggle("alert-danger", isError);
    successBox.innerHTML = `<i class="bi ${isError ? "bi-exclamation-circle-fill" : "bi-check-circle-fill"} me-2"></i>${message}`;
    successBox.classList.remove("d-none");

    setTimeout(() => {
        successBox.classList.add("d-none");
    }, 3000);

}