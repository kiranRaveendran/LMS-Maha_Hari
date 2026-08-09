document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const ADMIN_COURSES_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/courses/`;
const COURSE_PERFORMANCE_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/course-performance/`;
const BATCH_PERFORMANCE_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/batch-performance/`;

let courseSelect, batchSelect;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseSelect = document.getElementById("courseSelect");
    batchSelect = document.getElementById("batchSelect");

    courseSelect.addEventListener("change", loadCoursePerformance);
    batchSelect.addEventListener("change", loadBatchPerformance);

    loadDropdownData();

}

// ===============================
// Populate both dropdowns from the existing Courses endpoint —
// batches are derived client-side from each course's batch_id/batch_name,
// deduplicated, rather than needing a separate "list all batches" API.
// ===============================

async function loadDropdownData() {

    try {

        // limit=100 here on purpose — this endpoint is now paginated
        // (10 per page by default on the Courses list page), but a
        // dropdown needs the *complete* list, not one page of it.
        // 100 covers this project's realistic scale; if course count
        // ever exceeds that, this would need real "load all pages" logic.
        const response = await api.get(ADMIN_COURSES_ENDPOINT, {
            params: { limit: 100 }
        });

        const courses = response.data.results;

        courseSelect.innerHTML = `<option value="">Select a course...</option>` +
            courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

        const batchMap = new Map();
        courses.forEach(c => {
            if (c.batch_id && !batchMap.has(c.batch_id)) {
                batchMap.set(c.batch_id, c.batch_name);
            }
        });

        if (batchMap.size === 0) {
            batchSelect.innerHTML = `<option value="">No batches assigned yet</option>`;
        } else {
            batchSelect.innerHTML = `<option value="">Select a batch...</option>` +
                Array.from(batchMap.entries()).map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
        }

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Course-level
// ===============================

async function loadCoursePerformance() {

    const courseId = courseSelect.value;

    if (!courseId) {
        document.getElementById("courseSummary").classList.add("d-none");
        document.getElementById("courseStudentsBody").innerHTML =
            `<tr><td colspan="4" class="text-center py-4 text-muted">Select a course above to see student performance.</td></tr>`;
        return;
    }

    const tbody = document.getElementById("courseStudentsBody");
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>`;
    document.getElementById("courseSummary").classList.add("d-none");

    try {

        const response = await api.get(COURSE_PERFORMANCE_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId }
        });

        const data = response.data;

        document.getElementById("courseAvgAttendance").textContent =
            data.class_average_attendance !== null ? `${data.class_average_attendance}%` : "—";
        document.getElementById("courseAvgMarks").textContent =
            data.class_average_marks !== null ? data.class_average_marks : "—";
        document.getElementById("courseSummary").classList.remove("d-none");

        if (data.students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No students enrolled in this course.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.students.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${s.username}</td>
                <td>${s.attendance_percentage !== null ? s.attendance_percentage + "%" : "—"}</td>
                <td>${s.average_marks !== null ? s.average_marks : "—"}</td>
            </tr>
        `).join("");

    } catch (error) {

        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Failed to load performance data.</td></tr>`;

    }

}

// ===============================
// Batch-level
// ===============================

async function loadBatchPerformance() {

    const batchId = batchSelect.value;

    if (!batchId) {
        document.getElementById("batchSummary").classList.add("d-none");
        document.getElementById("batchCoursesBody").innerHTML =
            `<tr><td colspan="4" class="text-center py-4 text-muted">Select a batch above to see course performance.</td></tr>`;
        return;
    }

    const tbody = document.getElementById("batchCoursesBody");
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>`;
    document.getElementById("batchSummary").classList.add("d-none");

    try {

        const response = await api.get(BATCH_PERFORMANCE_ENDPOINT, {
            headers: API.headers(),
            params: { batch: batchId }
        });

        const data = response.data;

        document.getElementById("batchAvgAttendance").textContent =
            data.overall_average_attendance !== null ? `${data.overall_average_attendance}%` : "—";
        document.getElementById("batchAvgMarks").textContent =
            data.overall_average_marks !== null ? data.overall_average_marks : "—";
        document.getElementById("batchSummary").classList.remove("d-none");

        if (data.courses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No courses under this batch yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.courses.map((c, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${c.course_name} <span class="text-muted small">(${c.course_code})</span></td>
                <td>${c.class_average_attendance !== null ? c.class_average_attendance + "%" : "—"}</td>
                <td>${c.class_average_marks !== null ? c.class_average_marks : "—"}</td>
            </tr>
        `).join("");

    } catch (error) {

        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Failed to load performance data.</td></tr>`;

    }

}