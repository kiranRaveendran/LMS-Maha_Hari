document.addEventListener("DOMContentLoaded", () => {

    initialize();

});


// ===============================
// Global Variables
// ===============================

let token;

let managerModal;

let tableBody;

let managerCount;

let addManagerBtn;

let saveManagerBtn;

let editingManagerId = null;

let deleteManagerId = null;

let deleteManagerModal;

let confirmDeleteBtn;

// Pagination + search state
let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;
let searchQuery = "";
let searchDebounceTimer = null;


// ===============================
// Initialize
// ===============================

function initialize(){

    token = API.token();

    if(!token){
        window.location.href = "/login.html";
        return;
    }

    tableBody = document.getElementById("managerTableBody");
    managerCount = document.getElementById("managerCount");
    addManagerBtn = document.getElementById("addManagerBtn");
    saveManagerBtn = document.getElementById("saveManagerBtn");

    managerModal = new bootstrap.Modal(document.getElementById("managerModal"));

    registerEvents();

    loadManagers(1);

}

deleteManagerModal = new bootstrap.Modal(
    document.getElementById("deleteManagerModal")
);

confirmDeleteBtn = document.getElementById("confirmDeleteBtn");


// ===============================
// Events
// ===============================

function registerEvents(){

    addManagerBtn.addEventListener("click", openAddModal);
    saveManagerBtn.addEventListener("click", saveManager);

    document.getElementById("searchInput").addEventListener("keyup", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchQuery = document.getElementById("searchInput").value.trim();
            loadManagers(1);
        }, 350);
    });

    confirmDeleteBtn.addEventListener("click", deleteManager);

}


// ===============================
// Open Add Modal
// ===============================

function openAddModal(){

    editingManagerId = null;
    document.getElementById("managerForm").reset();
    clearErrors();
    document.getElementById("managerId").value = "";
    document.getElementById("modalTitle").textContent = "Add Student";
    managerModal.show();

}

async function editManager(id){

    try{

        const response = await api.get(`${API.BASE_URL}/api/accounts/students/${id}/`);

        const manager = response.data;

        editingManagerId = id;
        clearErrors();

        document.getElementById("modalTitle").textContent = "Edit Student";
        document.getElementById("username").value = manager.username;
        document.getElementById("email").value = manager.email;
        document.getElementById("phone").value = manager.phone || "";
        document.getElementById("password").value = "";

        managerModal.show();

    }
    catch(error){
        console.error(error);
        alert("Unable to load Student.");
    }

}


// ===============================
// Load Students (server-side paginated + searched)
// ===============================

async function loadManagers(page = 1){

    currentPage = page;
    showLoading();

    try{

        const params = { page: currentPage, limit: PAGE_SIZE };
        if (searchQuery) {
            params.search = searchQuery;
        }

        const response = await api.get(`${API.BASE_URL}/api/accounts/students/`, { params });

        totalCount = response.data.count;
        renderTable(response.data.results);
        renderShowingText(response.data.results.length);
        renderPagination();

    }
    catch(error){

        console.error(error);

        if(error.response?.status===401){
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        showError();

    }

}


// ===============================
// Table Render
// ===============================

function renderTable(managers){

    managerCount.textContent = totalCount;

    if(managers.length===0){
        showEmptyState();
        return;
    }

    tableBody.innerHTML="";

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    managers.forEach((manager, i)=>{

        tableBody.innerHTML += `
        <tr>
            <td>${startIndex + i + 1}</td>
            <td><strong>${manager.username}</strong></td>
            <td>${manager.email}</td>
            <td>${manager.phone ?? "-"}</td>
            <td><span class="badge bg-success">Active</span></td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2 edit-btn" data-id="${manager.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${manager.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `;

    });

    document.querySelectorAll(".edit-btn").forEach(button=>{
        button.addEventListener("click",()=>{ editManager(button.dataset.id); });
    });

    document.querySelectorAll(".delete-btn").forEach(button=>{
        button.addEventListener("click",()=>{
            deleteManagerId = button.dataset.id;
            deleteManagerModal.show();
        });
    });

}

function renderShowingText(resultsOnPage){

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

function renderPagination(){

    const container = document.getElementById("managersPagination");
    if (!container) return;

    renderPaginationControls(
        container,
        totalCount,
        currentPage,
        PAGE_SIZE,
        (page) => loadManagers(page)
    );

}

function showLoading(){

    tableBody.innerHTML = `
    <tr>
        <td colspan="6" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-3">Loading Students...</p>
        </td>
    </tr>
    `;

}

function showEmptyState(){

    tableBody.innerHTML = `
    <tr>
    <td colspan="6" class="text-center py-5 text-muted">
    <i class="bi bi-person-x fs-1"></i>
    <br><br>
    No Students Found
    </td>
    </tr>
    `;

    document.getElementById("showingRangeText").textContent = "Showing 0 of 0";
    document.getElementById("managersPagination").innerHTML = "";

}

function showError(){

    tableBody.innerHTML = `
    <tr>
    <td colspan="6" class="text-center text-danger py-5">
    Failed to load Students.
    </td>
    </tr>
    `;

}


// ===============================
// Create Student
// ===============================

async function saveManager(){

    if(!validateManagerForm()){
        return;
    }

    saveManagerBtn.disabled = true;
    saveManagerBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    const payload = { username, email, phone };
    if(password){ payload.password = password; }

    try{

        if(editingManagerId){
            await api.patch(`${API.BASE_URL}/api/accounts/students/${editingManagerId}/`, payload);
        }
        else{
            await api.post(`${API.BASE_URL}/api/accounts/students/`, payload);
        }

        managerModal.hide();
        document.getElementById("managerForm").reset();

        showSuccessMessage(
            editingManagerId
                ? "Student updated successfully."
                : "Student created successfully."
        );

        editingManagerId = null;

        saveManagerBtn.disabled = false;
        saveManagerBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Student`;

        loadManagers(editingManagerId ? currentPage : 1);

    }
    catch(error){

        console.error(error);

        saveManagerBtn.disabled = false;
        saveManagerBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save Student`;

        clearErrors();

        if(error.response?.data){

            const errors = error.response.data;

            Object.keys(errors).forEach(field=>{
                if(document.getElementById(field + "Error")){
                    showFieldError(
                        field,
                        Array.isArray(errors[field]) ? errors[field][0] : errors[field]
                    );
                }
            });

            return;

        }

        alert("Something went wrong.");

    }

}

// ===============================
// Delete Student
// ===============================

async function deleteManager(){

    try{

        await api.delete(`${API.BASE_URL}/api/accounts/students/${deleteManagerId}/`);

        deleteManagerModal.hide();
        showSuccessMessage("Student deleted successfully.");

        const isLastItemOnPage = tableBody.querySelectorAll("tr").length === 1;
        const nextPage = (isLastItemOnPage && currentPage > 1) ? currentPage - 1 : currentPage;

        loadManagers(nextPage);

    }
    catch(error){
        console.error(error);
        alert("Failed to delete Student.");
    }

}


// ===============================
// Success Message
// ===============================

function showSuccessMessage(message){

    const successBox = document.getElementById("successMessage");

    successBox.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${message}`;
    successBox.classList.remove("d-none");

    setTimeout(()=>{
        successBox.classList.add("d-none");
    },3000);

}


// ===============================
// Validation
// ===============================

function clearErrors(){

    document.querySelectorAll(".text-danger").forEach(el=>el.textContent="");
    document.querySelectorAll(".form-control").forEach(el=>el.classList.remove("is-invalid"));

}

function showFieldError(field,message){

    document.getElementById(field+"Error").textContent = message;
    document.getElementById(field).classList.add("is-invalid");

}

function validateManagerForm(){

    clearErrors();

    let valid=true;

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    if(!username){
        showFieldError("username", "Username is required.");
        valid=false;
    }

    if(!email){
        showFieldError("email", "Email is required.");
        valid=false;
    }

    if(!editingManagerId && !password){
        showFieldError("password", "Password is required.");
        valid = false;
    }

    if(!phone){
        showFieldError("phone", "Phone number is required.");
        valid=false;
    }
    else if(!/^\d{10}$/.test(phone)){
        showFieldError("phone", "Enter valid 10 digit phone number.");
        valid=false;
    }

    return valid;

}