document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const COURSES_URL = `${API.BASE_URL}/api/academic-manager/courses/`;
const ENROLLMENTS_URL = `${API.BASE_URL}/api/academic-manager/enrollments/`;
const DROPDOWNS_URL = `${API.BASE_URL}/api/academic-manager/dropdowns/`;

let courses = [];

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

    const studentSelect = document.getElementById("enrollStudent");
    studentSelect.innerHTML = `<option value="">Select student…</option>` +
        dropdownsRes.data.students.map(s => `<option value="${s.id}">${studentLabel(s)}</option>`).join("");

    renderAllocationTable(dropdownsRes.data.faculty);

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

    const payload = {
        student: document.getElementById("enrollStudent").value,
        course: document.getElementById("enrollCourse").value,
    };

    const submitBtn = document.getElementById("enrollSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    try {

        await api.post(ENROLLMENTS_URL, payload);
        showToast("Student enrolled.");
        document.getElementById("enrollForm").reset();
        loadEnrollments(1);

    } catch (error) {

        console.error(error);
        errorEl.textContent = extractApiError(error, "Could not enroll student.");

    } finally {

        submitBtn.disabled = false;
        submitBtn.textContent = "Enroll";

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