// globals, the other files use these.
// lists is empty until we load it from the server
let lists = [];
let currentListId = Number(localStorage.getItem("currentListId")) || null;

// on page load: fetch first, then render
async function init() {
    try {
        await loadList();
    } catch(e) {
        // nothing to render, show a toast with retry
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
        // background refresh, just log it
        console.error(err);
    }
});
