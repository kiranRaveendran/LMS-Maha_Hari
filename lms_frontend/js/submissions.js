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

        const response = await axios.get(ASSIGNMENTS_ENDPOINT, {
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

        const response = await axios.get(url, {
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

    submissions.forEach((submission, index) => {

        const submittedDate = new Date(submission.submitted_at).toLocaleString();
        const gradeDisplay = submission.grade !== null && submission.grade !== undefined
            ? submission.grade
            : `<span class="text-muted">Not graded</span>`;

        tableBody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${submission.student_username}</strong></td>
            <td>${submission.assignment_title}</td>
            <td>
                <a href="${submission.file}" target="_blank" class="text-primary">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>View
                </a>
            </td>
            <td>${submittedDate}</td>
            <td>${gradeDisplay}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary grade-btn" data-id="${submission.id}">
                    <i class="bi bi-pencil-square me-1"></i>Grade
                </button>
            </td>
        </tr>
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
    <tr><td colspan="7" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-3">Loading Submissions...</p>
    </td></tr>`;
}

function showEmptyState() {
    tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-5 text-muted">
        <i class="bi bi-inbox fs-1"></i><br><br>
        No Submissions Found
    </td></tr>`;
}

function showError() {
    tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center text-danger py-5">
        Failed to load Submissions.
    </td></tr>`;
}

// ===============================
// Grade modal
// ===============================

function openGradeModal(submission) {

    editingSubmissionId = submission.id;
    clearErrors();

    document.getElementById("gradeStudentName").textContent = submission.student_username;
    document.getElementById("gradeAssignmentTitle").textContent = submission.assignment_title;
    document.getElementById("gradeFileLink").href = submission.file;
    document.getElementById("grade").value = submission.grade ?? "";
    document.getElementById("feedback").value = submission.feedback ?? "";

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

        await axios.patch(`${SUBMISSIONS_ENDPOINT}${editingSubmissionId}/`, payload, {
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

    if (grade === "" || Number(grade) < 0) {
        showFieldError("grade", "Enter a valid grade.");
        valid = false;
    }

    return valid;

}