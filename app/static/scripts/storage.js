let pendingSaves = 0;

async function apiRequest(method, path, body) {
    const options = {method: method, headers: {} };
    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);

    if (!response.ok) {
        throw new Error('${method} ${path} failed: ${response.status}');
    }

    // 204 la no content
    if (response.status === 204) return null;

    return response.json();
}
// pendingSaves cho biết hiện có bao nhiêu request lưu đang gửi đi mà chưa xong.
// Bắt đầu lưu thì pendingSaves++
// Lưu xong (thành công hay lỗi đều vậy, nhờ finally) thì pendingSaves--

async function apiSave(method, path, body) {
    pendingSave++;
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
    // lists.some(...) duyệt hết mọi list để xem list đang chọn còn không.
    // lists[0] chỉ chạy khi bước 1 không tìm thấy.
    if (!lists.some(l => l.id === currentListId)) {
        currentListId = lists[0]?.id?? null;
    }
}

// Frontend trong main.js
function getCurrentList() {
    return lists.find(l => l.id === currentListId) || null;
}

function getTasks() {
    return getCurrentList()?.tasks || [];
}