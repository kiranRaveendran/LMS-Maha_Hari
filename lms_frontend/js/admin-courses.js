document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const ADMIN_COURSES_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/courses/`;

let tableBody;
let courseCount;

let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;
let searchQuery = "";
let searchDebounceTimer = null;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("courseTableBody");
    courseCount = document.getElementById("courseCount");

    document.getElementById("searchInput").addEventListener("keyup", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchQuery = document.getElementById("searchInput").value.trim();
            loadCourses(1);
        }, 350);
    });

    loadCourses(1);

}

async function loadCourses(page = 1) {

    currentPage = page;

    try {

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (searchQuery) {
            params.search = searchQuery;
        }

        const response = await api.get(ADMIN_COURSES_ENDPOINT, { params });

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
        <tr><td colspan="6" class="text-center text-danger py-5">
            Failed to load courses.
        </td></tr>`;

    }

}

function renderTable(courses) {

    courseCount.textContent = totalCount;

    if (courses.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-book fs-1"></i><br><br>
            No Courses Found
        </td></tr>`;
        document.getElementById("showingRangeText").textContent = "Showing 0 of 0";
        document.getElementById("coursesPagination").innerHTML = "";
        return;
    }

    tableBody.innerHTML = "";

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    courses.forEach((course, i) => {

        tableBody.innerHTML += `
        <tr>
            <td>${startIndex + i + 1}</td>
            <td><strong>${course.code}</strong></td>
            <td>${course.name}</td>
            <td>${course.faculty_username || `<span class="text-muted">Unassigned</span>`}</td>
            <td>${course.batch_name || `<span class="text-muted">—</span>`}</td>
            <td>${course.description || `<span class="text-muted">—</span>`}</td>
        </tr>
        `;

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