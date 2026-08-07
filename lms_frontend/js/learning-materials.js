document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const MATERIALS_ENDPOINT = `${API.BASE_URL}/api/faculty/learning-materials/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/faculty/dashboard/`;

let materialModal;
let deleteMaterialModal;
let tableBody;
let addMaterialBtn;
let saveMaterialBtn;
let confirmDeleteBtn;
let courseSelect;

let editingMaterialId = null;
let deleteMaterialId = null;
let allCourses = [];

// ===============================
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("materialTableBody");
    addMaterialBtn = document.getElementById("addMaterialBtn");
    saveMaterialBtn = document.getElementById("saveMaterialBtn");
    confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    courseSelect = document.getElementById("course");

    materialModal = new bootstrap.Modal(document.getElementById("materialModal"));
    deleteMaterialModal = new bootstrap.Modal(document.getElementById("deleteMaterialModal"));

    registerEvents();

    loadCourses();
    loadMaterials();

}

function registerEvents() {

    addMaterialBtn.addEventListener("click", openAddModal);
    saveMaterialBtn.addEventListener("click", saveMaterial);
    confirmDeleteBtn.addEventListener("click", deleteMaterial);

}

// ===============================
// Courses (for the dropdown) — reuses the dashboard endpoint
// rather than a dedicated one, since it already returns this faculty's courses
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
        // Non-fatal — the material list can still load even if this fails.

    }

}

// ===============================
// Modals
// ===============================

function openAddModal() {

    editingMaterialId = null;

    document.getElementById("materialForm").reset();
    clearErrors();
    document.getElementById("materialId").value = "";
    document.getElementById("modalTitle").textContent = "Upload Material";
    document.getElementById("file").required = true;
    document.getElementById("fileHint").textContent = "Required.";

    materialModal.show();

}

async function editMaterial(id) {

    try {

        const response = await api.get(`${MATERIALS_ENDPOINT}${id}/`, {
            headers: API.headers()
        });

        const material = response.data;

        editingMaterialId = id;
        clearErrors();

        document.getElementById("modalTitle").textContent = "Edit Material";
        document.getElementById("title").value = material.title;
        document.getElementById("course").value = material.course;
        document.getElementById("file").value = "";
        document.getElementById("fileHint").textContent = "Leave empty to keep the current file.";

        materialModal.show();

    } catch (error) {

        console.error(error);
        alert("Unable to load material.");

    }

}

// ===============================
// Load + render list
// ===============================

async function loadMaterials() {

    showLoading();

    try {

        const response = await api.get(MATERIALS_ENDPOINT, {
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

function renderTable(materials) {

    if (!materials || materials.length === 0) {
        showEmptyState();
        return;
    }

    tableBody.innerHTML = "";

    materials.forEach((material, index) => {

        const course = allCourses.find(c => c.id === material.course);
        const courseLabel = course ? `${course.name} (${course.code})${course.batch_name ? " — " + course.batch_name : ""}` : `Course #${material.course}`;
        const uploadedDate = new Date(material.uploaded_at).toLocaleDateString();

        tableBody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${material.title}</strong></td>
            <td>${courseLabel}</td>
            <td>
                <a href="${material.file}" target="_blank" class="text-primary">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>View
                </a>
            </td>
            <td>${uploadedDate}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2 edit-btn" data-id="${material.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${material.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `;

    });

    document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", () => editMaterial(button.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteMaterialId = button.dataset.id;
            deleteMaterialModal.show();
        });
    });

}

function showLoading() {
    tableBody.innerHTML = `
    <tr><td colspan="6" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-3">Loading Learning Materials...</p>
    </td></tr>`;
}

function showEmptyState() {
    tableBody.innerHTML = `
    <tr><td colspan="6" class="text-center py-5 text-muted">
        <i class="bi bi-journal-x fs-1"></i><br><br>
        No Learning Materials Found
    </td></tr>`;
}

function showError() {
    tableBody.innerHTML = `
    <tr><td colspan="6" class="text-center text-danger py-5">
        Failed to load Learning Materials.
    </td></tr>`;
}

// ===============================
// Save (create or edit) — multipart, since file upload is involved
// ===============================

async function saveMaterial() {

    if (!validateMaterialForm()) {
        return;
    }

    saveMaterialBtn.disabled = true;
    saveMaterialBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const title = document.getElementById("title").value.trim();
    const course = document.getElementById("course").value;
    const fileInput = document.getElementById("file");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("course", course);

    if (fileInput.files.length > 0) {
        formData.append("file", fileInput.files[0]);
    }

    try {

        if (editingMaterialId) {
            await api.patch(`${MATERIALS_ENDPOINT}${editingMaterialId}/`, formData, {
                headers: API.headers()
            });
        } else {
            await api.post(MATERIALS_ENDPOINT, formData, {
                headers: API.headers()
            });
        }

        materialModal.hide();
        document.getElementById("materialForm").reset();

        showSuccessMessage(
            editingMaterialId ? "Material updated successfully." : "Material uploaded successfully."
        );

        editingMaterialId = null;

        saveMaterialBtn.disabled = false;
        saveMaterialBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Material`;

        loadMaterials();

    } catch (error) {

        console.error(error);

        saveMaterialBtn.disabled = false;
        saveMaterialBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Material`;

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
// Delete
// ===============================

async function deleteMaterial() {

    try {

        await api.delete(`${MATERIALS_ENDPOINT}${deleteMaterialId}/`, {
            headers: API.headers()
        });

        deleteMaterialModal.hide();
        showSuccessMessage("Material deleted successfully.");
        loadMaterials();

    } catch (error) {

        console.error(error);
        alert("Failed to delete material.");

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

function validateMaterialForm() {

    clearErrors();
    let valid = true;

    const title = document.getElementById("title").value.trim();
    const course = document.getElementById("course").value;
    const fileInput = document.getElementById("file");

    if (!title) {
        showFieldError("title", "Title is required.");
        valid = false;
    }

    if (!course) {
        showFieldError("course", "Please select a course.");
        valid = false;
    }

    // File only required when creating new, not when editing
    if (!editingMaterialId && fileInput.files.length === 0) {
        showFieldError("file", "Please choose a file to upload.");
        valid = false;
    }

    return valid;

}