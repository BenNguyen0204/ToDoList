// copy paste tren f12 console
(async () => {
    // Hàm gửi request, trả về { status, data }
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

    // ---- List ----
    r = await api("POST", "/api/lists", { name: "  Test API  " });
    check("Tạo list → 201, tên đã bỏ khoảng trắng", r.status === 201 && r.data.name === "Test API", JSON.stringify(r));
    const listId = r.data.id;

    r = await api("POST", "/api/lists", { name: "" });
    check("Tên rỗng → 400", r.status === 400, JSON.stringify(r));

    r = await api("PATCH", `/api/lists/${listId}`, { name: "Đổi tên" });
    check("Đổi tên list → 200", r.status === 200 && r.data.name === "Đổi tên", JSON.stringify(r));

    // ---- Task ----
    const ids = [];
    for (const text of ["A", "B", "C"]) {
        r = await api("POST", `/api/lists/${listId}/tasks`, { text });
        ids.push(r.data.id);
    }
    check("Tạo task → 201", r.status === 201, JSON.stringify(r));

    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "D", color: "#E74C3C", dueDate: "2026-12-01" });
    ids.push(r.data.id);
    check("Task có màu + ngày", r.data.color === "#e74c3c" && r.data.dueDate === "2026-12-01", JSON.stringify(r));

    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "X", color: "red" });
    check("Màu sai → 400", r.status === 400, JSON.stringify(r));
    r = await api("POST", `/api/lists/${listId}/tasks`, { text: "X", dueDate: "2026-13-01" });
    check("Ngày sai → 400", r.status === 400, JSON.stringify(r));
    r = await api("POST", "/api/lists/999999/tasks", { text: "X" });
    check("List không tồn tại → 404", r.status === 404, JSON.stringify(r));

    r = await api("PATCH", `/api/tasks/${ids[0]}`, { completed: true });
    check("Tick hoàn thành → 200", r.status === 200 && r.data.completed === true && r.data.text === "A", JSON.stringify(r));
    r = await api("PATCH", `/api/tasks/${ids[3]}`, { color: null });
    check("Xoá màu, giữ ngày", r.data.color === null && r.data.dueDate === "2026-12-01", JSON.stringify(r));
    r = await api("PATCH", `/api/tasks/${ids[1]}`, { completed: "true" });
    check("completed là chuỗi → 400", r.status === 400, JSON.stringify(r));

    // ---- Đổi thứ tự ----
    r = await api("PUT", `/api/lists/${listId}/order`, { taskIds: [ids[3], ids[1], 999999] });
    check("Đổi thứ tự → 204", r.status === 204, JSON.stringify(r));
    r = await api("GET", "/api/lists");
    const order = r.data.find(l => l.id === listId).tasks.map(t => t.text).join(",");
    check("Thứ tự đúng, id lạ bỏ qua, task thiếu giữ ở cuối", order === "D,B,A,C", order);

    // ---- Xoá ----
    r = await api("DELETE", `/api/tasks/${ids[2]}`);
    check("Xoá task → 204", r.status === 204, JSON.stringify(r));
    r = await api("DELETE", `/api/tasks/${ids[2]}`);
    check("Xoá lại → 404", r.status === 404, JSON.stringify(r));

    // ---- Lỗi chung ----
    r = await api("GET", "/api/khong-co");
    check("URL lạ → 404 JSON", r.status === 404 && r.data?.error, JSON.stringify(r));
    r = await api("DELETE", "/api/lists");
    check("Sai method → 405 JSON", r.status === 405 && r.data?.error, JSON.stringify(r));

    // ---- Dọn dẹp: xoá list test (task của nó bị xoá theo) ----
    r = await api("DELETE", `/api/lists/${listId}`);
    check("Xoá list test → 204", r.status === 204, JSON.stringify(r));

    console.log(`\n${passed} passed, ${failed} failed`);
})();
