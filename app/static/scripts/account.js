// ACCOUNT PANEL
// the (i) next to your name in the sidebar. shows your account details,
// lets you change your display name and your password

const accountName = document.getElementById("accountName");
const accountInfoButton = document.getElementById("accountInfoButton");

// small helper so building the panel isn't 100 lines of createElement
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
}

// one "label   value" line
function detailRow(label, value) {
    return el("div", { className: "accountRow" }, [
        el("span", { className: "accountLabel", textContent: label }),
        el("span", { textContent: value }),
    ]);
}

// message under a form. textContent, never innerHTML, the text comes from the server
function setStatus(status, text, ok) {
    status.textContent = text;
    status.classList.toggle("ok", ok);
}

function buildAccountPanel(account) {
    // DETAILS
    const details = el("div", { className: "accountSection" }, [
        el("h3", { textContent: "Account" }),
        detailRow("Username", account.username),
        detailRow("Member since", formatTaskDate(account.createdAt)),
    ]);

    // DISPLAY NAME
    const nameInput = el("input", {
        className: "toastInput",
        value: account.displayName || "",
        // empty = show the username
        placeholder: account.username,
        maxLength: 50,
    });
    const nameStatus = el("p", { className: "accountStatus" });
    const nameForm = el("form", { className: "accountSection" }, [
        el("h3", { textContent: "Display name" }),
        nameInput,
        el("button", { type: "submit", className: "accountButton", textContent: "Save name" }),
        nameStatus,
    ]);
    nameForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const updated = await apiRequest("PATCH", "/api/account", { displayName: nameInput.value });
            const shown = updated.displayName || updated.username;
            accountName.textContent = shown;
            accountName.title = shown;
            nameInput.value = updated.displayName || "";
            setStatus(nameStatus, "Saved", true);
        } catch (err) {
            setStatus(nameStatus, err.message, false);
        }
    });

    

    // PASSWORD
    // hidden username field so the browser's password manager knows which account this is
    const usernameHint = el("input", { type: "text", value: account.username, autocomplete: "username", hidden: true });
    const currentInput = el("input", { type: "password", className: "toastInput", placeholder: "Current password", autocomplete: "current-password", required: true });
    const newInput = el("input", { type: "password", className: "toastInput", placeholder: "New password", autocomplete: "new-password", required: true });
    const confirmInput = el("input", { type: "password", className: "toastInput", placeholder: "Confirm new password", autocomplete: "new-password", required: true });
    const passwordStatus = el("p", { className: "accountStatus" });
    const passwordForm = el("form", { className: "accountSection" }, [
        el("h3", { textContent: "Change password" }),
        usernameHint, currentInput, newInput, confirmInput,
        el("button", { type: "submit", className: "accountButton", textContent: "Change password" }),
        passwordStatus,
    ]);
    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        // only thing the server can't check for us
        if (newInput.value !== confirmInput.value) {
            setStatus(passwordStatus, "New passwords don't match", false);
            return;
        }
        try {
            await apiRequest("POST", "/api/account/password", {
                currentPassword: currentInput.value,
                newPassword: newInput.value,
            });
            passwordForm.reset();
            // reset() clears it too
            usernameHint.value = account.username;
            setStatus(passwordStatus, "Password changed", true);
        } catch (err) {
            setStatus(passwordStatus, err.message, false);
        }
    });

    return el("div", { className: "accountPanel" }, [details, nameForm, passwordForm]);
}

accountInfoButton.addEventListener("click", async () => {
    try {
        // ask the server every time so it's never out of date
        const account = await apiRequest("GET", "/api/account");
        showPanelToast(buildAccountPanel(account));
    } catch (err) {
        console.error(err);
        showToast("Couldn't load your account. Try again?", () => accountInfoButton.click());
    }
});
