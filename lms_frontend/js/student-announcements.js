document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const STUDENT_ANNOUNCEMENTS_ENDPOINT = `${API.BASE_URL}/api/student/announcements/`;
const STUDENT_DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

let courseFilter;
let listContainer;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseFilter = document.getElementById("courseFilter");
    listContainer = document.getElementById("announcementsList");

    courseFilter.addEventListener("change", () => loadAnnouncements());

    init();

}

async function init() {

    try {
        await loadCourseOptions();
    } catch (error) {
        console.error(error);
    }

    loadAnnouncements();

}

async function loadCourseOptions() {

    const response = await api.get(STUDENT_DASHBOARD_ENDPOINT);
    const courses = response.data.courses || [];

    courseFilter.innerHTML = `<option value="">All Courses</option>` +
        courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

}

async function loadAnnouncements() {

    listContainer.innerHTML = `
    <div class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </div>`;

    try {

        const params = {};
        if (courseFilter.value) params.course = courseFilter.value;

        const response = await api.get(STUDENT_ANNOUNCEMENTS_ENDPOINT, { params });

        renderAnnouncements(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        listContainer.innerHTML = `<div class="text-center text-danger py-5">Failed to load announcements.</div>`;

    }

}

function renderAnnouncements(announcements) {

    if (!announcements.length) {
        listContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
            <i class="bi bi-megaphone fs-1"></i><br><br>
            No announcements yet.
        </div>`;
        return;
    }

    listContainer.innerHTML = announcements.map(a => `
        <div class="border rounded p-3 mb-3">
            <div class="d-flex justify-content-between align-items-start mb-1">
                <h6 class="fw-bold mb-0">${a.title}</h6>
                <span class="text-muted small">${new Date(a.created_at).toLocaleString()}</span>
            </div>
            <p class="text-muted small mb-2">${a.course_code} — ${a.course_name}</p>
            <p class="mb-0">${a.message}</p>
        </div>
    `).join("");

}
