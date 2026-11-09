// ALL TASK CHANGES GO THROUGH HERE
// add / edit / delete / drag each call one of these 4.
// update, delete and reorder change the UI first and save after,
// addTask waits for the server since it needs the id

function findTask(id) {
    return getTasks().find(t => t.id === id);
}

async function addTask(text, color, dueDate) {
    const listId = currentListId;
    const task = await apiSave("POST", `/api/lists/${listId}/tasks`, {text, color, dueDate});
    if (!task) return;

    const list = lists.find(l => l.id === listId);
    if (list) list.tasks.push(task);
    renderTask();
}

// changes = just the fields that changed, e.g. { completed: true } or { color: null }
async function updateTask(id, changes) {
    const task = findTask(id);
    if (!task) return;
    Object.assign(task, changes);
    renderTask();
    await apiSave("PATCH", `/api/tasks/${id}`, changes);
}

async function deleteTask(id) {
    const list = getCurrentList();
    list.tasks = list.tasks.filter(t => t.id !== id);
    renderTask();
    await apiSave("DELETE", `/api/tasks/${id}`);
}

// visibleIds = ids of the tasks on screen, in the new order.
// hidden tasks (filtered out) stay put, the visible ones only swap
// around inside the slots they already had.
//   e.g. [A✓, B, C✓, D], filter Active, drag D above B
//   -> B, D are at [1, 3] -> D goes to 1, B to 3 -> [A✓, D, C✓, B]
async function reorderTasks(visibleIds) {
    const list = getCurrentList();
    const tasks = list.tasks;
    const visibleTasks = visibleIds.map(id => tasks.find(t => String(t.id) === id));
 
    const slots = [];
    tasks.forEach((t, i) => {
        if (visibleIds.includes(String(t.id))) slots.push(i);
    });
    slots.forEach((slot, k) => { tasks[slot] = visibleTasks[k]; });
 
    renderTask();
    // send every task id, not just the visible ones
    await apiSave("PUT", `/api/lists/${list.id}/order`, { taskIds: tasks.map(t => t.id) });
}
