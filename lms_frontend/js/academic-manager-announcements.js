// ===============================================================
// Academic Manager — Announcements page. Full CRUD against the
// existing /api/academic-manager/announcements/ endpoint (this
// endpoint already existed server-side; only this page was missing).
// Server-paginated, same list + pagination shape as
// js/admin-leave-requests.js / js/academic-manager-leave-approvals.js.
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const COURSES_URL = `${API.BASE_URL}/api/academic-manager/courses/`;
const ANNOUNCEMENTS_URL = `${API.BASE_URL}/api/academic-manager/announcements/`;
const PAGE_SIZE = 10;

let courseFilter;
let tableBody;
let announcementModal;
let deleteModal;
let form;
let formError;

let currentPage = 1;
let totalCount = 0;
let pendingDeleteId = null;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseFilter = document.getElementById("courseFilter");
    tableBody = document.getElementById("announcementsTableBody");
    announcementModal = new bootstrap.Modal(document.getElementById("announcementModal"));
    deleteModal = new bootstrap.Modal(document.getElementById("deleteAnnouncementModal"));
    form = document.getElementById("announcementForm");
    formError = document.getElementById("announcementFormError");

    courseFilter.addEventListener("change", () => loadAnnouncements(1));
    document.getElementById("openCreateBtn").addEventListener("click", openCreateModal);
    form.addEventListener("submit", submitAnnouncementForm);
    document.getElementById("confirmDeleteAnnouncementBtn").addEventListener("click", confirmDelete);

    loadCourseOptions();
    loadAnnouncements(1);

}

async function loadCourseOptions() {

    try {

        const response = await api.get(COURSES_URL, { params: { limit: 100 } });
        const courses = response.data.results || [];

        const optionsHtml = courses.map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join("");

        courseFilter.innerHTML = `<option value="">All courses</option>` + optionsHtml;
        document.getElementById("announcementCourse").innerHTML =
            `<option value="">— Select a course —</option>` + optionsHtml;

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Failed to load courses."), true);

    }

}

async function loadAnnouncements(page = 1) {

    currentPage = page;

    tableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (courseFilter.value) params.course = courseFilter.value;

        const response = await api.get(ANNOUNCEMENTS_URL, { params });

        totalCount = response.data.count;
        renderTable(response.data.results);
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
        <tr><td colspan="5" class="text-center text-danger py-5">
            Failed to load announcements.
        </td></tr>`;

    }

}

function renderTable(records) {

    if (!records || records.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
            <i class="bi bi-megaphone fs-1"></i><br><br>
            No announcements yet.
        </td></tr>`;
        document.getElementById("showingRangeText").textContent = "Showing 0 of 0";
        document.getElementById("announcementsPagination").innerHTML = "";
        return;
    }

    tableBody.innerHTML = records.map(a => `
        <tr>
            <td><strong>${a.course_code}</strong> — ${a.course_name}</td>
            <td>${a.title}</td>
            <td class="text-truncate" style="max-width: 320px;">${a.message}</td>
            <td>${new Date(a.created_at).toLocaleDateString()}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-secondary me-2 edit-btn" data-id="${a.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${a.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    tableBody.dataset.records = JSON.stringify(records);

    document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", () => openEditModal(button.dataset.id, records));
    });

    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", () => openDeleteModal(button.dataset.id));
    });

}

function renderShowingText(resultsOnPage) {

    const el = document.getElementById("showingRangeText");

    if (totalCount === 0) {
        el.textContent = "Showing 0 of 0";
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + resultsOnPage - 1;

    el.textContent = `Showing ${start}–${end} of ${totalCount}`;

}

function renderPagination() {

    renderPaginationControls(
        document.getElementById("announcementsPagination"),
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadAnnouncements(page)
    );

}

function openCreateModal() {

    form.reset();
    document.getElementById("announcementId").value = "";
    document.getElementById("announcementModalTitle").textContent = "New Announcement";
    formError.textContent = "";

    announcementModal.show();

}

function openEditModal(id, records) {

    const announcement = records.find(a => String(a.id) === String(id));
    if (!announcement) return;

    form.reset();
    document.getElementById("announcementId").value = announcement.id;
    document.getElementById("announcementModalTitle").textContent = "Edit Announcement";
    document.getElementById("announcementCourse").value = announcement.course;
    document.getElementById("announcementTitle").value = announcement.title;
    document.getElementById("announcementMessage").value = announcement.message;
    formError.textContent = "";

    announcementModal.show();

}

async function submitAnnouncementForm(e) {

    e.preventDefault();

    formError.textContent = "";

    const id = document.getElementById("announcementId").value;
    const payload = {
        course: document.getElementById("announcementCourse").value,
        title: document.getElementById("announcementTitle").value.trim(),
        message: document.getElementById("announcementMessage").value.trim(),
    };

    const saveBtn = document.getElementById("saveAnnouncementBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {

        if (id) {
            await api.patch(`${ANNOUNCEMENTS_URL}${id}/`, payload);
        } else {
            await api.post(ANNOUNCEMENTS_URL, payload);
        }

        announcementModal.hide();
        showToast(id ? "Announcement updated." : "Announcement posted.");
        loadAnnouncements(currentPage);

    } catch (error) {

        console.error(error);
        formError.textContent = extractApiError(error, "Failed to save announcement.");

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

        await api.delete(`${ANNOUNCEMENTS_URL}${pendingDeleteId}/`);

        deleteModal.hide();
        showToast("Announcement deleted.");
        loadAnnouncements(currentPage);

    } catch (error) {

        console.error(error);
        showToast(extractApiError(error, "Failed to delete announcement."), true);

    } finally {

        pendingDeleteId = null;

    }

}
