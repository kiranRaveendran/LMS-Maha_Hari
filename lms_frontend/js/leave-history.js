document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const LEAVE_HISTORY_ENDPOINT = `${API.BASE_URL}/api/faculty/leave-history/`;

let tableBody;

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

    loadLeaveHistory();

}

async function loadLeaveHistory() {

    try {

        const response = await axios.get(LEAVE_HISTORY_ENDPOINT, {
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
            Failed to load leave history.
        </td></tr>`;

    }

}

function renderTable(records) {

    if (!records || records.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-calendar-x fs-1"></i><br><br>
            No leave requests submitted yet.
        </td></tr>`;
        return;
    }

    tableBody.innerHTML = "";

    records.forEach((record, index) => {

        const appliedDate = new Date(record.applied_at).toLocaleDateString();
        const statusBadge = STATUS_BADGES[record.status] || record.status;
        const reviewedBy = record.reviewed_by_username || `<span class="text-muted">—</span>`;

        tableBody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${record.reason}</td>
            <td>${record.start_date}</td>
            <td>${record.end_date}</td>
            <td>${statusBadge}</td>
            <td>${reviewedBy}</td>
            <td>${appliedDate}</td>
        </tr>
        `;

    });

}