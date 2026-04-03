const listTabs = document.getElementById("listTabs");
const listTitle = document.getElementById("listTitle");
const newListButton = document.getElementById("newListButton");
const mainContent = document.querySelector(".main");

function updateMainVisibility() {
    const welcomeState = document.getElementById("welcomeState");
    const appDiv = document.querySelector(".app");
    const tasksDiv = document.querySelector(".tasksDiv");

    if (lists.length === 0) {
        mainContent.style.display = "flex";
        mainContent.style.alignItems = "center";
        mainContent.style.justifyContent = "center";
        welcomeState.style.display = "flex";
        appDiv.style.display = "none";
        tasksDiv.style.display = "none";
    } else {
        mainContent.style.display = "block";
        mainContent.style.alignItems = "";
        mainContent.style.justifyContent = "";
        welcomeState.style.display = "none";
        appDiv.style.display = "block";
        tasksDiv.style.display = "block";
    }
}

function renderSidebar() {
    updateMainVisibility();
    listTabs.innerHTML = "";

    if (lists.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No lists yet";
        empty.style.opacity = "0.4";
        empty.style.fontSize = "12px";
        empty.style.cursor = "default";
        listTabs.appendChild(empty);
        listTitle.textContent = "";
        return;
    }

    if (!lists.find(l => l.id === currentListId)) {
        currentListId = lists[0].id;
        localStorage.setItem("currentListId", currentListId);
    }

    lists.forEach(list => {
        const li = document.createElement("li");
        if (list.id === currentListId) li.classList.add("active");

        const span = document.createElement("span");
        span.textContent = list.name;
        span.addEventListener("click", () => {
            currentListId = list.id;
            localStorage.setItem("currentListId", currentListId);
            listTitle.textContent = list.name;
            renderSidebar();
            renderTask();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "deleteListBtn";
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            lists = lists.filter(l => l.id !== list.id);
            if (currentListId === list.id) {
                currentListId = lists.length > 0 ? lists[0].id : null;
                localStorage.setItem("currentListId", currentListId);
            }
            saveLists(lists);
            listTitle.textContent = getCurrentList()?.name || "";
            renderSidebar();
            renderTask();
        });

        li.appendChild(span);
        li.appendChild(deleteBtn);
        listTabs.appendChild(li);
    });

    listTitle.textContent = getCurrentList().name;
}

newListButton.addEventListener("click", () => {
    showNameToast("Name your new list:", (name) => {
        const newList = { id: Date.now(), name, tasks: [] };
        lists.push(newList);
        currentListId = newList.id;
        localStorage.setItem("currentListId", currentListId);
        saveLists(lists);
        renderSidebar();
        renderTask();
    });
});