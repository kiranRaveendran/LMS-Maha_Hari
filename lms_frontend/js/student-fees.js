// ===============================================================
// Student — Fees page. Fetches the student's fee balance, and on
// "Pay Now" creates a Razorpay order server-side, opens Razorpay
// Checkout with it, then sends the resulting payment/signature back
// to the server for verification before marking anything paid.
//
// Razorpay TEST MODE card to use when the checkout modal opens:
//   Card number: 4111 1111 1111 1111
//   Expiry: any future date   CVV: any 3 digits   OTP: 1234 (if asked)
// See https://razorpay.com/docs/payments/payments/test-card-upi-details/
// for the full list of test cards/UPI IDs (including ones that
// simulate a failed payment, useful for testing that path).
// ===============================================================

document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const FEE_ENDPOINT = `${API.BASE_URL}/api/student/fee/`;
const CREATE_ORDER_ENDPOINT = `${API.BASE_URL}/api/student/fee/create-order/`;
const VERIFY_PAYMENT_ENDPOINT = `${API.BASE_URL}/api/student/fee/verify-payment/`;

const STATUS_BADGES = {
    PENDING: `<span class="badge bg-warning text-dark">Pending</span>`,
    PAID: `<span class="badge bg-success">Paid</span>`,
};

const PAYMENT_STATUS_BADGES = {
    CREATED: `<span class="badge bg-secondary">Created</span>`,
    PAID: `<span class="badge bg-success">Paid</span>`,
    FAILED: `<span class="badge bg-danger">Failed</span>`,
};

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    document.getElementById("payNowBtn").addEventListener("click", startPayment);

    loadFee();

}

async function loadFee() {

    document.getElementById("feeLoading").classList.remove("d-none");
    document.getElementById("feeContent").classList.add("d-none");

    try {

        const response = await api.get(FEE_ENDPOINT);
        renderFee(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        document.getElementById("feeLoading").innerHTML =
            `<p class="text-danger text-center">Failed to load fee details.</p>`;

    }

}

function renderFee(fee) {

    document.getElementById("feeLoading").classList.add("d-none");
    document.getElementById("feeContent").classList.remove("d-none");

    document.getElementById("feeAmount").textContent = formatRupees(fee.amount);
    document.getElementById("feeStatusBadge").outerHTML =
        `<span class="badge" id="feeStatusBadge">${STATUS_BADGES[fee.status] || fee.status}</span>`;

    const payNowBtn = document.getElementById("payNowBtn");
    const paidMessage = document.getElementById("paidMessage");

    if (fee.status === "PAID") {
        payNowBtn.style.display = "none";
        paidMessage.style.display = "block";
    } else {
        payNowBtn.style.display = "block";
        paidMessage.style.display = "none";
    }

    renderPayments(fee.payments || []);

}

function renderPayments(payments) {

    const tableBody = document.getElementById("paymentsTableBody");

    if (!payments.length) {
        tableBody.innerHTML = `
        <tr><td colspan="4" class="text-center py-5 text-muted">
            No payment attempts yet.
        </td></tr>`;
        return;
    }

    const sorted = [...payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tableBody.innerHTML = sorted.map(p => `
        <tr>
            <td>${new Date(p.created_at).toLocaleString()}</td>
            <td><code class="small">${p.razorpay_order_id}</code></td>
            <td>${formatRupees(p.amount)}</td>
            <td>${PAYMENT_STATUS_BADGES[p.status] || p.status}</td>
        </tr>
    `).join("");

}

function formatRupees(amount) {
    const value = parseFloat(amount);
    return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

async function startPayment() {

    const payNowBtn = document.getElementById("payNowBtn");
    const errorBox = document.getElementById("feeError");
    errorBox.textContent = "";

    payNowBtn.disabled = true;
    payNowBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Starting Payment...`;

    try {

        const response = await api.post(CREATE_ORDER_ENDPOINT);
        const order = response.data;

        const options = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "LMS Fee Payment",
            description: "Course Fee (Test Payment)",
            order_id: order.order_id,
            prefill: {
                name: order.student_name || "",
                email: order.student_email || "",
            },
            theme: {
                color: "#0d6efd",
            },
            handler: function (razorpayResponse) {
                verifyPayment(razorpayResponse);
            },
            modal: {
                ondismiss: function () {
                    resetPayNowButton();
                },
            },
        };

        const razorpayCheckout = new Razorpay(options);

        razorpayCheckout.on("payment.failed", function () {
            errorBox.textContent = "Payment failed. Please try again.";
            resetPayNowButton();
            loadFee();
        });

        razorpayCheckout.open();

    } catch (error) {

        console.error(error);
        errorBox.textContent = error.response?.data?.detail || "Could not start payment. Please try again.";
        resetPayNowButton();

    }

}

async function verifyPayment(razorpayResponse) {

    const errorBox = document.getElementById("feeError");

    try {

        await api.post(VERIFY_PAYMENT_ENDPOINT, {
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
        });

        loadFee();

    } catch (error) {

        console.error(error);
        errorBox.textContent = error.response?.data?.detail || "Payment verification failed.";
        resetPayNowButton();
        loadFee();

    }

}

function resetPayNowButton() {
    const payNowBtn = document.getElementById("payNowBtn");
    payNowBtn.disabled = false;
    payNowBtn.innerHTML = `<i class="bi bi-credit-card me-2"></i>Pay Now`;
}
