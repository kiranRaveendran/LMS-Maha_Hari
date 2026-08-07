document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const ADMIN_LEAVE_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/leave-requests/`;
const PER_PAGE = 8;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    APPROVED: `<span class="badge bg-success">Approved</span>`,
    REJECTED: `<span class="badge bg-danger">Rejected</span>`,
};

let tableBody;
let statusFilter;
let allRecords = [];
let currentPage = 1;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("leaveTableBody");
    statusFilter = document.getElementById("statusFilter");

    statusFilter.addEventListener("change", loadRequests);

    loadRequests();

}

async function loadRequests() {

    tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const status = statusFilter.value;
        const url = status ? `${ADMIN_LEAVE_ENDPOINT}?status=${status}` : ADMIN_LEAVE_ENDPOINT;

        const response = await api.get(url, {
            headers: API.headers()
        });

        allRecords = response.data;
        currentPage = 1;
        renderPage();

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

function renderPage() {

    if (!allRecords || allRecords.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-1"></i><br><br>
            No leave requests found.
        </td></tr>`;
        document.getElementById("leavePagination").innerHTML = "";
        return;
    }

    const pageItems = paginateArray(allRecords, currentPage, PER_PAGE);

    tableBody.innerHTML = "";

    pageItems.forEach((record) => {

        const globalIndex = allRecords.indexOf(record);
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
            <td>${globalIndex + 1}</td>
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

    renderPaginationControls(
        document.getElementById("leavePagination"),
        allRecords.length,
        currentPage,
        PER_PAGE,
        (page) => { currentPage = page; renderPage(); }
    );

}

async function reviewRequest(id, status) {

    try {

        await api.patch(`${ADMIN_LEAVE_ENDPOINT}${id}/`, { status }, {
            headers: API.headers()
        });

        showSuccessMessage(`Request ${status === "APPROVED" ? "approved" : "rejected"}.`);
        loadRequests();

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