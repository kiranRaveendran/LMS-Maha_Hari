document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const SUBMISSIONS_ENDPOINT = `${API.BASE_URL}/api/faculty/submissions/`;
const ASSIGNMENTS_ENDPOINT = `${API.BASE_URL}/api/faculty/assignments/`;

let gradeModal;
let tableBody;
let assignmentFilter;
let saveGradeBtn;

let allAssignments = [];
let editingSubmissionId = null;

// ===============================
// Letter grade mapping — display only, marks (0-100) are what's
// actually stored. Pass mark is 40 (C and above pass, F fails).
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
// Late detection — compares a submission's submitted_at against its
// assignment's due_date (looked up from allAssignments, already loaded
// for the filter dropdown — no extra API call needed).
// ===============================

function isSubmissionLate(submission) {

    const assignment = allAssignments.find(a => a.id === submission.assignment);
    if (!assignment || !assignment.due_date) return null;

    return new Date(submission.submitted_at) > new Date(assignment.due_date);

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

    tableBody = document.getElementById("submissionTableBody");
    assignmentFilter = document.getElementById("assignmentFilter");
    saveGradeBtn = document.getElementById("saveGradeBtn");

    gradeModal = new bootstrap.Modal(document.getElementById("gradeModal"));

    document.getElementById("grade").addEventListener("input", updateGradeLetterPreview);

    registerEvents();
    loadAssignmentsForFilter();

    // Supports being linked to directly from Assignments page with
    // submissions.html?assignment=<id> to arrive pre-filtered.
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedAssignment = urlParams.get("assignment");

    loadSubmissions(preselectedAssignment || "");

}

function registerEvents() {

    assignmentFilter.addEventListener("change", () => {
        loadSubmissions(assignmentFilter.value);
    });

    saveGradeBtn.addEventListener("click", saveGrade);

}

// ===============================
// Assignment filter dropdown
// ===============================

async function loadAssignmentsForFilter() {

    try {

        const response = await api.get(ASSIGNMENTS_ENDPOINT, {
            headers: API.headers()
        });

        allAssignments = response.data;

        assignmentFilter.innerHTML = `<option value="">All Assignments</option>` +
            allAssignments.map(a => `<option value="${a.id}">${a.title}</option>`).join("");

        // Apply preselection from URL, if any, now that options exist
        const urlParams = new URLSearchParams(window.location.search);
        const preselectedAssignment = urlParams.get("assignment");
        if (preselectedAssignment) {
            assignmentFilter.value = preselectedAssignment;
        }

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Load + render submissions
// ===============================

async function loadSubmissions(assignmentId) {

    showLoading();

    try {

        const url = assignmentId
            ? `${SUBMISSIONS_ENDPOINT}?assignment=${assignmentId}`
            : SUBMISSIONS_ENDPOINT;

        const response = await api.get(url, {
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

function renderTable(submissions) {

    if (!submissions || submissions.length === 0) {
        showEmptyState();
        return;
    }

    tableBody.innerHTML = "";

    submissions.forEach((submission) => {

        const submittedDate = new Date(submission.submitted_at).toLocaleString();

        let gradeBadge;
        if (submission.grade !== null && submission.grade !== undefined) {
            const letter = getLetterGrade(submission.grade);
            gradeBadge = `<span class="badge ${getLetterGradeBadgeClass(letter)}">${letter} (${submission.grade})</span>`;
        } else {
            gradeBadge = `<span class="badge bg-secondary">Not graded</span>`;
        }

        const late = isSubmissionLate(submission);
        const lateBadge = late === null
            ? ""
            : late
                ? `<span class="badge bg-danger">Late</span>`
                : `<span class="badge bg-success">On Time</span>`;

        tableBody.innerHTML += `
        <div class="item-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h6 class="fw-bold mb-0">${submission.student_username}</h6>
                    <p class="text-muted small mb-0">${submission.assignment_title}</p>
                </div>
                <div class="d-flex flex-column gap-1 align-items-end">
                    ${gradeBadge}
                    ${lateBadge}
                </div>
            </div>
            <p class="text-muted small mb-3">
                <i class="bi bi-clock me-1"></i>Submitted ${submittedDate}
            </p>
            <div class="d-flex gap-2">
                <a href="${submission.file}" target="_blank" class="btn btn-sm btn-outline-secondary flex-fill">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>View File
                </a>
                <button class="btn btn-sm btn-primary flex-fill grade-btn" data-id="${submission.id}">
                    <i class="bi bi-pencil-square me-1"></i>Grade
                </button>
            </div>
        </div>
        `;

    });

    document.querySelectorAll(".grade-btn").forEach(button => {
        button.addEventListener("click", () => {
            const submission = submissions.find(s => s.id == button.dataset.id);
            openGradeModal(submission);
        });
    });

}

function showLoading() {
    tableBody.innerHTML = `
    <div class="text-center py-5" style="grid-column: 1/-1;">
        <div class="spinner-border text-primary"></div>
        <p class="mt-3">Loading Submissions...</p>
    </div>`;
}

function showEmptyState() {
    tableBody.innerHTML = `
    <div class="text-center py-5 text-muted" style="grid-column: 1/-1;">
        <i class="bi bi-inbox fs-1"></i><br><br>
        No Submissions Found
    </div>`;
}

function showError() {
    tableBody.innerHTML = `
    <div class="text-center text-danger py-5" style="grid-column: 1/-1;">
        Failed to load Submissions.
    </div>`;
}

// ===============================
// Grade modal
// ===============================

function updateGradeLetterPreview() {

    const value = document.getElementById("grade").value;
    const preview = document.getElementById("gradeLetterPreview");

    if (value === "") {
        preview.textContent = "—";
        preview.className = "badge bg-secondary";
        return;
    }

    const letter = getLetterGrade(value);
    preview.textContent = letter || "—";
    preview.className = `badge ${getLetterGradeBadgeClass(letter)}`;

}

function openGradeModal(submission) {

    editingSubmissionId = submission.id;
    clearErrors();

    document.getElementById("gradeStudentName").textContent = submission.student_username;
    document.getElementById("gradeAssignmentTitle").textContent = submission.assignment_title;
    document.getElementById("gradeFileLink").href = submission.file;
    document.getElementById("grade").value = submission.grade ?? "";
    document.getElementById("feedback").value = submission.feedback ?? "";

    updateGradeLetterPreview();

    gradeModal.show();

}

async function saveGrade() {

    if (!validateGradeForm()) {
        return;
    }

    saveGradeBtn.disabled = true;
    saveGradeBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const payload = {
        grade: document.getElementById("grade").value,
        feedback: document.getElementById("feedback").value.trim(),
    };

    try {

        await api.patch(`${SUBMISSIONS_ENDPOINT}${editingSubmissionId}/`, payload, {
            headers: API.headers()
        });

        gradeModal.hide();
        showSuccessMessage("Grade saved successfully.");

        saveGradeBtn.disabled = false;
        saveGradeBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Grade`;

        loadSubmissions(assignmentFilter.value);

    } catch (error) {

        console.error(error);

        saveGradeBtn.disabled = false;
        saveGradeBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Grade`;

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

function validateGradeForm() {

    clearErrors();
    let valid = true;

    const grade = document.getElementById("grade").value;

    if (grade === "") {
        showFieldError("grade", "Enter marks.");
        valid = false;
    } else if (Number(grade) < 0 || Number(grade) > 100) {
        showFieldError("grade", "Marks must be between 0 and 100.");
        valid = false;
    }

    return valid;

}