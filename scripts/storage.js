function getLists() {
    return JSON.parse(localStorage.getItem("lists")) || [];
}

function saveLists(lists) {
    localStorage.setItem("lists", JSON.stringify(lists));
}

function migrateOldTasks() {
    const oldTasks = JSON.parse(localStorage.getItem("tasks"));
    if (oldTasks && oldTasks.length > 0 && lists.length > 0) {
        oldTasks.forEach(t => { if (!t.id) t.id = Date.now() + Math.random(); });
        lists[0].tasks = oldTasks;
        saveLists(lists);
        localStorage.removeItem("tasks");
    }
}

function getCurrentList() {
    return lists.find(l => l.id === currentListId) || null;
}

function getTasks() {
    return getCurrentList()?.tasks || [];
}

function saveTasks() {
    saveLists(lists);
}