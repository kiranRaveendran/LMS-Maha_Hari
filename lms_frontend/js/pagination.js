// ===============================================================
// Small reusable pagination helper. Not tied to any specific page —
// works off a plain array + a render callback for the current page's
// slice. Use for any table that could grow large over a semester
// (leave requests, submissions, records lists, etc.)
// ===============================================================

function paginateArray(items, page, perPage) {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
}

function renderPaginationControls(container, totalItems, currentPage, perPage, onPageChange) {

    const totalPages = Math.ceil(totalItems / perPage);

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = `<ul class="pagination pagination-sm mb-0">`;

    html += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${currentPage - 1}">Prev</a>
    </li>`;

    for (let p = 1; p <= totalPages; p++) {
        html += `<li class="page-item ${p === currentPage ? "active" : ""}">
            <a class="page-link" href="#" data-page="${p}">${p}</a>
        </li>`;
    }

    html += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
    </li>`;

    html += `</ul>`;

    container.innerHTML = html;

    container.querySelectorAll(".page-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page, 10);
            if (page >= 1 && page <= totalPages && page !== currentPage) {
                onPageChange(page);
            }
        });
    });

}