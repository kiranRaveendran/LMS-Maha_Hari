document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const ASSIGNMENTS_ENDPOINT = `${API.BASE_URL}/api/faculty/assignments/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

let assignmentModal;
let deleteAssignmentModal;
let tableBody;
let addAssignmentBtn;
let saveAssignmentBtn;
let confirmDeleteBtn;
let courseSelect;

let editingAssignmentId = null;
let deleteAssignmentId = null;
let allCourses = [];

// ===============================
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("assignmentTableBody");
    addAssignmentBtn = document.getElementById("addAssignmentBtn");
    saveAssignmentBtn = document.getElementById("saveAssignmentBtn");
    confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    courseSelect = document.getElementById("course");

    assignmentModal = new bootstrap.Modal(document.getElementById("assignmentModal"));
    deleteAssignmentModal = new bootstrap.Modal(document.getElementById("deleteAssignmentModal"));

    registerEvents();

    loadCourses();
    loadAssignments();

}

function registerEvents() {

    addAssignmentBtn.addEventListener("click", openAddModal);
    saveAssignmentBtn.addEventListener("click", saveAssignment);
    confirmDeleteBtn.addEventListener("click", deleteAssignment);

}

// ===============================
// Courses dropdown (reuses dashboard endpoint, same as Learning Materials)
// ===============================

async function loadCourses() {

    try {

        const response = await api.get(DASHBOARD_ENDPOINT, {
            headers: API.headers()
        });

        allCourses = response.data.courses || [];

        courseSelect.innerHTML = `<option value="">Select a course...</option>` +
            allCourses.map(c => `<option value="${c.id}">${c.name} (${c.code})${c.batch_name ? " — " + c.batch_name : ""}</option>`).join("");

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Modals
// ===============================

function openAddModal() {

    editingAssignmentId = null;

    document.getElementById("assignmentForm").reset();
    clearErrors();
    document.getElementById("assignmentId").value = "";
    document.getElementById("modalTitle").textContent = "New Assignment";

    assignmentModal.show();

}

async function editAssignment(id) {

    try {

        const response = await api.get(`${ASSIGNMENTS_ENDPOINT}${id}/`, {
            headers: API.headers()
        });

        const assignment = response.data;

        editingAssignmentId = id;
        clearErrors();

        document.getElementById("modalTitle").textContent = "Edit Assignment";
        document.getElementById("title").value = assignment.title;
        document.getElementById("course").value = assignment.course;
        document.getElementById("description").value = assignment.description || "";
        document.getElementById("due_date").value = isoToDatetimeLocal(assignment.due_date);

        assignmentModal.show();

    } catch (error) {

        console.error(error);
        alert("Unable to load assignment.");

    }

}

// ===============================
// Date helpers
// datetime-local input gives "2026-07-25T23:59" (no seconds/timezone).
// The API expects/returns full ISO 8601 with seconds + "Z" (UTC).
// This is a simple UTC-label conversion, not a true timezone conversion —
// fine for this project's scope, worth revisiting if multi-timezone
// support is ever needed.
// ===============================

function datetimeLocalToIso(value) {
    if (!value) return null;
    return `${value}:00Z`;
}

function isoToDatetimeLocal(value) {
    if (!value) return "";
    return value.slice(0, 16); // "2026-07-25T23:59:00Z" -> "2026-07-25T23:59"
}

// ===============================
// Load + render
// ===============================

async function loadAssignments() {

    showLoading();

    try {

        const response = await api.get(ASSIGNMENTS_ENDPOINT, {
            headers: API.headers()
        });

        renderTable(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        showError();

    }

}

function renderTable(assignments) {

    if (!assignments || assignments.length === 0) {
        showEmptyState();
        return;
    }

    tableBody.innerHTML = "";

    assignments.forEach((assignment) => {

        const course = allCourses.find(c => c.id === assignment.course);
        const courseLabel = course ? `${course.name} (${course.code})${course.batch_name ? " — " + course.batch_name : ""}` : `Course #${assignment.course}`;
        const dueDate = new Date(assignment.due_date).toLocaleString();
        const description = assignment.description
            ? (assignment.description.length > 80 ? assignment.description.slice(0, 80) + "…" : assignment.description)
            : `<span class="text-muted">No description</span>`;

        tableBody.innerHTML += `
        <div class="item-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-primary-subtle text-primary" style="max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${courseLabel}">${courseLabel}</span>
            </div>
            <h6 class="fw-bold mb-1">${assignment.title}</h6>
            <p class="text-muted small mb-3">${description}</p>
            <div class="d-flex align-items-center text-muted small mb-3">
                <i class="bi bi-calendar-event me-1"></i> Due ${dueDate}
            </div>
            <div class="d-flex gap-2">
                <a href="/faculty/submissions.html?assignment=${assignment.id}" class="btn btn-sm btn-outline-secondary flex-fill" title="View Submissions">
                    <i class="bi bi-inbox"></i>
                </a>
                <button class="btn btn-sm btn-outline-primary flex-fill edit-btn" data-id="${assignment.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger flex-fill delete-btn" data-id="${assignment.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        `;

    });

    document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", () => editAssignment(button.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteAssignmentId = button.dataset.id;
            deleteAssignmentModal.show();
        });
    });

}

function showLoading() {
    tableBody.innerHTML = `
    <div class="text-center py-5" style="grid-column: 1/-1;">
        <div class="spinner-border text-primary"></div>
        <p class="mt-3">Loading Assignments...</p>
    </div>`;
}

function showEmptyState() {
    tableBody.innerHTML = `
    <div class="text-center py-5 text-muted" style="grid-column: 1/-1;">
        <i class="bi bi-clipboard-x fs-1"></i><br><br>
        No Assignments Found
    </div>`;
}

function showError() {
    tableBody.innerHTML = `
    <div class="text-center text-danger py-5" style="grid-column: 1/-1;">
        Failed to load Assignments.
    </div>`;
}

// ===============================
// Save
// ===============================

async function saveAssignment() {

    if (!validateAssignmentForm()) {
        return;
    }

    saveAssignmentBtn.disabled = true;
    saveAssignmentBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const payload = {
        title: document.getElementById("title").value.trim(),
        course: document.getElementById("course").value,
        description: document.getElementById("description").value.trim(),
        due_date: datetimeLocalToIso(document.getElementById("due_date").value),
    };

    try {

        if (editingAssignmentId) {
            await api.patch(`${ASSIGNMENTS_ENDPOINT}${editingAssignmentId}/`, payload, {
                headers: API.headers()
            });
        } else {
            await api.post(ASSIGNMENTS_ENDPOINT, payload, {
                headers: API.headers()
            });
        }

        assignmentModal.hide();
        document.getElementById("assignmentForm").reset();

        showSuccessMessage(
            editingAssignmentId ? "Assignment updated successfully." : "Assignment created successfully."
        );

        editingAssignmentId = null;

        saveAssignmentBtn.disabled = false;
        saveAssignmentBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Assignment`;

        loadAssignments();

    } catch (error) {

        console.error(error);

        saveAssignmentBtn.disabled = false;
        saveAssignmentBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Assignment`;

        clearErrors();

        if (error.response?.data) {
            const errors = error.response.data;
            Object.keys(errors).forEach(field => {
                if (document.getElementById(field + "Error")) {
                    showFieldError(field, Array.isArray(errors[field]) ? errors[field][0] : errors[field]);
                }
            });
            return;
        }

        alert("Something went wrong.");

    }

}

// ===============================
// Delete
// ===============================

async function deleteAssignment() {

    try {

        await api.delete(`${ASSIGNMENTS_ENDPOINT}${deleteAssignmentId}/`, {
            headers: API.headers()
        });

        deleteAssignmentModal.hide();
        showSuccessMessage("Assignment deleted successfully.");
        loadAssignments();

    } catch (error) {

        console.error(error);
        alert("Failed to delete assignment.");

    }

}

// ===============================
// Success message
// ===============================

function showSuccessMessage(message) {

    const successBox = document.getElementById("successMessage");
    successBox.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${message}`;
    successBox.classList.remove("d-none");

    setTimeout(() => {
        successBox.classList.add("d-none");
    }, 3000);

}

// ===============================
// Validation
// ===============================

function clearErrors() {
    document.querySelectorAll(".text-danger").forEach(el => el.textContent = "");
    document.querySelectorAll(".form-control").forEach(el => el.classList.remove("is-invalid"));
}

function showFieldError(field, message) {
    document.getElementById(field + "Error").textContent = message;
    document.getElementById(field).classList.add("is-invalid");
}

function validateAssignmentForm() {

    clearErrors();
    let valid = true;

    const title = document.getElementById("title").value.trim();
    const course = document.getElementById("course").value;
    const dueDate = document.getElementById("due_date").value;

    if (!title) {
        showFieldError("title", "Title is required.");
        valid = false;
    }

    if (!course) {
        showFieldError("course", "Please select a course.");
        valid = false;
    }

    if (!dueDate) {
        showFieldError("due_date", "Due date is required.");
        valid = false;
    }

    return valid;

}