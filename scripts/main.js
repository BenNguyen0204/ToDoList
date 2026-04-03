let lists = getLists();
let currentListId = Number(localStorage.getItem("currentListId")) || (lists[0]?.id ?? null);

migrateOldTasks();

// Init
updateMainVisibility();
renderSidebar();
renderTask();