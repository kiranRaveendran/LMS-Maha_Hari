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
let loadRosterBtn;
let rosterContainer;
let saveRosterWrapper;
let saveRosterBtn;
let recordsTableBody;

let editMarkModal;

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
    examTypeSelect = document.getElementById("examTypeSelect");
    loadRosterBtn = document.getElementById("loadRosterBtn");
    rosterContainer = document.getElementById("rosterContainer");
    saveRosterWrapper = document.getElementById("saveRosterWrapper");
    saveRosterBtn = document.getElementById("saveRosterBtn");
    recordsTableBody = document.getElementById("recordsTableBody");

    editMarkModal = new bootstrap.Modal(document.getElementById("editMarkModal"));

    registerEvents();
    loadCourses();

}

function registerEvents() {

    loadRosterBtn.addEventListener("click", loadRoster);
    saveRosterBtn.addEventListener("click", saveRoster);
    courseSelect.addEventListener("change", loadRecords);
    document.getElementById("editMarkSaveBtn").addEventListener("click", saveEditedMark);

}

// ===============================
// Courses dropdown
// ===============================

async function loadCourses() {

    try {

        const response = await axios.get(DASHBOARD_ENDPOINT, {
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
        alert("Please select a course and exam type.");
        return;
    }

    rosterContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
        </div>`;

    try {

        const response = await axios.get(ROSTER_ENDPOINT, {
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
                        <th style="width:180px;">Marks</th>
                    </tr>
                </thead>
                <tbody>
                    ${roster.map(entry => `
                        <tr>
                            <td>${entry.student_username}</td>
                            <td>
                                <input
                                    type="number" step="0.01" min="0"
                                    class="form-control roster-marks-input"
                                    data-student="${entry.student}"
                                    value="${entry.marks !== null && entry.marks !== undefined ? entry.marks : ""}"
                                    placeholder="Not entered">
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
    const examType = examTypeSelect.value;

    const records = Array.from(document.querySelectorAll(".roster-marks-input"))
        .map(input => {
            const value = input.value.trim();
            return value !== "" ? { student: input.dataset.student, marks: value } : null;
        })
        .filter(Boolean);

    if (records.length === 0) {
        alert("Enter marks for at least one student before saving.");
        return;
    }

    saveRosterBtn.disabled = true;
    saveRosterBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await axios.post(BULK_SAVE_ENDPOINT, {
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
        alert("Failed to save marks.");

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
        <tr><td colspan="5" class="text-center py-5 text-muted">
            Select a course above to see its marks records.
        </td></tr>`;
        return;
    }

    recordsTableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const response = await axios.get(MARKS_ENDPOINT, {
            headers: API.headers(),
            params: { course: courseId }
        });

        renderRecords(response.data);

    } catch (error) {

        console.error(error);
        recordsTableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-danger py-5">
            Failed to load records.
        </td></tr>`;

    }

}

function renderRecords(records) {

    if (!records || records.length === 0) {
        recordsTableBody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
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

        await axios.delete(`${MARKS_ENDPOINT}${id}/`, {
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

function openEditMarkModal(data) {

    document.getElementById("editMarkId").value = data.id;
    document.getElementById("editMarkSubtitle").textContent = `${data.student} — ${data.examType}`;
    document.getElementById("editMarkValue").value = data.marks;
    document.getElementById("editMarkError").textContent = "";

    editMarkModal.show();

}

async function saveEditedMark() {

    const id = document.getElementById("editMarkId").value;
    const value = document.getElementById("editMarkValue").value;

    if (value === "" || Number(value) < 0) {
        document.getElementById("editMarkError").textContent = "Enter a valid mark.";
        return;
    }

    const saveBtn = document.getElementById("editMarkSaveBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        await axios.patch(`${MARKS_ENDPOINT}${id}/`, { marks: value }, {
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