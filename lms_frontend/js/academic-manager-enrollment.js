document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const COURSES_URL = `${API.BASE_URL}/api/academic-manager/courses/`;
const ENROLLMENTS_URL = `${API.BASE_URL}/api/academic-manager/enrollments/`;
const BULK_ENROLL_URL = `${API.BASE_URL}/api/academic-manager/enrollments/bulk-create/`;
const DROPDOWNS_URL = `${API.BASE_URL}/api/academic-manager/dropdowns/`;

let courses = [];
let allStudents = [];
let selectedStudentIds = new Set();

let enrollmentTableBody;
let unenrollModal;
let pendingUnenrollId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function studentLabel(s) {
    const name = [s.first_name, s.last_name].filter(Boolean).join(" ");
    return name ? `${s.username} (${name})` : s.username;
}

function facultyLabel(f) {
    const name = [f.first_name, f.last_name].filter(Boolean).join(" ");
    return name ? `${f.username} (${name})` : f.username;
}

function courseLabel(c) {
    return `${c.code} — ${c.name}${c.batch_name ? " (" + c.batch_name + ")" : ""}`;
}

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    enrollmentTableBody = document.getElementById("enrollmentTableBody");
    unenrollModal = new bootstrap.Modal(document.getElementById("unenrollModal"));

    document.getElementById("enrollmentCourseFilter").addEventListener("change", () => loadEnrollments(1));
    document.getElementById("enrollForm").addEventListener("submit", submitEnrollment);
    document.getElementById("confirmUnenrollBtn").addEventListener("click", confirmUnenroll);
    document.getElementById("studentSearchInput").addEventListener("input", (e) => renderStudentCheckboxes(e.target.value));
    document.getElementById("selectAllStudentsBtn").addEventListener("click", selectAllVisibleStudents);
    document.getElementById("clearStudentsBtn").addEventListener("click", clearSelectedStudents);

    init();

}

async function init() {

    try {
        await loadSharedOptions();
    } catch (error) {
        console.error(error);
        showToast("Could not load courses/faculty/students.", true);
    }

    loadEnrollments(1);

}

// ===============================
// Shared dropdown data
// ===============================

async function loadSharedOptions() {

    // ?limit=100 — this list backs a dropdown (and the Allocation tab's
    // full table), not a paginated view of its own, so it needs the
    // whole set in one page rather than the default page_size=10. Same
    // convention as admin-performance.js's loadDropdownData().
    const [coursesRes, dropdownsRes] = await Promise.all([
        api.get(COURSES_URL, { params: { limit: 100 } }),
        api.get(DROPDOWNS_URL),
    ]);

    courses = coursesRes.data.results;

    const courseOptionsHtml = courses.map(c => `<option value="${c.id}">${courseLabel(c)}</option>`).join("");

    const enrollCourseSelect = document.getElementById("enrollCourse");
    enrollCourseSelect.innerHTML = `<option value="">Select course…</option>` + courseOptionsHtml;

    const courseFilterSelect = document.getElementById("enrollmentCourseFilter");
    courseFilterSelect.innerHTML = `<option value="">All courses</option>` + courseOptionsHtml;

    allStudents = dropdownsRes.data.students;
    renderStudentCheckboxes("");

    renderAllocationTable(dropdownsRes.data.faculty);

}

// ===============================
// Student checkbox picker — replaces the old single-select dropdown
// so an Academic Manager can enroll a whole batch of students in one
// submit instead of one at a time. Selection (selectedStudentIds)
// persists across search filtering and across a course switch, so
// narrowing the search or changing the course doesn't silently drop
// students already checked.
// ===============================

function renderStudentCheckboxes(searchTerm) {

    const container = document.getElementById("studentCheckboxList");
    const term = searchTerm.trim().toLowerCase();

    const visible = term
        ? allStudents.filter(s => studentLabel(s).toLowerCase().includes(term))
        : allStudents;

    if (!visible.length) {
        container.innerHTML = `<div class="text-muted text-center py-4">No students match your search.</div>`;
        return;
    }

    container.innerHTML = visible.map(s => `
        <div class="form-check py-1">
            <input class="form-check-input student-checkbox" type="checkbox" value="${s.id}" id="student-${s.id}"
                   ${selectedStudentIds.has(String(s.id)) ? "checked" : ""}>
            <label class="form-check-label" for="student-${s.id}">${studentLabel(s)}</label>
        </div>
    `).join("");

    container.querySelectorAll(".student-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                selectedStudentIds.add(checkbox.value);
            } else {
                selectedStudentIds.delete(checkbox.value);
            }
            updateSelectedCount();
        });
    });

    updateSelectedCount();

}

function selectAllVisibleStudents() {

    document.querySelectorAll(".student-checkbox").forEach(checkbox => {
        checkbox.checked = true;
        selectedStudentIds.add(checkbox.value);
    });

    updateSelectedCount();

}

function clearSelectedStudents() {

    selectedStudentIds.clear();

    document.querySelectorAll(".student-checkbox").forEach(checkbox => {
        checkbox.checked = false;
    });

    updateSelectedCount();

}

function updateSelectedCount() {

    const countEl = document.getElementById("selectedStudentsCount");
    const count = selectedStudentIds.size;

    countEl.textContent = `${count} selected`;

}

// ===============================
// Student Enrollment tab — server-side paginated, this list can grow
// large across a semester so (unlike the courses/faculty dropdown data)
// it gets real pagination rather than a one-page ?limit fetch.
// ===============================

async function loadEnrollments(page = 1) {

    currentPage = page;

    const courseFilter = document.getElementById("enrollmentCourseFilter").value;

    enrollmentTableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-5">
        <div class="text-muted">
            <div class="spinner-border text-primary mb-3"></div>
            <br>Loading Enrollments...
        </div>
    </td></tr>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (courseFilter) params.course = courseFilter;

        const response = await api.get(ENROLLMENTS_URL, { params });

        totalCount = response.data.count;
        renderEnrollments(response.data.results);
        renderEnrollmentsShowingText(response.data.results.length);
        renderEnrollmentsPagination();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        enrollmentTableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-danger py-5">
            ${extractApiError(error, "Failed to load enrollments.")}
        </td></tr>`;

    }

}

function renderEnrollments(enrollments) {

    if (!enrollments.length) {
        enrollmentTableBody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
            <i class="bi bi-people fs-1"></i><br><br>
            No Enrollments Found
        </td></tr>`;
        return;
    }

    enrollmentTableBody.innerHTML = enrollments.map(e => `
        <tr>
            <td>${e.student_username}</td>
            <td>${e.course_code} — ${e.course_name}</td>
            <td>${e.batch_name || `<span class="text-muted">—</span>`}</td>
            <td>${fmtDate(e.enrolled_on)}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger unenroll-btn" data-id="${e.id}">
                    <i class="bi bi-person-dash"></i> Remove
                </button>
            </td>
        </tr>
    `).join("");

    enrollmentTableBody.querySelectorAll(".unenroll-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            pendingUnenrollId = btn.dataset.id;
            unenrollModal.show();
        });
    });

}

function renderEnrollmentsShowingText(resultsOnPage) {

    const el = document.getElementById("enrollmentsShowingText");
    if (!el) return;

    if (totalCount === 0) {
        el.textContent = "Showing 0 of 0";
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + resultsOnPage - 1;

    el.textContent = `Showing ${start}–${end} of ${totalCount}`;

}

function renderEnrollmentsPagination() {

    const container = document.getElementById("enrollmentsPagination");
    if (!container) return;

    renderPaginationControls(
        container,
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadEnrollments(page)
    );

}

async function submitEnrollment(e) {

    e.preventDefault();

    const errorEl = document.getElementById("enrollFormError");
    errorEl.textContent = "";

    const courseId = document.getElementById("enrollCourse").value;
    const studentIds = Array.from(selectedStudentIds);

    if (!courseId) {
        errorEl.textContent = "Please select a course.";
        return;
    }

    if (!studentIds.length) {
        errorEl.textContent = "Please select at least one student.";
        return;
    }

    const submitBtn = document.getElementById("enrollSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    try {

        const response = await api.post(BULK_ENROLL_URL, {
            students: studentIds,
            course: courseId,
        });

        const { created_count, already_enrolled_count } = response.data;

        let message = `${created_count} student${created_count === 1 ? "" : "s"} enrolled.`;
        if (already_enrolled_count) {
            message += ` (${already_enrolled_count} were already enrolled in this course.)`;
        }
        showToast(message);

        clearSelectedStudents();
        document.getElementById("studentSearchInput").value = "";
        renderStudentCheckboxes("");
        loadEnrollments(1);

    } catch (error) {

        console.error(error);
        errorEl.textContent = extractApiError(error, "Could not enroll students.");

    } finally {

        submitBtn.disabled = false;
        submitBtn.textContent = "Enroll Selected";

    }

}

async function confirmUnenroll() {

    if (!pendingUnenrollId) return;

    try {

        await api.delete(`${ENROLLMENTS_URL}${pendingUnenrollId}/`);
        showToast("Enrollment removed.");
        unenrollModal.hide();
        loadEnrollments(currentPage);

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Could not remove enrollment."), true);
        unenrollModal.hide();

    } finally {

        pendingUnenrollId = null;

    }

}

// ===============================
// Faculty Allocation tab — auto-saves on select change, no manual
// "Save" button, matching the project's auto-trigger convention.
// Already calls the dedicated assign-faculty backend action.
// ===============================

function renderAllocationTable(facultyList) {

    const tbody = document.getElementById("allocationTableBody");

    if (!courses.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No courses yet — create one first.</td></tr>`;
        return;
    }

    const facultyOptionsHtml = `<option value="">— Unassigned —</option>` +
        facultyList.map(f => `<option value="${f.id}">${facultyLabel(f)}</option>`).join("");

    tbody.innerHTML = courses.map(c => `
        <tr>
            <td class="fw-medium">${c.code}</td>
            <td>${c.name}</td>
            <td>${c.batch_name || `<span class="text-muted">—</span>`}</td>
            <td>
                <select class="form-select form-select-sm allocation-select" data-course-id="${c.id}">
                    ${facultyOptionsHtml}
                </select>
            </td>
        </tr>
    `).join("");

    tbody.querySelectorAll(".allocation-select").forEach(select => {

        const course = courses.find(c => String(c.id) === select.dataset.courseId);
        select.value = course?.faculty ?? "";

        select.addEventListener("change", async function () {

            const courseId = this.dataset.courseId;
            const facultyId = this.value || null;
            this.disabled = true;

            try {

                await api.patch(`${COURSES_URL}${courseId}/assign-faculty/`, { faculty: facultyId });
                showToast("Faculty allocation updated.");

                const c = courses.find(c => String(c.id) === courseId);
                if (c) c.faculty = facultyId;

            } catch (error) {

                console.error(error);
                showToast(extractApiError(error, "Could not update allocation."), true);

            } finally {

                this.disabled = false;

            }

        });

    });

}