// ---- Small helpers for looking up a task by id ----
// Used anywhere a click handler needs the live task object/index instead of
// the stale snapshot captured when the row was rendered.
function findTask(id) {
    return getTasks().find(t => t.id === id);
}
function findTaskIndex(id) {
    return getTasks().findIndex(t => t.id === id);
}

// ---- Filter + Sort dropdowns ----
// Both dropdowns behave the same way: a toggle button opens/closes a menu
// of radio options, clicking outside closes it, and picking an option fires
// a callback and re-renders. This one helper drives both.
function setupDropdown(toggleId, menuId, onChange) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("open");
    });

    // Clicking inside the menu shouldn't close it...
    menu.addEventListener("click", (e) => e.stopPropagation());
    // ...but clicking anywhere else should.
    document.addEventListener("click", () => menu.classList.remove("open"));

    menu.querySelectorAll("input").forEach(radio => {
        radio.addEventListener("change", () => {
            onChange(radio.value);
            menu.classList.remove("open");
        });
    });
}

// Which tasks are currently shown: "all", "active" (not completed), or
// "completed". This only affects display — it never deletes or changes
// task data.
let currentFilter = "all";
setupDropdown("filterToggle", "filterMenu", (value) => {
    currentFilter = value;
    renderTask();
});

// How the task list is ordered: "manual" (drag and drop), "earliest"/
// "latest" (by due date), or "color".
let currentSort = "manual";
setupDropdown("sortToggle", "sortMenu", (value) => {
    currentSort = value;
    renderTask();
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

// ---- Shared "floating popup anchored to a button" behavior ----
// The color picker and the due-date picker are both a small element that
// appears under the button that opened it, and closes on outside click,
// scroll, or window resize. This factory handles that common part; each
// caller builds its own element and decides what goes inside it.
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

// ---- Due date picker ----
// Rather than being hard-wired to "save onto this task id", the picker takes
// a callback — that's what lets both an existing task's date button AND the
// new-task date button (which has no task id yet) share the same popup.
function setTaskDueDate(taskId, dateStr) {
    const t = findTask(taskId);
    if (!t) return;
    if (dateStr) t.dueDate = dateStr;
    else delete t.dueDate;
    saveTasks();
    renderTask();
}

const dueDatePopup = createAnchoredPopup("input", "dueDatePicker");
let dueDatePickerOnSelect = null;

dueDatePopup.element.type = "date";
// Browsers fire "change" as soon as every segment (month/day/year) has
// *some* value, even mid-typing with an incomplete year (e.g. "0002").
// Save on every change so picking from the calendar still works, but
// only close once focus actually leaves the field, so typing a full
// 4-digit year isn't cut short.
dueDatePopup.element.addEventListener("change", () => {
    if (dueDatePickerOnSelect) dueDatePickerOnSelect(dueDatePopup.element.value);
});
dueDatePopup.element.addEventListener("blur", () => {
    dueDatePopup.close();
});

function openDueDatePicker(anchor, currentValue, onSelect) {
    dueDatePickerOnSelect = onSelect;
    dueDatePopup.element.value = currentValue || "";
    dueDatePopup.open(anchor);
    dueDatePopup.element.focus();
    if (dueDatePopup.element.showPicker) dueDatePopup.element.showPicker();
}

// ---- Color picker ----
const TASK_COLORS = [
    { name: "Red", value: "#e74c3c" },
    { name: "Orange", value: "#f39c12" },
    { name: "Pink", value: "#f10fe6" },
    { name: "Green", value: "#2ecc71" },
    { name: "Blue", value: "#3498db" },
    { name: "Teal", value: "#59b5b6" }
];

function setTaskColor(taskId, color) {
    const t = findTask(taskId);
    if (!t) return;
    if (color) t.color = color;
    else delete t.color;
    saveTasks();
    renderTask();
}

// Same idea as the due-date picker: identity + callback instead of a fixed
// task id, so the new-task color button can reuse this popup too.
const colorPopup = createAnchoredPopup("div", "colorPicker");
let colorPickerIdentity = null;
let colorPickerOnSelect = null;

for (const c of TASK_COLORS) {
    const opt = document.createElement("button");
    opt.className = "colorOption";
    opt.style.background = c.value;
    opt.title = c.name;
    opt.setAttribute("aria-label", c.name);
    opt.addEventListener("click", () => {
        const onSelect = colorPickerOnSelect;
        colorPopup.close();
        if (onSelect) onSelect(c.value);
    });
    colorPopup.element.appendChild(opt);
}

const clearColorOption = document.createElement("button");
clearColorOption.className = "colorOption colorClear";
clearColorOption.textContent = "\u00d7";
clearColorOption.title = "No color";
clearColorOption.setAttribute("aria-label", "No color");
clearColorOption.addEventListener("click", () => {
    const onSelect = colorPickerOnSelect;
    colorPopup.close();
    if (onSelect) onSelect(null);
});
colorPopup.element.appendChild(clearColorOption);

function openColorPicker(anchor, identity, onSelect) {
    // Clicking the same button again toggles it closed.
    if (colorPopup.element.classList.contains("open") && colorPickerIdentity === identity) {
        colorPopup.close();
        return;
    }
    colorPickerIdentity = identity;
    colorPickerOnSelect = onSelect;
    colorPopup.open(anchor);
}

// ---- Task list rendering ----
const tasksList = document.getElementById("tasksList");
const emptyState = document.getElementById("emptyState");
const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");

// ---- Color + due date for a task that doesn't exist yet ----
// These hold whatever the user picked in the "new task" row before hitting
// Add. They're plain variables, not task fields, since there's no task to
// attach them to until addTask() actually creates one.
const newTaskColorButton = document.getElementById("newTaskColorButton");
const newTaskDateButton = document.getElementById("newTaskDateButton");
let pendingColor = null;
let pendingDueDate = null;

function updateNewTaskColorButton() {
    if (pendingColor) {
        newTaskColorButton.style.background = pendingColor;
        newTaskColorButton.classList.remove("empty");
    } else {
        newTaskColorButton.style.background = "";
        newTaskColorButton.classList.add("empty");
    }
}

function updateNewTaskDateButton() {
    if (pendingDueDate) {
        newTaskDateButton.textContent = formatTaskDate(pendingDueDate);
        newTaskDateButton.classList.remove("empty");
    } else {
        newTaskDateButton.textContent = "Set due date";
        newTaskDateButton.classList.add("empty");
    }
}

newTaskColorButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openColorPicker(newTaskColorButton, "new-task", (color) => {
        pendingColor = color;
        updateNewTaskColorButton();
    });
});

newTaskDateButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openDueDatePicker(newTaskDateButton, pendingDueDate, (dateStr) => {
        pendingDueDate = dateStr || null;
        updateNewTaskDateButton();
    });
});

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
            const t = findTask(task.id);
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
            openColorPicker(colorButton, task.id, (color) => setTaskColor(task.id, color));
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
            openDueDatePicker(dateButton, task.dueDate, (dateStr) => setTaskDueDate(task.id, dateStr));
        });

        const editButton = document.createElement("button");
        editButton.className = "editButton";
        const editImg = document.createElement("img");
        editImg.src = "images/edit.png";
        editImg.alt = "Edit";
        editButton.appendChild(editImg);
        editButton.addEventListener("click", () => {
            const idx = findTaskIndex(task.id);
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
            const idx = findTaskIndex(task.id);
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

function resetAddTaskInputs() {
    taskInput.value = "";
    pendingColor = null;
    pendingDueDate = null;
    updateNewTaskColorButton();
    updateNewTaskDateButton();
}

function addTask() {
    const task = taskInput.value.trim();
    if (!task) return;

    const newTask = { id: Date.now(), text: task, completed: false };
    if (pendingColor) newTask.color = pendingColor;
    if (pendingDueDate) newTask.dueDate = pendingDueDate;

    const tasks = getTasks();
    const isDup = tasks.some(t => t.text.toLowerCase() === task.toLowerCase());
    if (isDup) {
        showToast(`"${task}" is already in your list! Add it anyway?`, () => {
            getTasks().push(newTask);
            resetAddTaskInputs();
            saveTasks();
            renderTask();
        });
        return;
    }

    tasks.push(newTask);
    resetAddTaskInputs();
    saveTasks();
    renderTask();
}

addButton.addEventListener("click", addTask);
taskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });