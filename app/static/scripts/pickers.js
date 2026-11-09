// ---- color + date pickers ----
// small popups that show up under the button you clicked.
// they don't change any data, the caller passes a callback for that

const TASK_COLORS = [
    { name: "Red", value: "#e74c3c" },
    { name: "Orange", value: "#f39c12" },
    { name: "Pink", value: "#f10fe6" },
    { name: "Green", value: "#2ecc71" },
    { name: "Blue", value: "#3498db" },
    { name: "Teal", value: "#59b5b6" }
];

// "2026-11-10" -> "Nov 10, 2026". split it by hand bc new Date(dateStr) reads it as UTC
// and can end up a day off
function formatTaskDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// popup under a button, closes on outside click / scroll / resize
function createAnchoredPopup(tagName, className) {
    const el = document.createElement(tagName);
    el.className = className;
    el.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(el);

    function close() {
        el.classList.remove("open");
    }

    function open(anchor) {
        const rect = anchor.getBoundingClientRect();
        el.style.top = `${rect.bottom + 6}px`;
        el.style.left = `${rect.left}px`;
        el.classList.add("open");
    }

    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return { element: el, open, close };
}

// ---- date ----
const dueDatePopup = createAnchoredPopup("input", "dueDatePicker");
dueDatePopup.element.type = "date";
let dueDateOnSelect = null;

// change fires as soon as day/month/year all have a value, even mid typing the year.
// so save on every change but only close on blur
dueDatePopup.element.addEventListener("change", () => {
    if (dueDateOnSelect) dueDateOnSelect(dueDatePopup.element.value || null);
});
dueDatePopup.element.addEventListener("blur", () => dueDatePopup.close());

function openDueDatePicker(anchor, currentValue, onSelect) {
    dueDateOnSelect = onSelect;
    dueDatePopup.element.value = currentValue || "";
    dueDatePopup.open(anchor);
    dueDatePopup.element.focus();
    if (dueDatePopup.element.showPicker) dueDatePopup.element.showPicker();
}

// ---- color ----
const colorPopup = createAnchoredPopup("div", "colorPicker");
let colorPickerOwner = null;    // which button opened it, clicking it again closes it
let colorOnSelect = null;

function addColorOption(className, title, value) {
    const option = document.createElement("button");
    option.className = className;
    option.title = title;
    option.setAttribute("aria-label", title);
    option.addEventListener("click", () => {
        const onSelect = colorOnSelect;
        colorPopup.close();
        if (onSelect) onSelect(value);
    });
    colorPopup.element.appendChild(option);
    return option;
}

for (const c of TASK_COLORS) {
    addColorOption("colorOption", c.name, c.value).style.background = c.value;
}
addColorOption("colorOption colorClear", "No color", null).textContent = "×";

function openColorPicker(anchor, owner, onSelect) {
    if (colorPopup.element.classList.contains("open") && colorPickerOwner === owner) {
        colorPopup.close();
        return;
    }
    colorPickerOwner = owner;
    colorOnSelect = onSelect;
    colorPopup.open(anchor);
}
