let pendingSaves = 0;

async function apiRequest(method, path, body) {
    const options = {method: method, headers: {} };
    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);

    // 401 = not logged in anymore (logged out in another tab, cookie expired) -> back to login
    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Not logged in");
    }

    if (!response.ok) {
        throw new Error(`${method} ${path} failed: ${response.status}`);
    }

    // 204 = no content
    if (response.status === 204) return null;

    return response.json();
}

// pendingSaves = saves that haven't finished yet, main.js won't refresh while it's > 0.
// finally makes sure it goes back down even if the request fails

async function apiSave(method, path, body) {
    pendingSaves++;
    try {
        return await apiRequest(method, path, body)
    } catch (e) {
        console.error(e);
        showToast("Couldn't save your change. Reload the page?", () => location.reload());
        return null;
    } finally {
        pendingSaves--;
    }
}

async function loadList() {
    lists = await apiRequest("GET", "/api/lists");
    // selected list got deleted somewhere else -> fall back to the first one
    if (!lists.some(l => l.id === currentListId)) {
        currentListId = lists[0]?.id?? null;
    }
}

// lists / currentListId live in main.js
function getCurrentList() {
    return lists.find(l => l.id === currentListId) || null;
}

function getTasks() {
    return getCurrentList()?.tasks || [];
}