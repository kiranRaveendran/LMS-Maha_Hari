document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const ADMIN_COURSES_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/courses/`;

let tableBody;
let courseCount;
let allCourses = [];

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("courseTableBody");
    courseCount = document.getElementById("courseCount");

    document.getElementById("searchInput").addEventListener("keyup", searchCourses);

    loadCourses();

}

async function loadCourses() {

    try {

        const response = await api.get(ADMIN_COURSES_ENDPOINT, {
            headers: API.headers()
        });

        allCourses = response.data;
        renderTable(allCourses);

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

    courseCount.textContent = courses.length;

    if (courses.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-book fs-1"></i><br><br>
            No Courses Found
        </td></tr>`;
        return;
    }

    tableBody.innerHTML = "";

    courses.forEach((course, index) => {

        tableBody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${course.code}</strong></td>
            <td>${course.name}</td>
            <td>${course.faculty_username || `<span class="text-muted">Unassigned</span>`}</td>
            <td>${course.batch_name || `<span class="text-muted">—</span>`}</td>
            <td>${course.description || `<span class="text-muted">—</span>`}</td>
        </tr>
        `;

    });

}

function searchCourses() {

    const keyword = document.getElementById("searchInput").value.toLowerCase();

    const filtered = allCourses.filter(course =>
        course.name.toLowerCase().includes(keyword) ||
        course.code.toLowerCase().includes(keyword) ||
        (course.faculty_username || "").toLowerCase().includes(keyword)
    );

    renderTable(filtered);

}