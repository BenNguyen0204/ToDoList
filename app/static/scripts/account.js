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

// one cell of the grey info box: small grey label on top, value under it
function infoItem(label, value) {
    return el("div", { className: "accountInfoItem" }, [
        el("span", { className: "accountLabel", textContent: label }),
        el("span", { className: "accountValue", textContent: value }),
    ]);
}

// message under a form. textContent, never innerHTML, the text comes from the server
function setStatus(status, text, ok) {
    status.textContent = text;
    status.classList.toggle("ok", ok);
}

function buildAccountPanel(account) {
    // HEADER: title, one line under it, x to close
    const header = el("div", { className: "accountHeader" }, [
        el("div", {}, [
            el("h2", { textContent: "Account" }),
            el("p", { className: "accountSubtitle", textContent: "Manage your profile and security options." }),
        ]),
        el("button", {
            type: "button",
            className: "accountClose",
            textContent: "\u00d7",
            title: "Close",
            ariaLabel: "Close",
            onclick: closeToast,
        }),
    ]);

    // DETAILS: grey box, 2 columns
    const details = el("div", { className: "accountInfo" }, [
        infoItem("Username", account.username),
        infoItem("Member since", formatTaskDate(account.createdAt)),
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
        // input and button side by side
        el("div", { className: "accountInline" }, [
            nameInput,
            el("button", { type: "submit", className: "accountButton", textContent: "Save name" }),
        ]),
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

    // EMAIL
    // optional. once it's verified you get an email the day before a task is due
    const emailInput = el("input", {
        type: "email",
        className: "toastInput",
        value: account.email || "",
        placeholder: "you@example.com",
        autocomplete: "email",
        maxLength: 254,
    });
    const emailState = el("p", { className: "accountHint" });
    const resendButton = el("button", { type: "button", className: "accountLink", textContent: "Resend link" });
    const emailStatus = el("p", { className: "accountStatus" });

    // the line under the input: verified or not, and the resend button when it's waiting
    function showEmailState(acc) {
        resendButton.hidden = !acc.email || acc.emailVerified;
        if (!acc.email) {
            emailState.textContent = "Add an email to get a reminder the day before a task is due.";
        } else if (acc.emailVerified) {
            emailState.textContent = "✓ Verified. Reminders are on.";
        } else {
            emailState.textContent = "Not verified yet. Check your inbox for the link.";
        }
    }
    showEmailState(account);

    const emailForm = el("form", { className: "accountSection" }, [
        el("h3", { textContent: "Email" }),
        el("div", { className: "accountInline" }, [
            emailInput,
            el("button", { type: "submit", className: "accountButton", textContent: "Save email" }),
        ]),
        // "verified / not verified" text, with the resend link next to it when it's waiting
        el("div", { className: "accountHintRow" }, [emailState, resendButton]),
        emailStatus,
    ]);
    emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const updated = await apiRequest("PUT", "/api/account/email", { email: emailInput.value });
            emailInput.value = updated.email || "";
            showEmailState(updated);
            if (updated.warning) setStatus(emailStatus, updated.warning, false);
            else if (!updated.email) setStatus(emailStatus, "Email removed", true);
            else if (!updated.emailVerified) setStatus(emailStatus, "Saved. We sent you a verification link.", true);
            else setStatus(emailStatus, "Saved", true);
        } catch (err) {
            setStatus(emailStatus, err.message, false);
        }
    });
    resendButton.addEventListener("click", async () => {
        try {
            await apiRequest("POST", "/api/account/email/resend");
            setStatus(emailStatus, "Sent. Check your inbox.", true);
        } catch (err) {
            setStatus(emailStatus, err.message, false);
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
        // button on its own row, pushed to the right
        el("div", { className: "accountActions" }, [
            el("button", { type: "submit", className: "accountButton", textContent: "Change password" }),
        ]),
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

    return el("div", { className: "accountPanel" }, [
        header,
        el("div", { className: "accountBody" }, [details, nameForm, emailForm, passwordForm]),
    ]);
}

// reminders go out for "tomorrow" in your timezone, so the server needs to know it.
// only sends it when it's different from what the server has (first visit, or you moved)
async function syncTimezone() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    try {
        const account = await apiRequest("GET", "/api/account");
        if (account.timezone !== zone) {
            await apiRequest("PATCH", "/api/account", { timezone: zone });
        }
    } catch (err) {
        // not worth bothering the user, reminders just use UTC until next time
        console.error(err);
    }
}
syncTimezone();

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