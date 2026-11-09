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

        li.addEventListener("click", (e) => {
            // clicking inside the rename box shouldn't count as opening the list
            if (e.target.closest("input")) return;
            currentListId = list.id;
            localStorage.setItem("currentListId", currentListId);
            listTitle.textContent = list.name;
            renderSidebar();
            renderTask();
            // mobile.js, does nothing on a computer
            openListOnPhone();
        });

        const span = document.createElement("span");
        span.textContent = list.name;

        const editBtn = document.createElement("button");
        editBtn.className = "editListBtn";

        const editImg = document.createElement("img");
        editImg.src = "/static/images/edit.png";
        editImg.alt = "Edit";
        editBtn.appendChild(editImg);

        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            const input = document.createElement("input");
            input.type = "text";
            input.value = list.name;
            input.className = "editListInput";

            span.replaceWith(input);
            input.focus();
            input.select();

            // Escape calls renderSidebar() which removes the input and fires blur,
            // without this flag blur would still save the new name
            let finished = false;

            const save = () => {
                if (finished) return;
                finished = true;
                const newName = input.value.trim();

                if (!newName || newName === list.name) {
                    renderSidebar();
                    return;
                }

                list.name = newName;
                renderSidebar();
                renderTask();
                // no await, nothing to do after it saves
                apiSave("PATCH", `/api/lists/${list.id}`, { name: newName });
            };

            input.addEventListener("blur", save);
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                    finished = true;
                    renderSidebar();
                }
            });
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "deleteListBtn";

        const deleteImg = document.createElement("img");
        deleteImg.src = "/static/images/delete.png";
        deleteImg.alt = "Delete";
        deleteBtn.appendChild(deleteImg);

        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            lists = lists.filter(l => l.id !== list.id);

            if (currentListId === list.id) {
                currentListId = lists.length > 0 ? lists[0].id : null;
                localStorage.setItem("currentListId", currentListId);
            }

            listTitle.textContent = getCurrentList()?.name || "";
            renderSidebar();
            renderTask();
            // server deletes its tasks too (cascade)
            apiSave("DELETE", `/api/lists/${list.id}`);
        });

        li.appendChild(span);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        listTabs.appendChild(li);
    });

    listTitle.textContent = getCurrentList()?.name || "";
}

newListButton.addEventListener("click", () => {
    showInputToast("Name your new list:", "", async (name) => {
        // wait for the id from the server before adding it
        const newList = await apiSave("POST", "/api/lists", { name });
        if (!newList) return;

        lists.push(newList);
        currentListId = newList.id;
        localStorage.setItem("currentListId", currentListId);

        renderSidebar();
        renderTask();
        // straight into the new list on a phone
        openListOnPhone();
    }, "List name...");
});