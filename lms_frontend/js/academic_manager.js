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

let allManagers = [];

let deleteManagerId = null;

let deleteManagerModal;

let confirmDeleteBtn;


// ===============================
// Initialize
// ===============================

function initialize(){


    token = API.token();


    if(!token){

        // was: window.location.href = "/api/accounts/";
        // that used to be a Django-rendered login page. Now it
        // needs to be a real static page in this same frontend
        // project, e.g. login.html
        window.location.href = "/login.html";

        return;

    }


    tableBody = document.getElementById(
        "managerTableBody"
    );


    managerCount = document.getElementById(
        "managerCount"
    );


    addManagerBtn = document.getElementById(
        "addManagerBtn"
    );


    saveManagerBtn = document.getElementById(
        "saveManagerBtn"
    );



    managerModal = new bootstrap.Modal(
        document.getElementById("managerModal")
    );



    registerEvents();


    loadManagers();

}

deleteManagerModal = new bootstrap.Modal(
    document.getElementById("deleteManagerModal")
);

confirmDeleteBtn =
    document.getElementById("confirmDeleteBtn");



// ===============================
// Events
// ===============================


function registerEvents(){


    addManagerBtn.addEventListener(
        "click",
        openAddModal
    );


    saveManagerBtn.addEventListener(
        "click",
        saveManager
    );

    document.getElementById("searchInput").addEventListener(

    "keyup",

    searchManagers

);

    confirmDeleteBtn.addEventListener(

    "click",

    deleteManager

);


}



// ===============================
// Open Add Modal
// ===============================

function openAddModal(){

    editingManagerId = null;

    document.getElementById("managerForm").reset();

    clearErrors();

    document.getElementById("managerId").value = "";

    document.getElementById("modalTitle").textContent =
        "Add Academic Manager";

    managerModal.show();

}

async function editManager(id){

    try{

        const response = await axios.get(

            `${API.BASE_URL}/api/accounts/academic-managers/${id}/`,

            {

                headers:{

                    Authorization:`Bearer ${token}`

                }

            }

        );

        const manager = response.data;

        editingManagerId = id;

        clearErrors();

        document.getElementById("modalTitle").textContent =
            "Edit Academic Manager";

        document.getElementById("username").value =
            manager.username;

        document.getElementById("email").value =
            manager.email;

        document.getElementById("phone").value =
            manager.phone || "";

        document.getElementById("password").value = "";

        managerModal.show();

    }

    catch(error){

        console.error(error);

        alert("Unable to load Academic Manager.");

    }

}




// ===============================
// Load Managers
// ===============================


async function loadManagers(){


    showLoading();


    try{


        const response = await axios.get(

            `${API.BASE_URL}/api/accounts/academic-managers/`,

            {
                headers:{
                    Authorization:
                    `Bearer ${token}`
                }
            }

        );


        allManagers = response.data;

        renderTable(allManagers);


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


    managerCount.textContent =
        managers.length;



    if(managers.length===0){

        showEmptyState();

        return;

    }



    tableBody.innerHTML="";



    managers.forEach((manager,index)=>{


        tableBody.innerHTML += `


        <tr>


            <td>${index+1}</td>



            <td>

                <strong>
                    ${manager.username}
                </strong>

            </td>



            <td>

                ${manager.email}

            </td>



            <td>

                ${manager.phone ?? "-"}

            </td>



            <td>

                <span class="badge bg-success">

                    Active

                </span>


            </td>




            <td class="text-center">


                <button
                    class="btn btn-sm btn-outline-primary me-2 edit-btn"
                    data-id="${manager.id}">

                    <i class="bi bi-pencil"></i>

                </button>

                <button
                    class="btn btn-sm btn-outline-danger delete-btn"
                    data-id="${manager.id}">

                    <i class="bi bi-trash"></i>

                </button>

                


            </td>


        </tr>


        `;


    });

// Edit buttons
document.querySelectorAll(".edit-btn").forEach(button=>{

    button.addEventListener("click",()=>{

        editManager(button.dataset.id);

    });

});

// Delete buttons
document.querySelectorAll(".delete-btn").forEach(button=>{

    button.addEventListener("click",()=>{

        deleteManagerId = button.dataset.id;

        deleteManagerModal.show();

    });

});

}
function searchManagers(){

    const keyword = document
        .getElementById("searchInput")
        .value
        .toLowerCase();

    const filtered = allManagers.filter(manager =>

        manager.username.toLowerCase().includes(keyword) ||

        manager.email.toLowerCase().includes(keyword) ||

        (manager.phone || "").includes(keyword)

    );

    renderTable(filtered);

}




function showLoading(){


    tableBody.innerHTML = `

    <tr>

        <td colspan="6"
        class="text-center py-5">


        <div class="spinner-border text-primary"></div>


        <p class="mt-3">

        Loading Academic Managers...

        </p>


        </td>

    </tr>

    `;


}





function showEmptyState(){


    tableBody.innerHTML = `

    <tr>

    <td colspan="6"
    class="text-center py-5 text-muted">


    <i class="bi bi-person-x fs-1"></i>


    <br><br>


    No Academic Managers Found


    </td>


    </tr>


    `;


}




function showError(){


    tableBody.innerHTML = `

    <tr>

    <td colspan="6"
    class="text-center text-danger py-5">


    Failed to load Academic Managers.


    </td>


    </tr>

    `;


}







// ===============================
// Create Manager
// ===============================


async function saveManager(){

    if(!validateManagerForm()){

        return;

    }
    saveManagerBtn.disabled = true;

saveManagerBtn.innerHTML = `

<span class="spinner-border spinner-border-sm me-2"></span>

Saving...

`;

    const username =
        document.getElementById("username").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const password =
        document.getElementById("password").value;

    const payload = {

        username,

        email,

        phone

    };

    if(password){

        payload.password = password;

    }

    try{

        let response;

        if(editingManagerId){

            response = await axios.patch(

                `${API.BASE_URL}/api/accounts/academic-managers/${editingManagerId}/`,

                payload,

                {

                    headers:{

                        Authorization:`Bearer ${token}`

                    }

                }

            );

        }

        else{

            response = await axios.post(

                `${API.BASE_URL}/api/accounts/academic-managers/`,

                payload,

                {

                    headers:{

                        Authorization:`Bearer ${token}`

                    }

                }

            );

        }

managerModal.hide();

document.getElementById("managerForm").reset();

showSuccessMessage(

    editingManagerId
        ? "Academic Manager updated successfully."
        : "Academic Manager created successfully."

);

editingManagerId = null;

saveManagerBtn.disabled = false;

saveManagerBtn.innerHTML = `

<i class="bi bi-check-circle me-2"></i>

Save Manager

`;

loadManagers();

    }

catch(error){

    console.error(error);

    saveManagerBtn.disabled = false;

    saveManagerBtn.innerHTML = `

        <i class="bi bi-check-circle me-2"></i>

        Save Manager

    `;

    clearErrors();

    if(error.response?.data){

        const errors = error.response.data;

        Object.keys(errors).forEach(field=>{

            if(document.getElementById(field + "Error")){

                showFieldError(

                    field,

                    Array.isArray(errors[field])
                        ? errors[field][0]
                        : errors[field]

                );

            }

        });

        return;

    }

    alert("Something went wrong.");

}

}

// deleteManager

async function deleteManager(){

    try{

        await axios.delete(

            `${API.BASE_URL}/api/accounts/academic-managers/${deleteManagerId}/`,

            {

                headers:{

                    Authorization:`Bearer ${token}`

                }

            }

        );

        deleteManagerModal.hide();

        showSuccessMessage(

            "Academic Manager deleted successfully."

        );

        loadManagers();

    }

    catch(error){

        console.error(error);

        alert(

            "Failed to delete Academic Manager."

        );

    }

}




// ===============================
// Success Message
// ===============================


function showSuccessMessage(message){

    const successBox =
        document.getElementById("successMessage");

    successBox.innerHTML = `

        <i class="bi bi-check-circle-fill me-2"></i>

        ${message}

    `;

    successBox.classList.remove("d-none");

    setTimeout(()=>{

        successBox.classList.add("d-none");

    },3000);

}







// ===============================
// Validation
// ===============================


function clearErrors(){


    document
    .querySelectorAll(".text-danger")
    .forEach(
        el=>el.textContent=""
    );


    document
    .querySelectorAll(".form-control")
    .forEach(
        el=>el.classList.remove(
            "is-invalid"
        )
    );


}





function showFieldError(field,message){


    document.getElementById(
        field+"Error"
    ).textContent = message;



    document.getElementById(field)
    .classList.add(
        "is-invalid"
    );


}





function validateManagerForm(){


    clearErrors();


    let valid=true;



    const username =
    document.getElementById("username")
    .value.trim();



    const email =
    document.getElementById("email")
    .value.trim();



    const phone =
    document.getElementById("phone")
    .value.trim();



    const password =
    document.getElementById("password")
    .value;



    if(!username){

        showFieldError(
            "username",
            "Username is required."
        );

        valid=false;

    }



    if(!email){

        showFieldError(
            "email",
            "Email is required."
        );

        valid=false;

    }


if(!editingManagerId && !password){

    showFieldError(
        "password",
        "Password is required."
    );

    valid = false;

}

    if(!phone){

        showFieldError(
            "phone",
            "Phone number is required."
        );

        valid=false;

    }


    else if(!/^\d{10}$/.test(phone)){


        showFieldError(
            "phone",
            "Enter valid 10 digit phone number."
        );


        valid=false;


    }


    return valid;


}