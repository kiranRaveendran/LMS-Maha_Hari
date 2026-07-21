// ===============================================================
// Faculty Dashboard. Reuses API.BASE_URL / API.token() / API.headers()
// from js/api.js (same as the Admin dashboard and CRUD pages).
// ===============================================================

const FACULTY_DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

const STAT_CONFIG = [
    { key: "total_courses",            elId: "courseCount" },
    { key: "total_students",           elId: "studentCount" },
    { key: "total_assignments",        elId: "assignmentCount" },
    { key: "total_learning_materials", elId: "materialCount" },
    { key: "pending_grading_count",    elId: "pendingGradingCount" },
];

document.addEventListener("DOMContentLoaded", () => {
    loadFacultyDashboard();

    document
        .getElementById("refreshDashboardBtn")
        ?.addEventListener("click", () => loadFacultyDashboard(true));
});

async function loadFacultyDashboard(isManualRefresh = false) {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    setSkeletonState(true);
    toggleRefreshSpinner(isManualRefresh, true);

    try {

        const response = await axios.get(FACULTY_DASHBOARD_ENDPOINT, {
            headers: API.headers()
        });

        renderProfile(response.data.profile);
        renderStats(response.data);
        renderExtraStats(response.data);
        renderCourses(response.data.courses);
        updateLastUpdatedTimestamp();

    } catch (error) {

        handleDashboardError(error);

    } finally {

        setSkeletonState(false);
        toggleRefreshSpinner(isManualRefresh, false);

    }

}

// ===============================
// Render
// ===============================

function renderProfile(profile) {

    if (!profile) return;

    const nameEl = document.getElementById("facultyName");
    const emailEl = document.getElementById("facultyEmail");
    const employeeIdEl = document.getElementById("facultyEmployeeId");

    const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ") || profile.username;

    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = profile.email || "—";
    if (employeeIdEl) employeeIdEl.textContent = profile.employee_id || "Not set";

}

function renderStats(data) {

    STAT_CONFIG.forEach(({ key, elId }) => {
        const el = document.getElementById(elId);
        if (el) animateCountUp(el, Number(data[key]) || 0);
    });

}

function renderExtraStats(data) {

    const attendanceEl = document.getElementById("attendancePercent");
    const marksEl = document.getElementById("averageMarks");

    if (attendanceEl) {
        attendanceEl.textContent = data.attendance_percentage_this_month !== null
            ? `${data.attendance_percentage_this_month}%`
            : "—";
    }

    if (marksEl) {
        marksEl.textContent = data.average_marks !== null
            ? data.average_marks
            : "—";
    }

}

function renderCourses(courses) {

    const container = document.getElementById("courseList");
    if (!container) return;

    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                <i class="bi bi-journal-x text-3xl mb-2"></i>
                <p class="text-sm mb-0">No courses assigned yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors">
            <div>
                <p class="text-sm font-medium text-gray-900 mb-0">${course.name}</p>
                <p class="text-xs text-gray-500 mb-0">${course.code}</p>
            </div>
        </div>
    `).join("");

}

// ===============================
// Count-up animation (same pattern as Admin dashboard.js)
// ===============================

function animateCountUp(el, target, duration = 700) {

    const startTime = performance.now();

    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.floor(target * progress);

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            el.textContent = target;
        }
    }

    requestAnimationFrame(tick);

}

// ===============================
// Loading state
// ===============================

function setSkeletonState(isLoading) {

    document.querySelectorAll(".stat-skeleton").forEach(el => {
        el.classList.toggle("hidden", !isLoading);
    });

    document.querySelectorAll(".stat-value").forEach(el => {
        el.classList.toggle("hidden", isLoading);
    });

}

function toggleRefreshSpinner(isManualRefresh, isLoading) {

    if (!isManualRefresh) return;

    const btn = document.getElementById("refreshDashboardBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    btn.querySelector(".refresh-icon")?.classList.toggle("animate-spin", isLoading);

}

function updateLastUpdatedTimestamp() {

    const el = document.getElementById("lastUpdated");
    if (!el) return;

    el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

}

// ===============================
// Errors
// ===============================

function handleDashboardError(error) {

    console.error(error);

    if (error.response?.status === 401) {
        localStorage.clear();
        window.location.href = "/login.html";
        return;
    }

    if (error.response?.status === 403) {
        // Logged in, but not a FACULTY account — send them back rather
        // than showing a broken/empty dashboard.
        const message = "This dashboard is only available to Faculty accounts.";
        if (typeof showToast === "function") {
            showToast(message, "danger");
        } else {
            alert(message);
        }
        setTimeout(() => window.location.href = "/login.html", 1500);
        return;
    }

    const message = "Failed to load dashboard statistics.";
    if (typeof showToast === "function") {
        showToast(message, "danger");
    } else {
        alert(message);
    }

}