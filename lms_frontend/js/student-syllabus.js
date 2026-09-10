document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const STUDENT_SYLLABUS_ENDPOINT = `${API.BASE_URL}/api/student/syllabus/`;
const STUDENT_DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    COMPLETED: `<span class="badge bg-success">Completed</span>`,
};

let courseFilter;
let tableBody;
let topics = [];

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseFilter = document.getElementById("courseFilter");
    tableBody = document.getElementById("syllabusTableBody");

    courseFilter.addEventListener("change", () => loadSyllabus());

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

    const response = await api.get(STUDENT_DASHBOARD_ENDPOINT);
    const courses = response.data.courses || [];

    courseFilter.innerHTML = `<option value="">All Courses</option>` +
        courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

}

async function loadSyllabus() {

    tableBody.innerHTML = `
    <tr><td colspan="4" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const params = {};
        if (courseFilter.value) params.course = courseFilter.value;

        const response = await api.get(STUDENT_SYLLABUS_ENDPOINT, { params });
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
        <tr><td colspan="4" class="text-center text-danger py-5">
            Failed to load syllabus.
        </td></tr>`;

    }

}

function renderTopics() {

    if (!topics.length) {
        tableBody.innerHTML = `
        <tr><td colspan="4" class="text-center py-5 text-muted">
            <i class="bi bi-journal-x fs-1"></i><br><br>
            No syllabus published for this course yet.
        </td></tr>`;
        return;
    }

    const sorted = [...topics].sort((a, b) =>
        a.course_code.localeCompare(b.course_code) || a.session_number - b.session_number
    );

    tableBody.innerHTML = sorted.map(t => `
        <tr>
            <td>${t.course_code}</td>
            <td>${t.session_number}</td>
            <td>${t.topic_name}</td>
            <td>${STATUS_BADGES[t.status] || t.status}</td>
        </tr>
    `).join("");

}

function renderProgress() {

    const total = topics.length;
    const completed = topics.filter(t => t.status === "COMPLETED").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById("progressText").textContent = `${completed} of ${total} topics completed`;
    document.getElementById("progressBar").style.width = `${pct}%`;

}
