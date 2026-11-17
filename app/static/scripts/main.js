let lists = [];
let currentListId = Number(localStorage.getItem("currentListId")) || null;

async function init() {
    try {
        await loadList();
    } catch(e) {
        console.error(e);
        showToast("Couldn't load your lists. Try again?", init);
        return;
    }
    renderSidebar();
    renderTask();
}

init();

// refetch when coming back to the tab in case another tab/device changed stuff
document.addEventListener("visibilitychange", async () => {
    // skip if hidden or a save is still going (old data could overwrite what we just changed)
    if (document.visibilityState != "visible" || pendingSaves > 0) return;
    try {
        await loadList();
        renderSidebar();
        renderTask();
    } catch (err) {
        console.error(err);
    }
});
