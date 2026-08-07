document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const ATTENDANCE_ENDPOINT = `${API.BASE_URL}/api/faculty/attendance/`;
const ROSTER_ENDPOINT = `${API.BASE_URL}/api/faculty/attendance/roster/`;
const BULK_MARK_ENDPOINT = `${API.BASE_URL}/api/faculty/attendance/bulk-mark/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

let courseSelect;
let dateInput;
let rosterContainer;
let saveRosterWrapper;
let saveRosterBtn;

let calendarCourseSelect;
let calendarStudentSelect;
let calendarMonthInput;
let calendarContainer;

let allCourses = [];
let currentRoster = [];

// ===============================
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseSelect = document.getElementById("courseSelect");
    dateInput = document.getElementById("dateInput");
    rosterContainer = document.getElementById("rosterContainer");
    saveRosterWrapper = document.getElementById("saveRosterWrapper");
    saveRosterBtn = document.getElementById("saveRosterBtn");

    calendarCourseSelect = document.getElementById("calendarCourseSelect");
    calendarStudentSelect = document.getElementById("calendarStudentSelect");
    calendarMonthInput = document.getElementById("calendarMonthInput");
    calendarContainer = document.getElementById("calendarContainer");

    dateInput.value = new Date().toISOString().slice(0, 10);
    calendarMonthInput.value = new Date().toISOString().slice(0, 7);

    registerEvents();
    loadCourses();

}

function registerEvents() {

    saveRosterBtn.addEventListener("click", saveRoster);
    courseSelect.addEventListener("change", maybeAutoLoadRoster);
    dateInput.addEventListener("change", maybeAutoLoadRoster);

    calendarCourseSelect.addEventListener("change", loadStudentsForCalendar);
    calendarStudentSelect.addEventListener("change", maybeAutoLoadCalendar);
    calendarMonthInput.addEventListener("change", maybeAutoLoadCalendar);
    document.getElementById("dayEditSaveBtn").addEventListener("click", saveDayEdit);
    document.getElementById("dayEditClearBtn").addEventListener("click", showClearConfirm);
    document.getElementById("dayEditClearCancelBtn").addEventListener("click", hideClearConfirm);
    document.getElementById("dayEditClearConfirmBtn").addEventListener("click", confirmClearDayRecord);

}

// Auto-loads the daily marking roster via AJAX as soon as both a course
// and date are selected — no need to click Load manually. The button
// still works too, as a manual re-fetch/refresh option.
function maybeAutoLoadRoster() {
    if (courseSelect.value && dateInput.value) {
        loadRoster();
    }
}

// Auto-loads the monthly calendar via AJAX once course, student, and
// month are all selected — no need to click a Load/refresh button.
function maybeAutoLoadCalendar() {
    if (calendarCourseSelect.value && calendarStudentSelect.value && calendarMonthInput.value) {
        loadCalendar();
    }
}

// ===============================
// Courses dropdown
// ===============================

async function loadCourses() {

    try {

        const response = await api.get(DASHBOARD_ENDPOINT, {
            headers: API.headers()
        });

        allCourses = response.data.courses || [];

        const optionsHtml = `<option value="">Select a course...</option>` +
            allCourses.map(c => `<option value="${c.id}">${c.name} (${c.code})${c.batch_name ? " — " + c.batch_name : ""}</option>`).join("");

        courseSelect.innerHTML = optionsHtml;
        calendarCourseSelect.innerHTML = optionsHtml;

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Roster (marking interface)
// ===============================

async function loadRoster() {

    const courseId = courseSelect.value;
    const date = dateInput.value;

    if (!courseId || !date) {
        showSuccessMessage("Please select a course and date.", true);
        return;
    }

    rosterContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`;

    try {

        const response = await api.get(ROSTER_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId, date: date }
        });

        currentRoster = response.data;
        renderRoster(currentRoster);

    } catch (error) {

        console.error(error);
        rosterContainer.innerHTML = `<p class="text-danger text-center py-4">Failed to load roster.</p>`;
        saveRosterWrapper.style.display = "none";

    }

}

function renderRoster(roster) {

    if (!roster || roster.length === 0) {
        rosterContainer.innerHTML = `<p class="text-muted text-center py-4">No students enrolled in this course.</p>`;
        saveRosterWrapper.style.display = "none";
        return;
    }

    rosterContainer.innerHTML = `
        <div class="table-responsive">
            <table class="table align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Student</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${roster.map(entry => `
                        <tr>
                            <td>${entry.student_username}</td>
                            <td>
                                <div class="btn-group" role="group">
                                    <input type="radio" class="btn-check" name="status-${entry.student}" id="present-${entry.student}" value="PRESENT" ${entry.status === "PRESENT" ? "checked" : ""}>
                                    <label class="btn btn-outline-success btn-sm" for="present-${entry.student}">Present</label>

                                    <input type="radio" class="btn-check" name="status-${entry.student}" id="absent-${entry.student}" value="ABSENT" ${entry.status === "ABSENT" ? "checked" : ""}>
                                    <label class="btn btn-outline-danger btn-sm" for="absent-${entry.student}">Absent</label>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    saveRosterWrapper.style.display = "block";

}

async function saveRoster() {

    const courseId = courseSelect.value;
    const date = dateInput.value;

    const records = currentRoster
        .map(entry => {
            const checked = document.querySelector(`input[name="status-${entry.student}"]:checked`);
            return checked ? { student: entry.student, status: checked.value } : null;
        })
        .filter(Boolean);

    if (records.length === 0) {
        showSuccessMessage("Mark at least one student before saving.", true);
        return;
    }

    saveRosterBtn.disabled = true;
    saveRosterBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await api.post(BULK_MARK_ENDPOINT, {
            course: courseId,
            date: date,
            records: records
        }, {
            headers: API.headers()
        });

        showSuccessMessage("Attendance saved successfully.");
        loadRoster();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to save attendance.", true);

    } finally {

        saveRosterBtn.disabled = false;
        saveRosterBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Attendance`;

    }

}

// ===============================
// Monthly calendar
// ===============================

async function loadStudentsForCalendar() {

    const courseId = calendarCourseSelect.value;

    calendarStudentSelect.innerHTML = `<option value="">Loading...</option>`;

    if (!courseId) {
        calendarStudentSelect.innerHTML = `<option value="">Select a course first...</option>`;
        return;
    }

    try {

        // Reuses the roster endpoint purely to get the enrolled student
        // list — the date passed doesn't matter for this, we only read
        // student/student_username off the response, not status.
        const today = new Date().toISOString().slice(0, 10);

        const response = await api.get(ROSTER_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId, date: today }
        });

        const students = response.data;

        calendarStudentSelect.innerHTML = students.length
            ? `<option value="">Select a student...</option>` +
              students.map(s => `<option value="${s.student}">${s.student_username}</option>`).join("")
            : `<option value="">No students enrolled</option>`;

    } catch (error) {

        console.error(error);
        calendarStudentSelect.innerHTML = `<option value="">Failed to load students</option>`;

    }

}

async function loadCalendar() {

    const courseId = calendarCourseSelect.value;
    const studentId = calendarStudentSelect.value;
    const month = calendarMonthInput.value; // "YYYY-MM"

    if (!courseId || !studentId || !month) {
        showSuccessMessage("Please select a course, student, and month.", true);
        return;
    }

    calendarContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`;

    try {

        // No date filter here on purpose — course-level filtering already
        // exists on the backend, so we fetch everything for the course
        // and narrow to this student + month on the client. Simpler than
        // adding a new backend filter for what's a small dataset per course.
        const response = await api.get(ATTENDANCE_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId }
        });

        const statusByDate = {};
        const idByDate = {};

        response.data
            .filter(record => String(record.student) === String(studentId) && record.date.startsWith(month))
            .forEach(record => {
                statusByDate[record.date] = record.status;
                idByDate[record.date] = record.id;
            });

        renderCalendar(month, statusByDate, idByDate);

    } catch (error) {

        console.error(error);
        calendarContainer.innerHTML = `<p class="text-danger text-center py-4">Failed to load calendar.</p>`;

    }

}

function renderCalendar(month, statusByDate, idByDate) {

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
        const clickable = !isWeekend;

        let bg = "#ffffff";
        let textColor = "#111827";
        let border = "1px solid #e5e7eb";

        if (isWeekend) {
            bg = "#9ca3af";
            textColor = "#ffffff";
            border = "none";
        } else if (status === "PRESENT") {
            bg = "#10b981";
            textColor = "#ffffff";
            border = "none";
        } else if (status === "ABSENT") {
            bg = "#ef4444";
            textColor = "#ffffff";
            border = "none";
        }

        cellsHtml += `
            <div
                class="${clickable ? "calendar-day-cell" : ""}"
                data-date="${dateStr}"
                style="background:${bg}; color:${textColor}; border:${border}; border-radius:8px; padding:10px 0; text-align:center; font-size:13px; font-weight:600; ${clickable ? "cursor:pointer;" : ""}"
                ${clickable ? `title="Click to edit"` : ""}
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

    document.querySelectorAll(".calendar-day-cell").forEach(cell => {
        cell.addEventListener("click", () => {
            const dateStr = cell.dataset.date;
            openDayEditModal(dateStr, statusByDate[dateStr], idByDate[dateStr]);
        });
    });

}

// ===============================
// Day edit modal (click-to-edit from the calendar)
// ===============================

let dayEditModal;
let dayEditDate = null;
let dayEditRecordId = null;

function getDayEditModal() {
    if (!dayEditModal) {
        dayEditModal = new bootstrap.Modal(document.getElementById("dayEditModal"));
    }
    return dayEditModal;
}

function openDayEditModal(dateStr, currentStatus, recordId) {

    dayEditDate = dateStr;
    dayEditRecordId = recordId || null;

    const studentName = calendarStudentSelect.options[calendarStudentSelect.selectedIndex]?.text || "";

    document.getElementById("dayEditSubtitle").textContent = `${studentName} — ${dateStr}`;

    document.getElementById("dayEditPresent").checked = currentStatus === "PRESENT";
    document.getElementById("dayEditAbsent").checked = currentStatus === "ABSENT";

    const clearWrapper = document.getElementById("dayEditClearWrapper");
    const clearConfirm = document.getElementById("dayEditClearConfirm");

    clearWrapper.style.display = recordId ? "block" : "none";
    clearConfirm.style.display = "none"; // always reset to collapsed state on open

    getDayEditModal().show();

}

async function saveDayEdit() {

    const checked = document.querySelector('input[name="dayEditStatus"]:checked');

    if (!checked) {
        showSuccessMessage("Select Present or Absent.", true);
        return;
    }

    const saveBtn = document.getElementById("dayEditSaveBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await api.post(BULK_MARK_ENDPOINT, {
            course: calendarCourseSelect.value,
            date: dayEditDate,
            records: [{ student: calendarStudentSelect.value, status: checked.value }]
        }, {
            headers: API.headers()
        });

        getDayEditModal().hide();
        showSuccessMessage("Attendance updated.");
        loadCalendar();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to save.", true);

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save`;

    }

}

function showClearConfirm() {
    document.getElementById("dayEditClearConfirm").style.display = "flex";
}

function hideClearConfirm() {
    document.getElementById("dayEditClearConfirm").style.display = "none";
}

async function confirmClearDayRecord() {

    if (!dayEditRecordId) return;

    const confirmBtn = document.getElementById("dayEditClearConfirmBtn");
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    try {

        await api.delete(`${ATTENDANCE_ENDPOINT}${dayEditRecordId}/`, {
            headers: API.headers()
        });

        getDayEditModal().hide();
        showSuccessMessage("Record cleared.");
        loadCalendar();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to clear record.", true);

    } finally {

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = "Yes, clear";

    }

}

// ===============================
// Success message
// ===============================

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