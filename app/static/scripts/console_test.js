// copy paste into the f12 console
(async () => {
    // returns { status, data }
    const api = async (method, path, body) => {
        const options = { method, headers: {} };
        if (body !== undefined) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }
        const response = await fetch(path, options);
        const text = await response.text();
        return { status: response.status, data: text ? JSON.parse(text) : null };
    };
    let passed = 0, failed = 0;
    const check = (name, ok, extra = "") => {
        ok ? passed++ : failed++;
        console.log(ok ? "✅" : "❌", name, ok ? "" : extra);
    };
    let r;

    // ---- lists ----
    r = await api("POST", "/api/lists", { name: "  Test API  " });
    check("create list → 201, name trimmed", r.status === 201 && r.data.name === "Test API", JSON.stringify(r));
    const listId = r.data.id;

    r = await api("POST", "/api/lists", { name: "" });
    check("empty name → 400", r.status === 400, JSON.stringify(r));

    r = await api("PATCH", `/api/lists/${listId}`, { name: "Renamed" });
    check("rename list → 200", r.status === 200 && r.data.name === "Renamed", JSON.stringify(r));

    // ---- tasks ----
    const ids = [];
    for (const text of ["A", "B", "C"]) {
        r = await api("POST", `/api/lists/${listId}/tasks`, { text });
        ids.push(r.data.id);
    }
    check("create task → 201", r.status === 201, JSON.stringify(r));

    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "D", color: "#E74C3C", dueDate: "2026-12-01" });
    ids.push(r.data.id);
    check("task with color + date", r.data.color === "#e74c3c" && r.data.dueDate === "2026-12-01", JSON.stringify(r));

    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "X", color: "red" });
    check("bad color → 400", r.status === 400, JSON.stringify(r));
    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "X", dueDate: "2026-13-01" });
    check("bad date → 400", r.status === 400, JSON.stringify(r));
    r = await api("POST", "/api/lists/999999/tasks", { text: "X" });
    check("missing list → 404", r.status === 404, JSON.stringify(r));

    r = await api("PATCH", `/api/tasks/${ids[0]}`, { completed: true });
    check("mark done → 200", r.status === 200 && r.data.completed === true && r.data.text === "A", JSON.stringify(r));
    r = await api("PATCH", `/api/tasks/${ids[3]}`, { color: null });
    check("clear color, keep date", r.data.color === null && r.data.dueDate === "2026-12-01", JSON.stringify(r));
    r = await api("PATCH", `/api/tasks/${ids[1]}`, { completed: "true" });
    check("completed as string → 400", r.status === 400, JSON.stringify(r));

    // ---- reorder ----
    r = await api("PUT", `/api/lists/${listId}/order`, { taskIds: [ids[3], ids[1], 999999] });
    check("reorder → 204", r.status === 204, JSON.stringify(r));
    r = await api("GET", "/api/lists");
    const order = r.data.find(l => l.id === listId).tasks.map(t => t.text).join(",");
    check("right order, unknown id ignored, missing task kept at end", order === "D,B,A,C", order);

    // ---- delete ----
    r = await api("DELETE", `/api/tasks/${ids[2]}`);
    check("delete task → 204", r.status === 204, JSON.stringify(r));
    r = await api("DELETE", `/api/tasks/${ids[2]}`);
    check("delete again → 404", r.status === 404, JSON.stringify(r));

    // ---- errors ----
    r = await api("GET", "/api/does-not-exist");
    check("unknown url → 404 JSON", r.status === 404 && r.data?.error, JSON.stringify(r));
    r = await api("DELETE", "/api/lists");
    check("wrong method → 405 JSON", r.status === 405 && r.data?.error, JSON.stringify(r));

    // ---- cleanup (test list + its tasks) ----
    r = await api("DELETE", `/api/lists/${listId}`);
    check("delete test list → 204", r.status === 204, JSON.stringify(r));

    console.log(`\n${passed} passed, ${failed} failed`);
})();
