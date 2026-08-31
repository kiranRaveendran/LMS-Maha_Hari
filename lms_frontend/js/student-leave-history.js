document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const LEAVE_HISTORY_ENDPOINT = `${API.BASE_URL}/api/student/leave-history/`;
const PER_PAGE = 8;

let tableBody;
let allRecords = [];
let currentPage = 1;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    APPROVED: `<span class="badge bg-success">Approved</span>`,
    REJECTED: `<span class="badge bg-danger">Rejected</span>`,
};

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("leaveTableBody");

    document.getElementById("leaveRequestForm").addEventListener("submit", submitLeaveRequest);

    loadLeaveHistory();

}

async function submitLeaveRequest(e) {

    e.preventDefault();

    clearErrors();
    let valid = true;

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const reason = document.getElementById("reason").value.trim();

    if (!startDate) {
        showFieldError("startDate", "Start date is required.");
        valid = false;
    }
    if (!endDate) {
        showFieldError("endDate", "End date is required.");
        valid = false;
    }
    if (startDate && endDate && endDate < startDate) {
        showFieldError("endDate", "End date must be on or after the start date.");
        valid = false;
    }
    if (!reason) {
        showFieldError("reason", "Reason is required.");
        valid = false;
    }

    if (!valid) return;

    const submitBtn = document.getElementById("submitLeaveBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Submitting...`;

    try {

        await api.post(LEAVE_HISTORY_ENDPOINT, {
            start_date: startDate,
            end_date: endDate,
            reason: reason
        });

        document.getElementById("leaveRequestForm").reset();
        showSuccessMessage("Leave request submitted successfully.");
        loadLeaveHistory();

    } catch (error) {

        console.error(error);

        if (error.response?.data) {
            const errors = error.response.data;
            Object.keys(errors).forEach(field => {
                const camelField = field === "start_date" ? "startDate" : field === "end_date" ? "endDate" : field;
                if (document.getElementById(camelField + "Error")) {
                    showFieldError(camelField, Array.isArray(errors[field]) ? errors[field][0] : errors[field]);
                }
            });
            return;
        }

        showSuccessMessage("Failed to submit leave request.", true);

    } finally {

        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="bi bi-send me-2"></i>Submit Request`;

    }

}

function clearErrors() {
    document.querySelectorAll(".text-danger").forEach(el => el.textContent = "");
}

function showFieldError(field, message) {
    const el = document.getElementById(field + "Error");
    if (el) el.textContent = message;
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

async function loadLeaveHistory() {

    try {

        const response = await api.get(LEAVE_HISTORY_ENDPOINT);

        renderTable(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="8" class="text-center text-danger py-5">
            Failed to load leave history.
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
        <tr><td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-calendar-x fs-1"></i><br><br>
            No leave requests submitted yet.
        </td></tr>`;
        document.getElementById("leavePagination").innerHTML = "";
        return;
    }

    const pageItems = paginateArray(allRecords, currentPage, PER_PAGE);

    tableBody.innerHTML = "";

    pageItems.forEach((record) => {

        const globalIndex = allRecords.indexOf(record);
        const appliedDate = new Date(record.applied_at).toLocaleDateString();
        const statusBadge = STATUS_BADGES[record.status] || record.status;
        const reviewedBy = record.reviewed_by_username || `<span class="text-muted">—</span>`;

        const actions = record.status === "PENDING"
            ? `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${record.id}"><i class="bi bi-trash"></i></button>`
            : `<span class="text-muted small">—</span>`;

        tableBody.innerHTML += `
        <tr data-row-id="${record.id}">
            <td>${globalIndex + 1}</td>
            <td>${record.reason}</td>
            <td>${record.start_date}</td>
            <td>${record.end_date}</td>
            <td>${statusBadge}</td>
            <td>${reviewedBy}</td>
            <td>${appliedDate}</td>
            <td class="text-center actions-cell">${actions}</td>
        </tr>
        `;

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

// Inline confirm-in-row — same pattern used on the Exam Marks / faculty
// Leave History pages, avoids stacking a second modal on top of anything.
function showInlineDeleteConfirm(button) {

    const cell = button.closest(".actions-cell");
    const recordId = button.dataset.id;

    cell.innerHTML = `
        <span class="small text-muted me-2">Withdraw?</span>
        <button class="btn btn-sm btn-outline-secondary me-1 cancel-delete-btn">Cancel</button>
        <button class="btn btn-sm btn-danger confirm-delete-btn">Yes</button>
    `;

    cell.querySelector(".cancel-delete-btn").addEventListener("click", () => renderPage());
    cell.querySelector(".confirm-delete-btn").addEventListener("click", () => deleteRequest(recordId));

}

async function deleteRequest(id) {

    try {

        await api.delete(`${LEAVE_HISTORY_ENDPOINT}${id}/`);

        showSuccessMessage("Leave request withdrawn.");
        loadLeaveHistory();

    } catch (error) {

        console.error(error);
        showSuccessMessage(error.response?.data?.detail || "Failed to withdraw request.", true);

    }

}