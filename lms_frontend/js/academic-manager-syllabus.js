// ===============================================================
// Academic Manager — Syllabus page. Create/allocate syllabus topics
// per course and track completion status. Topic list for the
// selected course is NOT server-paginated (mirrors
// js/leave-history.js's approach for a bounded per-course list) —
// a course's syllabus is a short, fixed set of sessions, not a
// growing log, so there's no need for page controls here.
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const COURSES_URL = `${API.BASE_URL}/api/academic-manager/courses/`;
const SYLLABUS_URL = `${API.BASE_URL}/api/academic-manager/syllabus-topics/`;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    COMPLETED: `<span class="badge bg-success">Completed</span>`,
};

let courseSelect;
let tableBody;
let topicModal;
let deleteModal;
let form;
let formError;

let currentCourseId = null;
let topics = [];
let pendingDeleteId = null;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseSelect = document.getElementById("courseSelect");
    tableBody = document.getElementById("syllabusTableBody");
    topicModal = new bootstrap.Modal(document.getElementById("topicModal"));
    deleteModal = new bootstrap.Modal(document.getElementById("deleteTopicModal"));
    form = document.getElementById("topicForm");
    formError = document.getElementById("topicFormError");

    courseSelect.addEventListener("change", onCourseChange);
    document.getElementById("openCreateTopicBtn").addEventListener("click", openCreateModal);
    form.addEventListener("submit", submitTopicForm);
    document.getElementById("confirmDeleteTopicBtn").addEventListener("click", confirmDelete);

    loadCourseOptions();

}

async function loadCourseOptions() {

    try {

        const response = await api.get(COURSES_URL, { params: { limit: 100 } });
        const courses = response.data.results || [];

        courseSelect.innerHTML = `<option value="">— Select a course —</option>` +
            courses.map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join("");

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Failed to load courses."), true);

    }

}

function onCourseChange() {

    currentCourseId = courseSelect.value || null;

    const openBtn = document.getElementById("openCreateTopicBtn");
    const noCourseEl = document.getElementById("noCourseSelected");
    const contentEl = document.getElementById("syllabusContent");

    if (!currentCourseId) {
        openBtn.disabled = true;
        noCourseEl.classList.remove("d-none");
        contentEl.classList.add("d-none");
        return;
    }

    openBtn.disabled = false;
    noCourseEl.classList.add("d-none");
    contentEl.classList.remove("d-none");

    loadTopics();

}

async function loadTopics() {

    tableBody.innerHTML = `
    <tr><td colspan="4" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const response = await api.get(SYLLABUS_URL, { params: { course: currentCourseId, limit: 100 } });
        topics = response.data.results || [];

        renderTopics();
        renderProgress();

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="4" class="text-center text-danger py-5">
            ${extractApiError(error, "Failed to load syllabus.")}
        </td></tr>`;

    }

}

function renderTopics() {

    if (!topics.length) {
        tableBody.innerHTML = `
        <tr><td colspan="4" class="text-center py-5 text-muted">
            <i class="bi bi-journal-x fs-1"></i><br><br>
            No topics added for this course yet.
        </td></tr>`;
        return;
    }

    const sorted = [...topics].sort((a, b) => a.session_number - b.session_number);

    tableBody.innerHTML = sorted.map(t => `
        <tr>
            <td>${t.session_number}</td>
            <td>${t.topic_name}</td>
            <td>${STATUS_BADGES[t.status] || t.status}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-secondary me-2 edit-btn" data-id="${t.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${t.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", () => openEditModal(button.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", () => openDeleteModal(button.dataset.id));
    });

}

function renderProgress() {

    const total = topics.length;
    const completed = topics.filter(t => t.status === "COMPLETED").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById("progressText").textContent = `${completed} of ${total} topics completed`;
    document.getElementById("progressBar").style.width = `${pct}%`;

}

function openCreateModal() {

    form.reset();
    document.getElementById("topicId").value = "";
    document.getElementById("topicModalTitle").textContent = "New Topic";
    document.getElementById("topicStatus").value = "PENDING";
    formError.textContent = "";

    // Default the session number to the next one in sequence, so
    // Academic Managers building out a syllabus session-by-session
    // don't have to compute it themselves each time.
    const nextSession = topics.length
        ? Math.max(...topics.map(t => t.session_number)) + 1
        : 1;
    document.getElementById("topicSessionNumber").value = nextSession;

    topicModal.show();

}

function openEditModal(id) {

    const topic = topics.find(t => String(t.id) === String(id));
    if (!topic) return;

    form.reset();
    document.getElementById("topicId").value = topic.id;
    document.getElementById("topicModalTitle").textContent = "Edit Topic";
    document.getElementById("topicSessionNumber").value = topic.session_number;
    document.getElementById("topicName").value = topic.topic_name;
    document.getElementById("topicStatus").value = topic.status;
    formError.textContent = "";

    topicModal.show();

}

async function submitTopicForm(e) {

    e.preventDefault();

    formError.textContent = "";

    const id = document.getElementById("topicId").value;
    const payload = {
        course: currentCourseId,
        session_number: document.getElementById("topicSessionNumber").value,
        topic_name: document.getElementById("topicName").value.trim(),
        status: document.getElementById("topicStatus").value,
    };

    const saveBtn = document.getElementById("saveTopicBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        if (id) {
            await api.patch(`${SYLLABUS_URL}${id}/`, payload);
        } else {
            await api.post(SYLLABUS_URL, payload);
        }

        topicModal.hide();
        showToast(id ? "Topic updated." : "Topic added.");
        loadTopics();

    } catch (error) {

        console.error(error);
        formError.textContent = extractApiError(error, "Failed to save topic.");

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save";

    }

}

function openDeleteModal(id) {
    pendingDeleteId = id;
    deleteModal.show();
}

async function confirmDelete() {

    if (!pendingDeleteId) return;

    try {

        await api.delete(`${SYLLABUS_URL}${pendingDeleteId}/`);

        deleteModal.hide();
        showToast("Topic deleted.");
        loadTopics();

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Failed to delete topic."), true);

    } finally {

        pendingDeleteId = null;

    }

}
