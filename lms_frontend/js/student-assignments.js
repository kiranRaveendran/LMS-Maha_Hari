document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const ASSIGNMENTS_ENDPOINT = `${API.BASE_URL}/api/student/assignments/`;
const SUBMISSIONS_ENDPOINT = `${API.BASE_URL}/api/student/submissions/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

let submitModal;
let gradeViewModal;
let tableBody;
let courseFilter;
let saveSubmissionBtn;

let currentAssignmentForSubmit = null;

// ===============================
// Letter grade mapping — copied exactly from js/submissions.js.
// Display only, marks (0-100) are what's actually stored.
// Pass mark is 40 (C and above pass, F fails).
// ===============================

function getLetterGrade(marks) {

    const m = Number(marks);
    if (isNaN(m)) return null;

    if (m >= 90) return "S";
    if (m >= 75) return "A";
    if (m >= 60) return "B";
    if (m >= 40) return "C";
    return "F";

}

function getLetterGradeBadgeClass(letter) {

    switch (letter) {
        case "S": return "bg-success";
        case "A": return "bg-primary";
        case "B": return "bg-info text-dark";
        case "C": return "bg-warning text-dark";
        case "F": return "bg-danger";
        default: return "bg-secondary";
    }

}

// ===============================
// Due date / countdown helper
// ===============================

function getDueLabel(dueDateIso) {

    if (!dueDateIso) {
        return { text: "No due date", badgeClass: "bg-secondary" };
    }

    const due = new Date(dueDateIso);
    const now = new Date();
    const diffMs = due - now;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
            text: overdueDays === 0 ? "Overdue (today)" : `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`,
            badgeClass: "bg-danger"
        };
    }

    if (diffDays === 0) {
        return { text: "Due today", badgeClass: "bg-warning text-dark" };
    }

    return {
        text: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        badgeClass: diffDays <= 2 ? "bg-warning text-dark" : "bg-primary-subtle text-primary"
    };

}

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
    courseFilter = document.getElementById("courseFilter");
    saveSubmissionBtn = document.getElementById("saveSubmissionBtn");

    submitModal = new bootstrap.Modal(document.getElementById("submitModal"));
    gradeViewModal = new bootstrap.Modal(document.getElementById("gradeViewModal"));

    registerEvents();

    loadCourseFilter();
    loadAssignments();

}

function registerEvents() {

    // Auto-trigger on filter change — no manual "Load" button, same
    // convention as Learning Materials / faculty attendance-marks pages.
    courseFilter.addEventListener("change", loadAssignments);

    saveSubmissionBtn.addEventListener("click", submitAssignment);

}

// ===============================
// Course filter dropdown (reuses dashboard endpoint's enrolled
// courses list — same pattern as student-learning-materials.js)
// ===============================

async function loadCourseFilter() {

    try {

        const response = await api.get(DASHBOARD_ENDPOINT);
        const courses = response.data.courses || [];

        courseFilter.innerHTML = `<option value="">All Courses</option>` +
            courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Load + render assignments
// ===============================

async function loadAssignments() {

    showLoading();

    try {

        const courseId = courseFilter.value;
        const url = courseId ? `${ASSIGNMENTS_ENDPOINT}?course=${courseId}` : ASSIGNMENTS_ENDPOINT;

        const response = await api.get(url);
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

        const courseLabel = `${assignment.course_name} (${assignment.course_code})`;
        const dueDateDisplay = assignment.due_date ? new Date(assignment.due_date).toLocaleString() : "—";
        const description = assignment.description
            ? (assignment.description.length > 80 ? assignment.description.slice(0, 80) + "…" : assignment.description)
            : `<span class="text-muted">No description</span>`;

        const submission = assignment.submission;

        let statusBadge;
        let actionHtml;

        if (!submission) {

            // Not submitted yet — status reflects the deadline, but
            // submission stays open even after the due date (the API
            // doesn't enforce a cutoff, so the UI shouldn't invent one).
            const dueLabel = getDueLabel(assignment.due_date);
            statusBadge = `<span class="badge ${dueLabel.badgeClass}">${dueLabel.text}</span>`;
            actionHtml = `
                <button class="btn btn-sm btn-primary flex-fill submit-btn" data-id="${assignment.id}">
                    <i class="bi bi-upload me-1"></i>Submit
                </button>`;

        } else if (submission.grade !== null && submission.grade !== undefined) {

            const letter = getLetterGrade(submission.grade);
            statusBadge = `<span class="badge ${getLetterGradeBadgeClass(letter)}">Graded — ${letter} (${submission.grade})</span>`;
            actionHtml = `
                <button class="btn btn-sm btn-outline-primary flex-fill view-grade-btn" data-id="${assignment.id}">
                    <i class="bi bi-eye me-1"></i>View Grade
                </button>`;

        } else {

            const lateBadge = submission.is_late
                ? `<span class="badge bg-danger ms-1">Late</span>`
                : "";
            statusBadge = `<span class="badge bg-info text-dark">Submitted — Awaiting grading</span>${lateBadge}`;
            actionHtml = `
                <a href="${submission.file}" target="_blank" class="btn btn-sm btn-outline-secondary flex-fill">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>View File
                </a>`;

        }

        tableBody.innerHTML += `
        <div class="item-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-primary-subtle text-primary" style="max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${courseLabel}">${courseLabel}</span>
            </div>
            <h6 class="fw-bold mb-1">${assignment.title}</h6>
            <p class="text-muted small mb-2">${description}</p>
            <div class="d-flex align-items-center text-muted small mb-2">
                <i class="bi bi-calendar-event me-1"></i> Due ${dueDateDisplay}
            </div>
            <div class="mb-3">${statusBadge}</div>
            <div class="d-flex gap-2">
                ${actionHtml}
            </div>
        </div>
        `;

    });

    document.querySelectorAll(".submit-btn").forEach(button => {
        button.addEventListener("click", () => {
            const assignment = assignments.find(a => a.id == button.dataset.id);
            openSubmitModal(assignment);
        });
    });

    document.querySelectorAll(".view-grade-btn").forEach(button => {
        button.addEventListener("click", () => {
            const assignment = assignments.find(a => a.id == button.dataset.id);
            openGradeViewModal(assignment);
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
// Submit modal
// ===============================

function openSubmitModal(assignment) {

    currentAssignmentForSubmit = assignment;
    clearSubmitError();

    document.getElementById("submitAssignmentId").value = assignment.id;
    document.getElementById("submitAssignmentTitle").textContent = assignment.title;
    document.getElementById("submitCourseName").textContent = `${assignment.course_name} (${assignment.course_code})`;
    document.getElementById("submitDueDate").textContent = assignment.due_date
        ? new Date(assignment.due_date).toLocaleString()
        : "—";
    document.getElementById("submissionFile").value = "";
    document.getElementById("submissionFileError").textContent = "";

    submitModal.show();

}

function clearSubmitError() {
    document.getElementById("submissionFileError").textContent = "";
    const nonFieldBox = document.getElementById("submitNonFieldError");
    nonFieldBox.textContent = "";
    nonFieldBox.classList.add("d-none");
}

function showSubmitError(message) {
    const nonFieldBox = document.getElementById("submitNonFieldError");
    nonFieldBox.textContent = message;
    nonFieldBox.classList.remove("d-none");
}

async function submitAssignment() {

    clearSubmitError();

    const fileInput = document.getElementById("submissionFile");
    const file = fileInput.files[0];

    if (!file) {
        document.getElementById("submissionFileError").textContent = "Choose a file to submit.";
        return;
    }

    if (!currentAssignmentForSubmit) {
        return;
    }

    saveSubmissionBtn.disabled = true;
    saveSubmissionBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Submitting...`;

    const formData = new FormData();
    formData.append("assignment", currentAssignmentForSubmit.id);
    formData.append("file", file);

    try {

        await api.post(SUBMISSIONS_ENDPOINT, formData);

        submitModal.hide();
        showSuccessMessage("Assignment submitted successfully.");

        currentAssignmentForSubmit = null;

        loadAssignments();

    } catch (error) {

        console.error(error);

        // This API returns a flat {"detail": "..."} for every error case
        // (missing file, not enrolled, already submitted, not found) —
        // no field-level errors to map here, unlike the Faculty forms.
        const message = error.response?.data?.detail || "Something went wrong. Please try again.";
        showSubmitError(message);

    } finally {

        saveSubmissionBtn.disabled = false;
        saveSubmissionBtn.innerHTML = `<i class="bi bi-upload me-2"></i>Submit`;

    }

}

// ===============================
// View Grade modal (read-only) — populated directly from the
// assignment's already-loaded `submission` object, no extra API call.
// ===============================

function openGradeViewModal(assignment) {

    const submission = assignment.submission;
    if (!submission) return;

    document.getElementById("gradeViewAssignmentTitle").textContent = assignment.title;
    document.getElementById("gradeViewCourseName").textContent = `${assignment.course_name} (${assignment.course_code})`;

    const letter = getLetterGrade(submission.grade);
    document.getElementById("gradeViewMarks").textContent = submission.grade ?? "—";

    const letterBadge = document.getElementById("gradeViewLetterBadge");
    letterBadge.textContent = letter || "—";
    letterBadge.className = `badge ${getLetterGradeBadgeClass(letter)}`;

    document.getElementById("gradeViewFeedback").innerHTML = submission.feedback
        ? submission.feedback
        : `<span class="text-muted">No feedback given.</span>`;

    document.getElementById("gradeViewSubmittedAt").textContent = submission.submitted_at
        ? new Date(submission.submitted_at).toLocaleString()
        : "—";

    document.getElementById("gradeViewFileLink").href = submission.file || "#";

    gradeViewModal.show();

}

// ===============================
// Success message — copied exactly from js/assignments.js
// ===============================

function showSuccessMessage(message) {

    const successBox = document.getElementById("successMessage");
    document.getElementById("successText").textContent = message;
    successBox.classList.remove("d-none");

    setTimeout(() => {
        successBox.classList.add("d-none");
    }, 3000);

}