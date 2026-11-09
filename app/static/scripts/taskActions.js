// ---- Nơi DUY NHẤT sửa dữ liệu task ----
// Mọi thao tác (thêm, sửa, xoá, kéo thả) đều gọi một trong 4 hàm này.
// Mỗi hàm: sửa dữ liệu -> lưu -> vẽ lại.
// Giai đoạn 5 chỉ cần đổi phần "lưu" thành một request lên API.

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

// changes chỉ chứa các trường muốn đổi, ví dụ { completed: true } hoặc { color: null }.
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

// visibleIds: id của các task ĐANG HIỆN, theo thứ tự mới trên màn hình.
// Task bị ẩn (do đang lọc) giữ nguyên vị trí; các task đang hiện đổi chỗ
// trong đúng những vị trí chúng đang chiếm.
//   Ví dụ: [A✓, B, C✓, D], lọc Active, kéo D lên trên B
//   -> vị trí của B, D là [1, 3] -> đặt D vào 1, B vào 3 -> [A✓, D, C✓, B]
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
    // Gửi id của TOÀN BỘ task theo thứ tự mới, không chỉ task đang hiện
    await apiSave("PUT", `/api/lists/${list.id}/order`, { taskIds: tasks.map(t => t.id) });
}
