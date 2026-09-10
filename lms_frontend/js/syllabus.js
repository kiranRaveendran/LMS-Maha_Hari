document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const FACULTY_SYLLABUS_ENDPOINT = `${API.BASE_URL}/api/faculty/syllabus/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    COMPLETED: `<span class="badge bg-success">Completed</span>`,
};

let courseSelect;
let tableBody;
let topics = [];

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseSelect = document.getElementById("courseSelect");
    tableBody = document.getElementById("syllabusTableBody");

    courseSelect.addEventListener("change", () => loadSyllabus());

    init();

}

async function init() {

    try {
        await loadCourseOptions();
    } catch (error) {
        console.error(error);
    }

    loadSyllabus();

}

async function loadCourseOptions() {

    const response = await api.get(DASHBOARD_ENDPOINT);
    const courses = response.data.courses || [];

    courseSelect.innerHTML = `<option value="">All my courses</option>` +
        courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

}

async function loadSyllabus() {

    tableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const params = {};
        if (courseSelect.value) params.course = courseSelect.value;

        const response = await api.get(FACULTY_SYLLABUS_ENDPOINT, { params });
        topics = response.data;

        renderTopics();
        renderProgress();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-danger py-5">
            Failed to load syllabus.
        </td></tr>`;

    }

}

function renderTopics() {

    if (!topics.length) {
        tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
            <i class="bi bi-journal-x fs-1"></i><br><br>
            No syllabus topics allocated yet.
        </td></tr>`;
        return;
    }

    const sorted = [...topics].sort((a, b) =>
        a.course_code.localeCompare(b.course_code) || a.session_number - b.session_number
    );

    tableBody.innerHTML = sorted.map(t => `
        <tr data-row-id="${t.id}">
            <td>${t.course_code}</td>
            <td>${t.session_number}</td>
            <td>${t.topic_name}</td>
            <td class="status-cell">${STATUS_BADGES[t.status] || t.status}</td>
            <td class="text-end">
                ${t.status === "PENDING"
                    ? `<button class="btn btn-sm btn-outline-success mark-complete-btn" data-id="${t.id}">
                           <i class="bi bi-check-lg me-1"></i>Mark Complete
                       </button>`
                    : `<button class="btn btn-sm btn-outline-secondary mark-pending-btn" data-id="${t.id}">
                           <i class="bi bi-arrow-counterclockwise me-1"></i>Reopen
                       </button>`
                }
            </td>
        </tr>
    `).join("");

    document.querySelectorAll(".mark-complete-btn").forEach(button => {
        button.addEventListener("click", () => updateStatus(button.dataset.id, "COMPLETED"));
    });

    document.querySelectorAll(".mark-pending-btn").forEach(button => {
        button.addEventListener("click", () => updateStatus(button.dataset.id, "PENDING"));
    });

}

function renderProgress() {

    const total = topics.length;
    const completed = topics.filter(t => t.status === "COMPLETED").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById("progressText").textContent = `${completed} of ${total} topics completed`;
    document.getElementById("progressBar").style.width = `${pct}%`;

}

async function updateStatus(id, status) {

    try {

        await api.patch(`${FACULTY_SYLLABUS_ENDPOINT}${id}/`, { status });

        showSuccessMessage(status === "COMPLETED" ? "Topic marked complete." : "Topic reopened.");
        loadSyllabus();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to update topic.", true);

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
