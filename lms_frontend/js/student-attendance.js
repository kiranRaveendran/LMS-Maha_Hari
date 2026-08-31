document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const ATTENDANCE_ENDPOINT = `${API.BASE_URL}/api/student/attendance/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

let calendarCourseSelect;
let calendarMonthInput;
let calendarContainer;
let statsRow;

// ===============================
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    calendarCourseSelect = document.getElementById("calendarCourseSelect");
    calendarMonthInput = document.getElementById("calendarMonthInput");
    calendarContainer = document.getElementById("calendarContainer");
    statsRow = document.getElementById("statsRow");

    calendarMonthInput.value = new Date().toISOString().slice(0, 7);

    registerEvents();
    loadCourses();

}

function registerEvents() {

    // Auto-load as soon as both a course and month are selected — same
    // convention as the faculty calendar and every other filtered list
    // in this project (no manual "Load" button).
    calendarCourseSelect.addEventListener("change", maybeAutoLoadCalendar);
    calendarMonthInput.addEventListener("change", maybeAutoLoadCalendar);

}

function maybeAutoLoadCalendar() {
    if (calendarCourseSelect.value && calendarMonthInput.value) {
        loadCalendar();
    }
}

// ===============================
// Courses dropdown (dashboard's enrolled courses)
// ===============================

async function loadCourses() {

    try {

        const response = await api.get(DASHBOARD_ENDPOINT);
        const courses = response.data.courses || [];

        calendarCourseSelect.innerHTML = `<option value="">Select a course...</option>` +
            courses.map(c => `<option value="${c.id}">${c.name} (${c.code})${c.batch_name ? " — " + c.batch_name : ""}</option>`).join("");

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Monthly calendar (read-only)
// ===============================

async function loadCalendar() {

    const courseId = calendarCourseSelect.value;
    const month = calendarMonthInput.value; // "YYYY-MM"

    if (!courseId || !month) {
        return;
    }

    calendarContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`;
    statsRow.style.display = "none";

    try {

        // No date filter on the request itself — the endpoint already
        // scopes to course + the logged-in student, and this dataset is
        // small enough per-course that narrowing to the selected month
        // client-side (same approach as the faculty calendar) is simpler
        // than adding a new backend filter for it.
        const response = await api.get(ATTENDANCE_ENDPOINT, {
            params: { course: courseId }
        });

        const statusByDate = {};

        response.data
            .filter(record => record.date.startsWith(month))
            .forEach(record => {
                statusByDate[record.date] = record.status;
            });

        renderCalendar(month, statusByDate);
        renderStats(statusByDate);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        calendarContainer.innerHTML = `<p class="text-danger text-center py-4">Failed to load attendance.</p>`;

    }

}

function renderStats(statusByDate) {

    const values = Object.values(statusByDate);
    const totalMarked = values.length;
    const totalPresent = values.filter(s => s === "PRESENT").length;
    const totalAbsent = values.filter(s => s === "ABSENT").length;
    const percentage = totalMarked ? Math.round((totalPresent / totalMarked) * 1000) / 10 : null;

    document.getElementById("statPresent").textContent = totalPresent;
    document.getElementById("statAbsent").textContent = totalAbsent;
    document.getElementById("statMarked").textContent = totalMarked;
    document.getElementById("statPercentage").textContent = percentage !== null ? `${percentage}%` : "—";

    statsRow.style.display = "flex";

}

function renderCalendar(month, statusByDate) {

    const [year, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const firstWeekday = new Date(year, monthNum - 1, 1).getDay(); // 0 = Sunday

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let cellsHtml = "";

    for (let i = 0; i < firstWeekday; i++) {
        cellsHtml += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {

        const dateObj = new Date(year, monthNum - 1, day);
        const weekday = dateObj.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const status = statusByDate[dateStr];

        let bg = "#ffffff";
        let textColor = "#111827";
        let border = "1px solid #e5e7eb";
        let label = "Not marked";

        if (isWeekend) {
            bg = "#9ca3af";
            textColor = "#ffffff";
            border = "none";
            label = "Weekend";
        } else if (status === "PRESENT") {
            bg = "#10b981";
            textColor = "#ffffff";
            border = "none";
            label = "Present";
        } else if (status === "ABSENT") {
            bg = "#ef4444";
            textColor = "#ffffff";
            border = "none";
            label = "Absent";
        }

        // Read-only — no click handler, no "cursor:pointer", no
        // day-edit modal. Only a hover tooltip stating the status.
        cellsHtml += `
            <div
                style="background:${bg}; color:${textColor}; border:${border}; border-radius:8px; padding:10px 0; text-align:center; font-size:13px; font-weight:600;"
                title="${dateStr} — ${label}"
            >
                ${day}
            </div>
        `;

    }

    calendarContainer.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; margin-bottom:8px;">
            ${dayLabels.map(d => `<div style="text-align:center; font-size:12px; color:#6b7280; font-weight:600;">${d}</div>`).join("")}
        </div>
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
            ${cellsHtml}
        </div>
    `;

}