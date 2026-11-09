// FILTER & SORT
// only decides which tasks show and in what order, never changes the data

// dropdown used by both filter and sort. click to toggle, click outside to close
function setupDropdown(toggleId, menuId, onChange) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("open");
    });
    menu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => menu.classList.remove("open"));

    menu.querySelectorAll("input").forEach(radio => {
        radio.addEventListener("change", () => {
            onChange(radio.value);
            menu.classList.remove("open");
        });
    });
}

// "all" | "active" | "completed"
let currentFilter = "all";
setupDropdown("filterToggle", "filterMenu", (value) => {
    currentFilter = value;
    renderTask();
});

function filterTasks(tasks) {
    if (currentFilter === "active") return tasks.filter(t => !t.completed);
    if (currentFilter === "completed") return tasks.filter(t => t.completed);
    return tasks;
}

// "manual" | "earliest" | "latest" | "color", saved in localStorage
let currentSort = localStorage.getItem("sortOrder") || "manual";
const savedSortRadio = document.querySelector(`input[name="sort"][value="${currentSort}"]`);
if (savedSortRadio) savedSortRadio.checked = true;

setupDropdown("sortToggle", "sortMenu", (value) => {
    currentSort = value;
    localStorage.setItem("sortOrder", value);
    renderTask();
});

// returns a sorted copy, doesn't mess with the original
function sortTasks(tasks) {
    if (currentSort === "earliest" || currentSort === "latest") {
        const withDate = tasks.filter(t => t.dueDate);
        const withoutDate = tasks.filter(t => !t.dueDate);   // no due date -> always last
        withDate.sort((a, b) => currentSort === "earliest"
            ? a.dueDate.localeCompare(b.dueDate)
            : b.dueDate.localeCompare(a.dueDate));
        return [...withDate, ...withoutDate];
    }

    if (currentSort === "color") {
        const colorOrder = TASK_COLORS.map(c => c.value);   // same order as the picker
        const withColor = tasks.filter(t => t.color);
        const withoutColor = tasks.filter(t => !t.color);   // no color -> always last
        withColor.sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
        return [...withColor, ...withoutColor];
    }

    return tasks;
}
