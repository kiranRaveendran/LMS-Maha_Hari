document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const MATERIALS_ENDPOINT = `${API.BASE_URL}/api/student/learning-materials/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

let tableBody;
let courseFilter;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("materialTableBody");
    courseFilter = document.getElementById("courseFilter");

    courseFilter.addEventListener("change", loadMaterials);

    loadCourseFilter();
    loadMaterials();

}

// Populate the course filter from the dashboard endpoint's enrolled
// courses list — avoids needing a separate "my courses" endpoint.
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

async function loadMaterials() {

    tableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </td></tr>`;

    try {

        const courseId = courseFilter.value;
        const url = courseId ? `${MATERIALS_ENDPOINT}?course=${courseId}` : MATERIALS_ENDPOINT;

        const response = await api.get(url);
        renderTable(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-danger py-5">
            Failed to load learning materials.
        </td></tr>`;

    }

}

function renderTable(materials) {

    if (!materials || materials.length === 0) {
        tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center py-5 text-muted">
            <i class="bi bi-journal-x fs-1"></i><br><br>
            No learning materials available yet.
        </td></tr>`;
        return;
    }

    tableBody.innerHTML = "";

    materials.forEach((material, index) => {

        const uploadedDate = new Date(material.uploaded_at).toLocaleDateString();

        tableBody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${material.title}</strong></td>
            <td>${material.course_name} <span class="text-muted small">(${material.course_code})</span></td>
            <td>${uploadedDate}</td>
            <td class="text-center">
                <a href="${material.file}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>View / Download
                </a>
            </td>
        </tr>
        `;

    });

}