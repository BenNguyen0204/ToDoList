const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastYes = document.getElementById("toastYes");
const toastNo = document.getElementById("toastNo");
const overlay = document.getElementById("overlay");

function closeToast() {
    toast.classList.remove("show");
    overlay.classList.remove("show");
    toastYes.textContent = "Yes";
    toastNo.textContent = "No";
    toastMessage.innerHTML = "";
}

function showToast(text, onYes) {
    toastMessage.textContent = text;
    toast.classList.add("show");
    overlay.classList.add("show");
    toastYes.textContent = "Yes";
    toastNo.textContent = "No";
    toastYes.onclick = () => { closeToast(); onYes(); };
    toastNo.onclick = () => closeToast();
}

function showNameToast(label, onSave) {
    toastMessage.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "toastInput";
    input.placeholder = "List name...";
    toastMessage.appendChild(input);

    toast.classList.add("show");
    overlay.classList.add("show");
    input.focus();
    toastYes.textContent = "Create";
    toastNo.textContent = "Cancel";

    toastYes.onclick = () => {
        const name = input.value.trim();
        if (!name) return;
        closeToast();
        onSave(name);
    };
    toastNo.onclick = () => closeToast();
}

function showEditToast(index) {
    const tasks = getTasks();
    toastMessage.textContent = "Edit task:";
    const input = document.createElement("input");
    input.type = "text";
    input.value = tasks[index].text;
    input.className = "toastInput";
    toastMessage.appendChild(input);

    toast.classList.add("show");
    overlay.classList.add("show");
    input.focus();
    toastYes.textContent = "Save";
    toastNo.textContent = "Cancel";

    toastYes.onclick = () => {
        const newText = input.value.trim();
        if (!newText) return;
        tasks[index].text = newText;
        saveTasks();
        renderTask();
        closeToast();
    };
    toastNo.onclick = () => closeToast();
}