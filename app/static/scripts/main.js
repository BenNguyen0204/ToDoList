// Biến toàn cục, mọi file JS khác đều dùng.
// lists ban đầu rỗng: phải đợi tải từ server.
let lists = [];
let currentListId = Number(localStorage.getItem("currentListId")) || null;

// Chạy khi mở trang: lấy dữ liệu từ server trước, rồi mới vẽ giao diện.
async function init() {
    try {
        await loadList();
    } catch(e) {
        // Tải lỗi thì báo cho người dùng và dừng lại, vì chưa có dữ liệu để vẽ.
        // Truyền init vào toast để người dùng có thể thử tải lại.
        console.eror(e);
        showToast("Couldn't load your lists. Try again?", init);
        return;
    }
    renderSidebar();
    renderTask();
}

init();

// Chạy mỗi khi tab đổi trạng thái (ẩn đi hoặc hiện lại).
// Mục đích: khi quay lại tab thì lấy dữ liệu mới, phòng khi tab hoặc máy khác đã sửa.
document.addEventListener("visibilitychange", async () => {
    // Bỏ qua nếu tab đang ẩn, hoặc còn request lưu chưa xong
    // (tải lại lúc này có thể lấy dữ liệu cũ đè lên thay đổi vừa làm).
    if (document.visibilityState != "visible" || pendingSaves > 0) return;
    try {
        await loadList();
        renderSidebar();
        rendereTask();
    } catch (err) {
        // Đây chỉ là làm mới ngầm, nên lỗi thì ghi vào console, không làm phiền người dùng.
        console.error(err);
    }
});
