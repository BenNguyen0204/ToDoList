// SHARED DIALOG
// one dialog in index.html, used 3 ways:
//   showToast(text, onYes)                             yes/no question
//   showInputToast(label, value, onSave, placeholder)  one line of text (new list, edit task)
//   showPanelToast(element)                            anything else, just a Close button (account panel)

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastYes = document.getElementById("toastYes");
const toastNo = document.getElementById("toastNo");
const overlay = document.getElementById("overlay");

// same as the fade in toast.css
const TOAST_FADE_MS = 200;
// closeToast clears the content only after the fade, otherwise the panel shrinks
// into a small empty box (just the Close button) while it's still fading out
let toastCleanup = null;

function openToast(yesText, noText) {
    // opened again before the last one finished closing: don't let it wipe the new content
    clearTimeout(toastCleanup);
    toastYes.textContent = yesText;
    // showPanelToast hides it
    toastYes.hidden = false;
    // only showPanelToast uses the wide panel look (toast.css .panelMode)
    toast.classList.remove("panelMode");
    toastNo.textContent = noText;
    toast.classList.add("show");
    overlay.classList.add("show");
    toastNo.onclick = closeToast;
}

function closeToast() {
    toast.classList.remove("show");
    overlay.classList.remove("show");
    clearTimeout(toastCleanup);
    toastCleanup = setTimeout(() => {
        toast.classList.remove("panelMode");
        toastMessage.innerHTML = "";
    }, TOAST_FADE_MS);
}

// the panel has its own buttons, so only keep Close
function showPanelToast(element) {
    toastMessage.textContent = "";
    toastMessage.appendChild(element);
    openToast("", "Close");
    toastYes.hidden = true;
    // wide, left aligned, Close sits in a footer bar (see toast.css)
    toast.classList.add("panelMode");
    // start at the top every time, it remembers the scroll otherwise
    toast.scrollTop = 0;
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