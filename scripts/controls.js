// ---- Bộ lọc và sắp xếp ----
// Chỉ quyết định task nào được HIỆN và hiện theo thứ tự nào.
// Không bao giờ sửa dữ liệu.

// Menu thả xuống dùng chung cho Filter và Sort:
// bấm nút để mở/đóng, bấm ra ngoài để đóng, chọn một mục thì gọi onChange.
function setupDropdown(toggleId, menuId, onChange) {
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("open");
    });
    menu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => menu.classList.remove("open"));

    menu.querySelectorAll("input").forEach(radio => {
        radio.addEventListener("change", () => {
            onChange(radio.value);
            menu.classList.remove("open");
        });
    });
}

// "all" | "active" | "completed"
let currentFilter = "all";
setupDropdown("filterToggle", "filterMenu", (value) => {
    currentFilter = value;
    renderTask();
});

function filterTasks(tasks) {
    if (currentFilter === "active") return tasks.filter(t => !t.completed);
    if (currentFilter === "completed") return tasks.filter(t => t.completed);
    return tasks;
}

// "manual" | "earliest" | "latest" | "color". Nhớ qua các lần tải trang.
let currentSort = localStorage.getItem("sortOrder") || "manual";
const savedSortRadio = document.querySelector(`input[name="sort"][value="${currentSort}"]`);
if (savedSortRadio) savedSortRadio.checked = true;

setupDropdown("sortToggle", "sortMenu", (value) => {
    currentSort = value;
    localStorage.setItem("sortOrder", value);
    renderTask();
});

// Trả về mảng MỚI đã sắp xếp, không đụng vào mảng gốc.
function sortTasks(tasks) {
    if (currentSort === "earliest" || currentSort === "latest") {
        const withDate = tasks.filter(t => t.dueDate);
        const withoutDate = tasks.filter(t => !t.dueDate);   // không có hạn: luôn xếp cuối
        withDate.sort((a, b) => currentSort === "earliest"
            ? a.dueDate.localeCompare(b.dueDate)
            : b.dueDate.localeCompare(a.dueDate));
        return [...withDate, ...withoutDate];
    }

    if (currentSort === "color") {
        const colorOrder = TASK_COLORS.map(c => c.value);   // theo thứ tự trong bảng màu
        const withColor = tasks.filter(t => t.color);
        const withoutColor = tasks.filter(t => !t.color);   // không có màu: luôn xếp cuối
        withColor.sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
        return [...withColor, ...withoutColor];
    }

    return tasks;
}
