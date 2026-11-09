// PHONE LAYOUT
// on a phone only one screen shows at a time (mobile.css): first the sidebar with your lists,
// tap a list to open it. "‹ Lists" or the phone's back gesture goes back.
// body.listOpen = the list screen is showing

// same width as the @media in mobile.css
const phoneQuery = window.matchMedia("(max-width: 700px)");
const backToLists = document.getElementById("backToLists");

function openListOnPhone() {
    if (!phoneQuery.matches || document.body.classList.contains("listOpen")) return;
    document.body.classList.add("listOpen");
    // a history entry so the back gesture closes the list instead of leaving the app
    history.pushState({ listOpen: true }, "");
    window.scrollTo(0, 0);
}

function showListsOnPhone() {
    document.body.classList.remove("listOpen");
    window.scrollTo(0, 0);
}

backToLists.addEventListener("click", () => {
    // use up the history entry we added, popstate below does the rest
    if (history.state?.listOpen) history.back();
    else showListsOnPhone();
});

// back (or forward) gesture
window.addEventListener("popstate", () => {
    if (history.state?.listOpen && phoneQuery.matches) document.body.classList.add("listOpen");
    else showListsOnPhone();
});

// reloading keeps history.state. always start on the lists screen, like the first visit
if (history.state?.listOpen) history.replaceState(null, "");
