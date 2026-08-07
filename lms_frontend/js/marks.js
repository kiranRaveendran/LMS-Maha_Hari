document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const MARKS_ENDPOINT = `${API.BASE_URL}/api/faculty/exam-marks/`;
const ROSTER_ENDPOINT = `${API.BASE_URL}/api/faculty/exam-marks/roster/`;
const BULK_SAVE_ENDPOINT = `${API.BASE_URL}/api/faculty/exam-marks/bulk-save/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

const EXAM_TYPE_LABELS = {
    INTERNAL: "Internal",
    MODEL: "Model",
    FINAL: "Final",
};

let courseSelect;
let examTypeSelect;
let rosterContainer;
let saveRosterWrapper;
let saveRosterBtn;
let recordsTableBody;

let editMarkModal;

let allCourses = [];
let currentRoster = [];

// ===============================
// Letter grade mapping — same scale as Submissions. Display only,
// the stored value is always the numeric marks (0-100).
// ===============================

function getLetterGrade(marks) {

    const m = Number(marks);
    if (marks === null || marks === undefined || marks === "" || isNaN(m)) return null;

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
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseSelect = document.getElementById("courseSelect");
    examTypeSelect = document.getElementById("examTypeSelect");
    rosterContainer = document.getElementById("rosterContainer");
    saveRosterWrapper = document.getElementById("saveRosterWrapper");
    saveRosterBtn = document.getElementById("saveRosterBtn");
    recordsTableBody = document.getElementById("recordsTableBody");

    editMarkModal = new bootstrap.Modal(document.getElementById("editMarkModal"));
    document.getElementById("editMarkValue").addEventListener("input", updateEditMarkGradePreview);

    registerEvents();
    loadCourses();

}

function registerEvents() {

    saveRosterBtn.addEventListener("click", saveRoster);
    courseSelect.addEventListener("change", () => { loadRecords(); maybeAutoLoadRoster(); });
    examTypeSelect.addEventListener("change", maybeAutoLoadRoster);
    document.getElementById("editMarkSaveBtn").addEventListener("click", saveEditedMark);

}

// Auto-loads the roster via AJAX as soon as both a course and exam type
// are selected — no need to click Load manually. The button still works
// too, as a manual re-fetch/refresh option.
function maybeAutoLoadRoster() {
    if (courseSelect.value && examTypeSelect.value) {
        loadRoster();
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

        courseSelect.innerHTML = `<option value="">Select a course...</option>` +
            allCourses.map(c => `<option value="${c.id}">${c.name} (${c.code})${c.batch_name ? " — " + c.batch_name : ""}</option>`).join("");

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Roster (entry interface)
// ===============================

async function loadRoster() {

    const courseId = courseSelect.value;
    const examType = examTypeSelect.value;

    if (!courseId || !examType) {
        showSuccessMessage("Please select a course and exam type.", true);
        return;
    }

    rosterContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`;

    try {

        const response = await api.get(ROSTER_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId, exam_type: examType }
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
                        <th style="width:180px;">Marks (out of 100)</th>
                        <th style="width:100px;">Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${roster.map(entry => `
                        <tr>
                            <td>${entry.student_username}</td>
                            <td>
                                <input
                                    type="number" step="0.01" min="0" max="100"
                                    class="form-control roster-marks-input"
                                    data-student="${entry.student}"
                                    value="${entry.marks !== null && entry.marks !== undefined ? entry.marks : ""}"
                                    placeholder="Not entered">
                            </td>
                            <td>
                                <span class="badge ${getLetterGradeBadgeClass(getLetterGrade(entry.marks))} roster-grade-badge" data-student="${entry.student}">
                                    ${getLetterGrade(entry.marks) || "—"}
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    saveRosterWrapper.style.display = "block";

    document.querySelectorAll(".roster-marks-input").forEach(input => {
        input.addEventListener("input", () => {
            const badge = document.querySelector(`.roster-grade-badge[data-student="${input.dataset.student}"]`);
            const letter = getLetterGrade(input.value);
            badge.textContent = letter || "—";
            badge.className = `badge ${getLetterGradeBadgeClass(letter)} roster-grade-badge`;
            badge.dataset.student = input.dataset.student;
        });
    });

}

async function saveRoster() {

    const courseId = courseSelect.value;
    const examType = examTypeSelect.value;

    const records = Array.from(document.querySelectorAll(".roster-marks-input"))
        .map(input => {
            const value = input.value.trim();
            return value !== "" ? { student: input.dataset.student, marks: value } : null;
        })
        .filter(Boolean);

    const invalid = records.some(r => Number(r.marks) < 0 || Number(r.marks) > 100);
    if (invalid) {
        showSuccessMessage("All marks must be between 0 and 100.", true);
        return;
    }

    if (records.length === 0) {
        showSuccessMessage("Enter marks for at least one student before saving.", true);
        return;
    }

    saveRosterBtn.disabled = true;
    saveRosterBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await api.post(BULK_SAVE_ENDPOINT, {
            course: courseId,
            exam_type: examType,
            records: records
        }, {
            headers: API.headers()
        });

        showSuccessMessage("Marks saved successfully.");
        loadRoster();
        loadRecords();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to save marks.", true);

    } finally {

        saveRosterBtn.disabled = false;
        saveRosterBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Marks`;

    }

}

// ===============================
// Records list
// ===============================

async function loadRecords() {

    const courseId = courseSelect.value;

    if (!courseId) {
        recordsTableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
            Select a course above to see its marks records.
        </td></tr>`;
        return;
    }

    recordsTableBody.innerHTML = `
    <tr><td colspan="6" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const response = await api.get(MARKS_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId }
        });

        renderRecords(response.data);

    } catch (error) {

        console.error(error);
        recordsTableBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-danger py-5">
            Failed to load records.
        </td></tr>`;

    }

}

function renderRecords(records) {

    if (!records || records.length === 0) {
        recordsTableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-clipboard-x fs-1"></i><br><br>
            No marks recorded yet for this course.
        </td></tr>`;
        return;
    }

    recordsTableBody.innerHTML = "";

    records.forEach((record, index) => {

        recordsTableBody.innerHTML += `
        <tr data-row-id="${record.id}">
            <td>${index + 1}</td>
            <td>${record.student_username}</td>
            <td>${EXAM_TYPE_LABELS[record.exam_type] || record.exam_type}</td>
            <td>${record.marks}</td>
            <td><span class="badge ${getLetterGradeBadgeClass(getLetterGrade(record.marks))}">${getLetterGrade(record.marks) || "—"}</span></td>
            <td class="text-center actions-cell">
                <button class="btn btn-sm btn-outline-primary me-2 edit-mark-btn"
                    data-id="${record.id}"
                    data-student="${record.student_username}"
                    data-exam-type="${EXAM_TYPE_LABELS[record.exam_type] || record.exam_type}"
                    data-marks="${record.marks}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-mark-btn" data-id="${record.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `;

    });

    document.querySelectorAll(".edit-mark-btn").forEach(button => {
        button.addEventListener("click", () => openEditMarkModal(button.dataset));
    });

    document.querySelectorAll(".delete-mark-btn").forEach(button => {
        button.addEventListener("click", () => showInlineDeleteConfirm(button));
    });

}

// Inline confirm-in-row delete — avoids stacking a second modal
// (learned from the Attendance page's earlier UX issue).
function showInlineDeleteConfirm(button) {

    const cell = button.closest(".actions-cell");
    const recordId = button.dataset.id;

    cell.innerHTML = `
        <span class="small text-muted me-2">Delete this?</span>
        <button class="btn btn-sm btn-outline-secondary me-1 cancel-delete-btn">Cancel</button>
        <button class="btn btn-sm btn-danger confirm-delete-btn">Yes</button>
    `;

    cell.querySelector(".cancel-delete-btn").addEventListener("click", () => loadRecords());
    cell.querySelector(".confirm-delete-btn").addEventListener("click", () => deleteMark(recordId));

}

async function deleteMark(id) {

    try {

        await api.delete(`${MARKS_ENDPOINT}${id}/`, {
            headers: API.headers()
        });

        showSuccessMessage("Mark deleted.");
        loadRecords();

    } catch (error) {

        console.error(error);
        showSuccessMessage("Failed to delete mark.", true);

    }

}

// ===============================
// Edit single mark modal
// ===============================

function updateEditMarkGradePreview() {

    const value = document.getElementById("editMarkValue").value;
    const preview = document.getElementById("editMarkGradePreview");
    const letter = getLetterGrade(value);

    preview.textContent = letter || "—";
    preview.className = `badge ${getLetterGradeBadgeClass(letter)}`;

}

function openEditMarkModal(data) {

    document.getElementById("editMarkId").value = data.id;
    document.getElementById("editMarkSubtitle").textContent = `${data.student} — ${data.examType}`;
    document.getElementById("editMarkValue").value = data.marks;
    document.getElementById("editMarkError").textContent = "";

    updateEditMarkGradePreview();

    editMarkModal.show();

}

async function saveEditedMark() {

    const id = document.getElementById("editMarkId").value;
    const value = document.getElementById("editMarkValue").value;

    if (value === "" || Number(value) < 0 || Number(value) > 100) {
        document.getElementById("editMarkError").textContent = "Marks must be between 0 and 100.";
        return;
    }

    const saveBtn = document.getElementById("editMarkSaveBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await api.patch(`${MARKS_ENDPOINT}${id}/`, { marks: value }, {
            headers: API.headers()
        });

        editMarkModal.hide();
        showSuccessMessage("Mark updated.");
        loadRecords();

    } catch (error) {

        console.error(error);
        document.getElementById("editMarkError").textContent = "Failed to save.";

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save`;

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