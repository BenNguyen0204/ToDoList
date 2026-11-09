// ---- shared dialog ----
// one dialog in index.html, used 2 ways:
//   showToast(text, onYes)                             yes/no question
//   showInputToast(label, value, onSave, placeholder)  one line of text (new list, edit task)

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastYes = document.getElementById("toastYes");
const toastNo = document.getElementById("toastNo");
const overlay = document.getElementById("overlay");

function openToast(yesText, noText) {
    toastYes.textContent = yesText;
    toastNo.textContent = noText;
    toast.classList.add("show");
    overlay.classList.add("show");
    toastNo.onclick = closeToast;
}

function closeToast() {
    toast.classList.remove("show");
    overlay.classList.remove("show");
    toastMessage.innerHTML = "";
}

function showToast(text, onYes) {
    toastMessage.textContent = text;
    openToast("Yes", "No");
    toastYes.onclick = () => { closeToast(); onYes(); };
}

function showInputToast(label, initialValue, onSave, placeholder = "") {
    toastMessage.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "toastInput";
    input.value = initialValue;
    input.placeholder = placeholder;
    toastMessage.appendChild(input);

    openToast(initialValue ? "Save" : "Create", "Cancel");
    input.focus();

    const submit = () => {
        const value = input.value.trim();
        if (!value) return;
        closeToast();
        onSave(value);
    };
    toastYes.onclick = submit;
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") closeToast();
    });
}
