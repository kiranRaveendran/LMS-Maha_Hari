document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const COURSES_URL = `${API.BASE_URL}/api/academic-manager/courses/`;
const DROPDOWNS_URL = `${API.BASE_URL}/api/academic-manager/dropdowns/`;

let tableBody;
let courseModal;
let reassignModal;
let deleteModal;
let form;
let formError;
let batchSelect;
let facultySelect;
let batchFilter;
let facultyFilter;

let pendingDeleteId = null;
let reassignCourseId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;
let lastRenderedCount = 0;
let searchQuery = "";
let searchDebounceTimer = null;

let facultyOptions = [];

function facultyLabel(f) {
    const name = [f.first_name, f.last_name].filter(Boolean).join(" ");
    return name ? `${f.username} (${name})` : f.username;
}

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("courseTableBody");
    courseModal = new bootstrap.Modal(document.getElementById("courseModal"));
    reassignModal = new bootstrap.Modal(document.getElementById("reassignFacultyModal"));
    deleteModal = new bootstrap.Modal(document.getElementById("deleteCourseModal"));

    form = document.getElementById("courseForm");
    formError = document.getElementById("courseFormError");
    batchSelect = document.getElementById("courseBatch");
    facultySelect = document.getElementById("courseFaculty");
    batchFilter = document.getElementById("batchFilter");
    facultyFilter = document.getElementById("facultyFilter");

    document.getElementById("openCreateCourseBtn").addEventListener("click", openCreateModal);
    form.addEventListener("submit", submitCourseForm);
    document.getElementById("confirmDeleteCourseBtn").addEventListener("click", confirmDelete);
    document.getElementById("saveReassignFacultyBtn").addEventListener("click", submitReassignFaculty);

    document.getElementById("searchInput").addEventListener("keyup", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchQuery = document.getElementById("searchInput").value.trim();
            loadCourses(1);
        }, 350);
    });

    // Auto-trigger on filter change — no manual "Load" button, same
    // convention as the rest of the project.
    batchFilter.addEventListener("change", () => loadCourses(1));
    facultyFilter.addEventListener("change", () => loadCourses(1));

    init();

}

async function init() {

    try {
        await loadDropdownOptions();
    } catch (error) {
        console.error(error);
        showToast("Could not load batch/faculty options.", true);
    }

    loadCourses(1);

}

// ===============================
// Dropdown data — one combined call, no pagination trap
// ===============================

async function loadDropdownOptions() {

    const response = await api.get(DROPDOWNS_URL);
    const batches = response.data.batches || [];
    facultyOptions = response.data.faculty || [];

    const batchOptionsHtml = batches.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
    const facultyOptionsHtml = facultyOptions.map(f => `<option value="${f.id}">${facultyLabel(f)}</option>`).join("");

    batchSelect.innerHTML = `<option value="">— None —</option>` + batchOptionsHtml;
    facultySelect.innerHTML = `<option value="">— Unassigned —</option>` + facultyOptionsHtml;
    document.getElementById("reassignFacultySelect").innerHTML = `<option value="">— Unassigned —</option>` + facultyOptionsHtml;

    batchFilter.innerHTML = `<option value="">All Batches</option>` + batchOptionsHtml;
    facultyFilter.innerHTML = `<option value="">All Faculty</option><option value="unassigned">Unassigned Only</option>` + facultyOptionsHtml;

}

// ===============================
// Load + render (server-side paginated + searched + filtered)
// ===============================

async function loadCourses(page = 1) {

    currentPage = page;

    tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-5">
        <div class="text-muted">
            <div class="spinner-border text-primary mb-3"></div>
            <br>Loading Courses...
        </div>
    </td></tr>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (searchQuery) params.search = searchQuery;
        if (batchFilter.value) params.batch = batchFilter.value;
        if (facultyFilter.value) params.faculty = facultyFilter.value;

        const response = await api.get(COURSES_URL, { params });

        totalCount = response.data.count;
        renderCourses(response.data.results);
        renderShowingText(response.data.results.length);
        renderPagination();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-5">
            ${extractApiError(error, "Failed to load courses.")}
        </td></tr>`;

    }

}

function renderCourses(courses) {

    lastRenderedCount = courses.length;

    if (!courses.length) {
        tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center py-5 text-muted">
            <i class="bi bi-book fs-1"></i><br><br>
            No Courses Found
        </td></tr>`;
        return;
    }

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    tableBody.innerHTML = courses.map((c, i) => `
        <tr>
            <td>${startIndex + i + 1}</td>
            <td class="fw-medium">${c.code}</td>
            <td>${c.name}</td>
            <td>${c.batch_name || `<span class="text-muted">—</span>`}</td>
            <td>${c.faculty_username || `<span class="text-muted">Unassigned</span>`}</td>
            <td><span class="badge bg-light text-dark border">${c.enrolled_count}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-1 reassign-btn" data-course='${JSON.stringify(c)}' title="Reassign Faculty">
                    <i class="bi bi-person-check"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary me-1 edit-course-btn" data-course='${JSON.stringify(c)}' title="Edit Course">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-course-btn" data-id="${c.id}" title="Delete Course">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    tableBody.querySelectorAll(".edit-course-btn").forEach(btn => {
        btn.addEventListener("click", () => openEditModal(JSON.parse(btn.dataset.course)));
    });
    tableBody.querySelectorAll(".reassign-btn").forEach(btn => {
        btn.addEventListener("click", () => openReassignModal(JSON.parse(btn.dataset.course)));
    });
    tableBody.querySelectorAll(".delete-course-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            pendingDeleteId = btn.dataset.id;
            deleteModal.show();
        });
    });

}

function renderShowingText(resultsOnPage) {

    const el = document.getElementById("showingRangeText");
    if (!el) return;

    if (totalCount === 0) {
        el.textContent = "Showing 0 of 0";
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + resultsOnPage - 1;

    el.textContent = `Showing ${start}–${end} of ${totalCount}`;

}

function renderPagination() {

    const container = document.getElementById("coursesPagination");
    if (!container) return;

    renderPaginationControls(
        container,
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadCourses(page)
    );

}

// ===============================
// Create / Edit
// ===============================

function openCreateModal() {
    form.reset();
    formError.textContent = "";
    document.getElementById("courseId").value = "";
    document.getElementById("courseModalTitle").textContent = "New Course";
    courseModal.show();
}

function openEditModal(course) {
    formError.textContent = "";
    document.getElementById("courseId").value = course.id;
    document.getElementById("courseName").value = course.name;
    document.getElementById("courseCode").value = course.code;
    document.getElementById("courseDescription").value = course.description || "";
    batchSelect.value = course.batch ?? "";
    facultySelect.value = course.faculty ?? "";
    document.getElementById("courseModalTitle").textContent = "Edit Course";
    courseModal.show();
}

async function submitCourseForm(e) {

    e.preventDefault();
    formError.textContent = "";

    const id = document.getElementById("courseId").value;
    const payload = {
        name: document.getElementById("courseName").value.trim(),
        code: document.getElementById("courseCode").value.trim(),
        description: document.getElementById("courseDescription").value.trim(),
        batch: batchSelect.value || null,
        faculty: facultySelect.value || null,
    };

    const saveBtn = document.getElementById("saveCourseBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        if (id) {
            await api.patch(`${COURSES_URL}${id}/`, payload);
            showToast("Course updated.");
            courseModal.hide();
            loadCourses(currentPage);
        } else {
            await api.post(COURSES_URL, payload);
            showToast("Course created.");
            courseModal.hide();
            loadCourses(1);
        }

    } catch (error) {

        console.error(error);
        formError.textContent = extractApiError(error, "Could not save course.");

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save";

    }

}

// ===============================
// Reassign Faculty — lightweight allocation action
// ===============================

function openReassignModal(course) {

    reassignCourseId = course.id;
    document.getElementById("reassignFacultyError").textContent = "";
    document.getElementById("reassignCourseLabel").textContent = `${course.name} (${course.code})`;
    document.getElementById("reassignFacultySelect").value = course.faculty ?? "";

    reassignModal.show();

}

async function submitReassignFaculty() {

    if (!reassignCourseId) return;

    const errorBox = document.getElementById("reassignFacultyError");
    errorBox.textContent = "";

    const facultyValue = document.getElementById("reassignFacultySelect").value || null;

    const saveBtn = document.getElementById("saveReassignFacultyBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await api.patch(`${COURSES_URL}${reassignCourseId}/assign-faculty/`, { faculty: facultyValue });
        showToast("Faculty reassigned.");
        reassignModal.hide();
        loadCourses(currentPage);

    } catch (error) {

        console.error(error);
        errorBox.textContent = extractApiError(error, "Could not reassign faculty.");

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save";

    }

}

// ===============================
// Delete
// ===============================

async function confirmDelete() {

    if (!pendingDeleteId) return;

    try {

        await api.delete(`${COURSES_URL}${pendingDeleteId}/`);
        showToast("Course deleted.");
        deleteModal.hide();

        const isLastItemOnPage = lastRenderedCount <= 1;
        loadCourses(isLastItemOnPage && currentPage > 1 ? currentPage - 1 : currentPage);

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Could not delete course."), true);
        deleteModal.hide();

    } finally {

        pendingDeleteId = null;

    }

}