document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const STUDENT_LEAVE_ENDPOINT = `${API.BASE_URL}/api/faculty/student-leave-requests/`;
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
        const url = status ? `${STUDENT_LEAVE_ENDPOINT}?status=${status}` : STUDENT_LEAVE_ENDPOINT;

        const response = await api.get(url, {
            headers: API.headers()
        });

        renderTable(response.data);

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

    allRecords = records;
    currentPage = 1;
    renderPage();

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

        let actions;
        if (record.status === "PENDING") {
            actions = `
                <button class="btn btn-sm btn-outline-success me-2 approve-btn" data-id="${record.id}">
                    <i class="bi bi-check-lg"></i> Approve
                </button>
                <button class="btn btn-sm btn-outline-danger reject-btn" data-id="${record.id}">
                    <i class="bi bi-x-lg"></i> Reject
                </button>
            `;
        } else {
            actions = `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${record.id}"><i class="bi bi-trash"></i></button>`;
        }

        tableBody.innerHTML += `
        <tr>
            <td>${globalIndex + 1}</td>
            <td><strong>${record.applicant_username}</strong></td>
            <td>${record.reason}</td>
            <td>${record.start_date}</td>
            <td>${record.end_date}</td>
            <td>${statusBadge}</td>
            <td class="text-center actions-cell">${actions}</td>
        </tr>
        `;

    });

    document.querySelectorAll(".approve-btn").forEach(button => {
        button.addEventListener("click", () => reviewRequest(button.dataset.id, "APPROVED"));
    });

    document.querySelectorAll(".reject-btn").forEach(button => {
        button.addEventListener("click", () => reviewRequest(button.dataset.id, "REJECTED"));
    });

    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", () => showInlineDeleteConfirm(button));
    });

    renderPaginationControls(
        document.getElementById("leavePagination"),
        allRecords.length,
        currentPage,
        PER_PAGE,
        (page) => { currentPage = page; renderPage(); }
    );

}

function showInlineDeleteConfirm(button) {

    const cell = button.closest(".actions-cell");
    const recordId = button.dataset.id;

    cell.innerHTML = `
        <span class="small text-muted me-2">Remove this record?</span>
        <button class="btn btn-sm btn-outline-secondary me-1 cancel-delete-btn">Cancel</button>
        <button class="btn btn-sm btn-danger confirm-delete-btn">Yes</button>
    `;

    cell.querySelector(".cancel-delete-btn").addEventListener("click", () => renderPage());
    cell.querySelector(".confirm-delete-btn").addEventListener("click", () => deleteRequest(recordId));

}

async function deleteRequest(id) {

    try {

        await api.delete(`${STUDENT_LEAVE_ENDPOINT}${id}/`, {
            headers: API.headers()
        });

        showSuccessMessage("Record deleted.");
        loadRequests();

    } catch (error) {

        console.error(error);
        showSuccessMessage(error.response?.data?.detail || "Failed to delete record.", true);

    }

}

async function reviewRequest(id, status) {

    try {

        await api.patch(`${STUDENT_LEAVE_ENDPOINT}${id}/`, { status }, {
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