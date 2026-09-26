let currentFilter = "all";
const filterToggle = document.getElementById("filterToggle");
const filterMenu = document.getElementById("filterMenu");

filterToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    filterMenu.classList.toggle("open");
});

document.addEventListener("click", () => filterMenu.classList.remove("open"));
filterMenu.addEventListener("click", (e) => e.stopPropagation());

document.querySelectorAll('input[name="filter"]').forEach(radio => {
    radio.addEventListener("change", () => {
        currentFilter = radio.value;
        renderTask();
    });
});

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
    const filtered = tasks.filter(t => {
        if (currentFilter === "active") return !t.completed;
        if (currentFilter === "completed") return t.completed;
        return true;
    });

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
        li.draggable = true;

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

        const text = document.createElement("span");
        text.textContent = task.text;
        if (task.completed) text.classList.add("completed");

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
        buttonGroup.appendChild(editButton);
        buttonGroup.appendChild(deleteButton);

        li.appendChild(checkBox);
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