// Which tasks are currently shown: "all", "active" (not completed), or "completed".
// This only affects display — it never deletes or changes task data.
let currentFilter = "all";
const filterToggle = document.getElementById("filterToggle");
const filterMenu = document.getElementById("filterMenu");

// Open/close the filter dropdown when its button is clicked.
filterToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    filterMenu.classList.toggle("open");
});

// Clicking anywhere outside the dropdown closes it...
document.addEventListener("click", () => filterMenu.classList.remove("open"));
// ...but clicking inside the dropdown itself shouldn't close it.
filterMenu.addEventListener("click", (e) => e.stopPropagation());

// When the user picks a different filter option, store it and re-render the list.
document.querySelectorAll('input[name="filter"]').forEach(radio => {
    radio.addEventListener("change", () => {
        currentFilter = radio.value;
        renderTask();
    });
});

let currentSort = "manual";
const sortToggle = document.getElementById("sortToggle");
const sortMenu = document.getElementById("sortMenu");

sortToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle("open");
});

document.addEventListener("click", () => sortMenu.classList.remove("open"));
sortMenu.addEventListener("click", (e) => e.stopPropagation());

document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener("change", () => {
        currentSort = radio.value;
        sortMenu.classList.remove("open");
        renderTask();
    });
});

function sortTasks(tasks) {
    if (currentSort === "earliest" || currentSort === "latest") {
        // Tasks without a due date always sort to the end, regardless of direction.
        const withDate = tasks.filter(t => t.dueDate);
        const withoutDate = tasks.filter(t => !t.dueDate);
        withDate.sort((a, b) => currentSort === "earliest"
            ? a.dueDate.localeCompare(b.dueDate)
            : b.dueDate.localeCompare(a.dueDate));
        return [...withDate, ...withoutDate];
    }

    if (currentSort === "color") {
        // Group by color, following the same order as the color picker.
        // Tasks with no color always sort to the end.
        const colorOrder = TASK_COLORS.map(c => c.value);
        const withColor = tasks.filter(t => t.color);
        const withoutColor = tasks.filter(t => !t.color);
        withColor.sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
        return [...withColor, ...withoutColor];
    }

    return tasks;
}

// dateStr is a "YYYY-MM-DD" string from an <input type="date">.
// Parsing it manually (instead of `new Date(dateStr)`) avoids a timezone
// shift that can push the date a day earlier/later than what was picked.
function formatTaskDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

let dueDatePicker = null;
let dueDatePickerTaskId = null;

function closeDueDatePicker() {
    if (dueDatePicker) dueDatePicker.classList.remove("open");
    dueDatePickerTaskId = null;
}

function setTaskDueDate(taskId, dateStr) {
    const t = getTasks().find(t => t.id === taskId);
    if (!t) return;
    if (dateStr) t.dueDate = dateStr;
    else delete t.dueDate;
    saveTasks();
    renderTask();
}

function buildDueDatePicker() {
    dueDatePicker = document.createElement("input");
    dueDatePicker.type = "date";
    dueDatePicker.className = "dueDatePicker";
    dueDatePicker.addEventListener("click", (e) => e.stopPropagation());
    // Browsers fire "change" as soon as every segment (month/day/year) has
    // *some* value, even mid-typing with an incomplete year (e.g. "0002").
    // Save on every change so picking from the calendar still works, but
    // only close once focus actually leaves the field, so typing a full
    // 4-digit year isn't cut short.
    dueDatePicker.addEventListener("change", () => {
        setTaskDueDate(dueDatePickerTaskId, dueDatePicker.value);
    });
    dueDatePicker.addEventListener("blur", () => {
        closeDueDatePicker();
    });
    document.body.appendChild(dueDatePicker);
}

function openDueDatePicker(anchor, taskId, currentValue) {
    if (!dueDatePicker) buildDueDatePicker();
    dueDatePickerTaskId = taskId;
    dueDatePicker.value = currentValue || "";
    const rect = anchor.getBoundingClientRect();
    dueDatePicker.style.top = `${rect.bottom + 6}px`;
    dueDatePicker.style.left = `${rect.left}px`;
    dueDatePicker.classList.add("open");
    dueDatePicker.focus();
    if (dueDatePicker.showPicker) dueDatePicker.showPicker();
}

document.addEventListener("click", closeDueDatePicker);
window.addEventListener("scroll", closeDueDatePicker, true);
window.addEventListener("resize", closeDueDatePicker);

const tasksList = document.getElementById("tasksList");
const emptyState = document.getElementById("emptyState");
const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");

function updateCounters() {
    if (lists.length === 0) {
        document.getElementById("totalCount").textContent = "Total: 0";
        document.getElementById("activeCount").textContent = "Active: 0";
        document.getElementById("completedCount").textContent = "Completed: 0";
        return;
    }
    const tasks = getTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    document.getElementById("totalCount").textContent = `Total: ${total}`;
    document.getElementById("activeCount").textContent = `Active: ${active}`;
    document.getElementById("completedCount").textContent = `Completed: ${completed}`;
}

tasksList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = tasksList.querySelector(".dragging");
    if (!dragging) return;

    const siblings = [...tasksList.querySelectorAll("li:not(.dragging)")];
    let insertBefore = null;
    for (const s of siblings) {
        const rect = s.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { insertBefore = s; break; }
    }

    tasksList.insertBefore(dragging, insertBefore);
    const tasks = getTasks();
    const newOrder = [...tasksList.querySelectorAll("li")].map(el => {
        return tasks.find(t => String(t.id) === el.dataset.id);
    }).filter(Boolean);
    getCurrentList().tasks = newOrder;
});

const TASK_COLORS = [
    { name: "Red", value: "#e74c3c" },
    { name: "Orange", value: "#f39c12" },
    { name: "Pink", value: "#f10fe6" },
    { name: "Green", value: "#2ecc71" },
    { name: "Blue", value: "#3498db" },
    { name: "Teal", value: "#59b5b6" }
];

let colorPicker = null;
let colorPickerTaskId = null;

function closeColorPicker() {
    if (colorPicker) colorPicker.classList.remove("open");
    colorPickerTaskId = null;
}

function setTaskColor(taskId, color) {
    const t = getTasks().find(t => t.id === taskId);
    if (!t) return;
    if (color) t.color = color;
    else delete t.color;
    saveTasks();
    renderTask();
}

function buildColorPicker() {
    colorPicker = document.createElement("div");
    colorPicker.className = "colorPicker";
    colorPicker.addEventListener("click", (e) => e.stopPropagation());

    for (const c of TASK_COLORS) {
        const opt = document.createElement("button");
        opt.className = "colorOption";
        opt.style.background = c.value;
        opt.title = c.name;
        opt.setAttribute("aria-label", c.name);
        opt.addEventListener("click", () => {
            const id = colorPickerTaskId;
            closeColorPicker();
            setTaskColor(id, c.value);
        });
        colorPicker.appendChild(opt);
    }

    const clear = document.createElement("button");
    clear.className = "colorOption colorClear";
    clear.textContent = "\u00d7";
    clear.title = "No color";
    clear.setAttribute("aria-label", "No color");
    clear.addEventListener("click", () => {
        const id = colorPickerTaskId;
        closeColorPicker();
        setTaskColor(id, null);
    });
    colorPicker.appendChild(clear);

    document.body.appendChild(colorPicker);
}

function openColorPicker(anchor, taskId) {
    if (!colorPicker) buildColorPicker();
    if (colorPicker.classList.contains("open") && colorPickerTaskId === taskId) {
        closeColorPicker();
        return;
    }
    colorPickerTaskId = taskId;
    const rect = anchor.getBoundingClientRect();
    colorPicker.style.top = `${rect.bottom + 6}px`;
    colorPicker.style.left = `${rect.left}px`;
    colorPicker.classList.add("open");
}

document.addEventListener("click", closeColorPicker);
window.addEventListener("scroll", closeColorPicker, true);
window.addEventListener("resize", closeColorPicker);

function renderTask() {
    updateMainVisibility();
    tasksList.innerHTML = "";

    if (lists.length === 0) {
        tasksList.style.display = "none";
        emptyState.style.display = "none";
        updateCounters();
        return;
    }

    const tasks = getTasks();
    // Keep only the tasks that match the active filter, then sort what's left.
    const filtered = sortTasks(tasks.filter(t => {
        if (currentFilter === "active") return !t.completed;
        if (currentFilter === "completed") return t.completed;
        return true; // "all" — no filtering
    }));

    if (filtered.length === 0) {
        tasksList.style.display = "none";
        emptyState.style.display = "block";
        updateCounters();
        return;
    }

    tasksList.style.display = "block";
    emptyState.style.display = "none";

    for (const task of filtered) {
        const li = document.createElement("li");
        li.dataset.id = String(task.id);
        li.draggable = currentSort === "manual";
        if (task.color) {
            li.dataset.color = "true";
            li.style.setProperty("--task-color", task.color);
        }

        li.addEventListener("dragstart", () => li.classList.add("dragging"));
        li.addEventListener("dragend", () => { li.classList.remove("dragging"); saveTasks(); });

        const checkBox = document.createElement("input");
        checkBox.type = "checkbox";
        checkBox.checked = task.completed;
        checkBox.addEventListener("click", () => {
            const t = getTasks().find(t => t.id === task.id);
            if (!t) return;
            t.completed = !t.completed;
            saveTasks();
            renderTask();
        });

        const colorButton = document.createElement("button");
        colorButton.className = "colorButton";
        colorButton.title = "Set color";
        colorButton.setAttribute("aria-label", "Set task color");
        if (task.color) colorButton.style.background = task.color;
        else colorButton.classList.add("empty");
        colorButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openColorPicker(colorButton, task.id);
        });

        const text = document.createElement("span");
        text.textContent = task.text;
        if (task.completed) text.classList.add("completed");

        const dateButton = document.createElement("button");
        dateButton.className = "dateButton";
        if (task.dueDate) {
            dateButton.textContent = formatTaskDate(task.dueDate);
        } else {
            dateButton.textContent = "Set due date";
            dateButton.classList.add("empty");
        }
        dateButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openDueDatePicker(dateButton, task.id, task.dueDate);
        });

        const editButton = document.createElement("button");
        editButton.className = "editButton";
        const editImg = document.createElement("img");
        editImg.src = "images/edit.png";
        editImg.alt = "Edit";
        editButton.appendChild(editImg);
        editButton.addEventListener("click", () => {
            const idx = getTasks().findIndex(t => t.id === task.id);
            if (idx === -1) return;
            showEditToast(idx);
        });

        const delImg = document.createElement("img");
        delImg.src = "images/delete.png";
        delImg.alt = "Delete";
        const deleteButton = document.createElement("button");
        deleteButton.className = "deleteButton";
        deleteButton.appendChild(delImg);
        deleteButton.addEventListener("click", () => {
            const idx = getTasks().findIndex(t => t.id === task.id);
            if (idx === -1) return;
            getTasks().splice(idx, 1);
            saveTasks();
            renderTask();
        });

        const buttonGroup = document.createElement("div");
        buttonGroup.className = "buttonGroup";
        buttonGroup.appendChild(dateButton);
        buttonGroup.appendChild(editButton);
        buttonGroup.appendChild(deleteButton);

        li.appendChild(checkBox);
        li.appendChild(colorButton);
        li.appendChild(text);
        li.appendChild(buttonGroup);
        tasksList.appendChild(li);
    }

    updateCounters();
}

function addTask() {
    const task = taskInput.value.trim();
    if (!task) return;

    const tasks = getTasks();
    const isDup = tasks.some(t => t.text.toLowerCase() === task.toLowerCase());
    if (isDup) {
        showToast(`"${task}" is already in your list! Add it anyway?`, () => {
            getTasks().push({ id: Date.now(), text: task, completed: false });
            taskInput.value = "";
            saveTasks();
            renderTask();
        });
        return;
    }

    tasks.push({ id: Date.now(), text: task, completed: false });
    taskInput.value = "";
    saveTasks();
    renderTask();
}

addButton.addEventListener("click", addTask);
taskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });