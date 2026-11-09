// ---- task list rendering + user input ----
// doesn't change data itself, it calls addTask / updateTask / deleteTask / reorderTasks (taskActions.js)

const tasksList = document.getElementById("tasksList");
const emptyState = document.getElementById("emptyState");
const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");
const newTaskColorButton = document.getElementById("newTaskColorButton");
const newTaskDateButton = document.getElementById("newTaskDateButton");

// ---- render ----

function renderTask() {
    updateMainVisibility();
    tasksList.innerHTML = "";

    if (lists.length === 0) {
        tasksList.style.display = "none";
        emptyState.style.display = "none";
        updateCounters();
        return;
    }

    const visibleTasks = sortTasks(filterTasks(getTasks()));
    tasksList.style.display = visibleTasks.length ? "block" : "none";
    emptyState.style.display = visibleTasks.length ? "none" : "block";

    for (const task of visibleTasks) {
        tasksList.appendChild(buildTaskItem(task));
    }
    updateCounters();
}

// one <li> per task: checkbox, color dot, text, date, edit, delete
function buildTaskItem(task) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    li.draggable = currentSort === "manual";
    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        reorderTasks([...tasksList.children].map(el => el.dataset.id));
    });
    if (task.color) {
        li.dataset.color = "true";
        li.style.setProperty("--task-color", task.color);
    }

    const checkBox = document.createElement("input");
    checkBox.type = "checkbox";
    checkBox.checked = task.completed;
    checkBox.addEventListener("change", () => updateTask(task.id, { completed: checkBox.checked }));

    const colorButton = document.createElement("button");
    colorButton.className = "colorButton";
    colorButton.title = "Set color";
    colorButton.setAttribute("aria-label", "Set task color");
    if (task.color) colorButton.style.background = task.color;
    else colorButton.classList.add("empty");
    colorButton.addEventListener("click", (e) => {
        e.stopPropagation();
        openColorPicker(colorButton, task.id, (color) => updateTask(task.id, { color }));
    });

    const text = document.createElement("span");
    text.textContent = task.text;
    if (task.completed) text.classList.add("completed");

    const dateButton = document.createElement("button");
    dateButton.className = "dateButton";
    dateButton.textContent = task.dueDate ? formatTaskDate(task.dueDate) : "Set due date";
    if (!task.dueDate) dateButton.classList.add("empty");
    dateButton.addEventListener("click", (e) => {
        e.stopPropagation();
        openDueDatePicker(dateButton, task.dueDate, (dueDate) => updateTask(task.id, { dueDate }));
    });

    const editButton = createIconButton("editButton", "/static/images/edit.png", "Edit", () => {
        showInputToast("Edit task:", task.text, (newText) => updateTask(task.id, { text: newText }));
    });
    const deleteButton = createIconButton("deleteButton", "/static/images/delete.png", "Delete", () => {
        deleteTask(task.id);
    });

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "buttonGroup";
    buttonGroup.append(dateButton, editButton, deleteButton);

    li.append(checkBox, colorButton, text, buttonGroup);
    return li;
}

function createIconButton(className, imgSrc, alt, onClick) {
    const button = document.createElement("button");
    button.className = className;
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = alt;
    button.appendChild(img);
    button.addEventListener("click", onClick);
    return button;
}

function updateCounters() {
    const tasks = lists.length ? getTasks() : [];
    const completed = tasks.filter(t => t.completed).length;
    document.getElementById("totalCount").textContent = `Total: ${tasks.length}`;
    document.getElementById("activeCount").textContent = `Active: ${tasks.length - completed}`;
    document.getElementById("completedCount").textContent = `Completed: ${completed}`;
}

// ---- drag & drop ----
// while dragging we only move the <li> around,
// the actual reorder happens on dragend (in buildTaskItem)
tasksList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = tasksList.querySelector(".dragging");
    if (!dragging) return;

    // drop it before the first task where the mouse is in its top half
    const others = [...tasksList.querySelectorAll("li:not(.dragging)")];
    const insertBefore = others.find(el => {
        const rect = el.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
    });
    tasksList.insertBefore(dragging, insertBefore || null);
});

// ---- new task row ----
// color/date picked before hitting Add live here for now
let pendingColor = null;
let pendingDueDate = null;

function updateNewTaskButtons() {
    newTaskColorButton.style.background = pendingColor || "";
    newTaskColorButton.classList.toggle("empty", !pendingColor);
    newTaskDateButton.textContent = pendingDueDate ? formatTaskDate(pendingDueDate) : "Set due date";
    newTaskDateButton.classList.toggle("empty", !pendingDueDate);
}

function resetNewTaskRow() {
    taskInput.value = "";
    pendingColor = null;
    pendingDueDate = null;
    updateNewTaskButtons();
}

newTaskColorButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openColorPicker(newTaskColorButton, "new-task", (color) => {
        pendingColor = color;
        updateNewTaskButtons();
    });
});

newTaskDateButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openDueDatePicker(newTaskDateButton, pendingDueDate, (dueDate) => {
        pendingDueDate = dueDate;
        updateNewTaskButtons();
    });
});

function submitNewTask() {
    const text = taskInput.value.trim();
    if (!text) return;

    const color = pendingColor;
    const dueDate = pendingDueDate;
    const add = () => {
        resetNewTaskRow();
        addTask(text, color, dueDate);
    };

    const isDuplicate = getTasks().some(t => t.text.toLowerCase() === text.toLowerCase());
    if (isDuplicate) {
        showToast(`"${text}" is already in your list! Add it anyway?`, add);
    } else {
        add();
    }
}

addButton.addEventListener("click", submitNewTask);
taskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitNewTask(); });
