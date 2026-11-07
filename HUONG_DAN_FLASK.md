# Hướng dẫn (bản basic): từ app JavaScript đến app Flask chạy trên server

Điểm xuất phát: app chạy hoàn toàn trên trình duyệt, dữ liệu nằm trong `localStorage`.

Điểm đích: app Flask có tài khoản, dữ liệu nằm trong PostgreSQL, deploy lên Render + Neon, mở được trên mọi thiết bị.

**Cách dùng file này:** làm theo thứ tự, mỗi bước có **Mục tiêu**, **Việc cần làm** và **Tự kiểm tra**. Chỉ qua bước sau khi phần kiểm tra đã đúng. Code ở đây chỉ là gợi ý ngắn, phần còn lại bạn tự viết. Tick `[x]` khi xong và commit sau mỗi giai đoạn.

Đây là bản rút gọn: chỉ giữ những gì cần để app chạy đúng, an toàn ở mức cơ bản và đưa vào CV được. Các phần nâng cao nằm ở cuối file, làm sau nếu còn thời gian.

## Bức tranh tổng thể

```
Hiện tại:  Trình duyệt (HTML/CSS/JS) <-> localStorage

Mục tiêu:  Trình duyệt (HTML/CSS/JS) <-> Flask API <-> PostgreSQL
           Điện thoại                <-/   (Render)     (Neon)
```

Cấu trúc thư mục khi xong:

```
ToDoList/
├── app/
│   ├── __init__.py      # create_app(): tạo và cấu hình app
│   ├── extensions.py    # db, migrate, login_manager
│   ├── models.py        # Các bảng trong database
│   ├── pages.py         # Trả về trang HTML
│   ├── api.py           # API JSON
│   ├── auth.py          # Đăng ký, đăng nhập, đăng xuất
│   ├── templates/       # index.html, auth.html
│   └── static/          # images/, scripts/, styles/
├── migrations/          # Tự sinh, lịch sử thay đổi database
├── tests/
├── wsgi.py              # Điểm vào của app
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Giai đoạn 0: Chuẩn bị

**Mục tiêu:** có môi trường Python riêng và một nhánh Git riêng.

- [ ] Tạo nhánh mới, để `main` luôn là bản chạy được:
  ```powershell
  cd "C:\Hung's folder\Learning\Project\ToDoList"
  git switch -c flask-app
  ```
- [ ] Tạo môi trường ảo. Trên máy bạn lệnh `python` ở ngoài không chạy được, nên dùng `py`:
  ```powershell
  py -m venv .venv
  .venv\Scripts\activate
  ```
  Nếu báo "running scripts is disabled", chạy `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` rồi activate lại. Trong môi trường ảo thì dùng `python` và `pip` bình thường.
- [ ] Tạo `.gitignore` có: `.venv/`, `__pycache__/`, `*.pyc`, `.env`, `instance/`, `.pytest_cache/`.
- [ ] Cài Flask: `pip install flask python-dotenv`, rồi ghi vào `requirements.txt`.

**Tự kiểm tra:** `git status` không hiện `.venv`. Dòng lệnh có chữ `(.venv)` ở đầu.

**Cần hiểu:** môi trường ảo là gì? Vì sao không commit `.venv` mà chỉ commit `requirements.txt`?

---

## Giai đoạn 1: Flask đầu tiên

**Mục tiêu:** có server trả lời được trình duyệt.

- [ ] Tạo `app/__init__.py` với hàm `create_app()`. Hàm này tạo `Flask(__name__)`, khai báo route `/` trả về chữ "Hello" rồi `return app`.
- [ ] Tạo `wsgi.py`:
  ```python
  from app import create_app

  app = create_app()
  ```
- [ ] Chạy: `flask --app wsgi run --debug`

**Tự kiểm tra:** mở http://127.0.0.1:5000 thấy "Hello". Sửa chữ trong code, lưu lại, tải lại trang thấy thay đổi.

**Cần hiểu:** route là gì? `--debug` làm gì, và vì sao không được bật nó trên server thật?

---

## Giai đoạn 2: Để Flask phục vụ frontend

**Mục tiêu:** app chạy y như cũ nhưng qua Flask. Dữ liệu vẫn ở `localStorage`.

- [ ] Dùng `git mv` chuyển `images/`, `scripts/`, `styles/` vào `app/static/`, và `index.html` vào `app/templates/`.
- [ ] Tạo `app/pages.py` với một Blueprint, route `/` gọi `render_template("index.html")`. Đăng ký Blueprint trong `create_app()`.
- [ ] Trong `index.html`, đổi mọi đường dẫn sang `url_for`:
  ```html
  <link rel="stylesheet" href="{{ url_for('static', filename='styles/base.css') }}" />
  ```
- [ ] Trong JS có đường dẫn ảnh như `"images/edit.png"`. File JS không qua Jinja nên không dùng được `url_for`, hãy đổi thành `"/static/images/edit.png"`.
- [ ] Đổi `<title>Document</title>` thành tên app.

**Tự kiểm tra:** mở DevTools tab Network, tải lại trang: không có file nào lỗi 404. Mọi tính năng cũ vẫn chạy, kể cả icon sửa và xoá.

**Lưu ý:** `localStorage` tách riêng theo từng địa chỉ. Dữ liệu ở `index.html` mở trực tiếp sẽ không xuất hiện ở `127.0.0.1:5000`. Đây là hành vi bình thường, không phải bug.

**Commit:** `Serve frontend through Flask`

---

## Giai đoạn 3: Database và migration

**Mục tiêu:** có bảng `lists` và `tasks`, tạo bằng migration. Tạm thời dùng SQLite cho đơn giản.

- [ ] Cài `flask-sqlalchemy flask-migrate`.
- [ ] Tạo `app/extensions.py` chứa `db = SQLAlchemy()` và `migrate = Migrate()`. Gọi `init_app(app)` trong `create_app()`. Tách file này để tránh lỗi import vòng.
- [ ] Đặt cấu hình: `SQLALCHEMY_DATABASE_URI = "sqlite:///todo.db"`.
- [ ] Viết `app/models.py` theo thiết kế sau:

  | Bảng `lists` | Kiểu |
  | --- | --- |
  | `id` | Integer, khoá chính |
  | `name` | String(100), bắt buộc |

  | Bảng `tasks` | Kiểu |
  | --- | --- |
  | `id` | Integer, khoá chính |
  | `list_id` | Khoá ngoại tới `lists.id`, bắt buộc, `ondelete="CASCADE"` |
  | `text` | String(500), bắt buộc |
  | `completed` | Boolean, mặc định False |
  | `color` | String(7), không bắt buộc |
  | `due_date` | Date, không bắt buộc |
  | `position` | Integer, thứ tự kéo thả |

- [ ] Khai báo quan hệ một-nhiều bằng `db.relationship`, có `cascade="all, delete-orphan"` và sắp task theo `position`.
- [ ] Thêm hàm `to_dict()` cho mỗi model. JS đang dùng tên `dueDate`, nên hãy trả về đúng tên đó.
- [ ] Tạo migration đầu tiên. Nhớ `create_app()` phải import models thì lệnh `migrate` mới thấy bảng:
  ```powershell
  flask --app wsgi db init
  flask --app wsgi db migrate -m "Create lists and tasks"
  flask --app wsgi db upgrade
  ```

**Tự kiểm tra:** mở file trong `migrations/versions/`, đọc `upgrade()` và `downgrade()`. Chạy `db downgrade` rồi `db upgrade` lại đều không lỗi.

**Cần hiểu:** khoá ngoại là gì? `cascade` làm gì khi xoá một list? Vì sao `id` do database cấp thay vì `Date.now()` như JS đang làm? (Gợi ý: `Date.now()` là số 13 chữ số, còn Integer của Postgres chỉ tới khoảng 2,1 tỷ. SQLite không báo lỗi này, nên lỗi chỉ lộ ra khi lên server.)

**Commit:** `Add database models and first migration`

---

## Giai đoạn 4: Viết REST API

**Mục tiêu:** làm mọi thao tác với dữ liệu qua URL, trả về JSON. Chưa cần đụng vào JS.

- [ ] Tạo `app/api.py` với Blueprint, đăng ký với `url_prefix="/api"`.
- [ ] Viết các route:

  | Method | URL | Việc làm | Thành công |
  | --- | --- | --- | --- |
  | GET | `/api/lists` | Lấy mọi list kèm task | 200 |
  | POST | `/api/lists` | Tạo list `{name}` | 201 |
  | PATCH | `/api/lists/<id>` | Đổi tên | 200 |
  | DELETE | `/api/lists/<id>` | Xoá list | 204 |
  | POST | `/api/lists/<id>/tasks` | Tạo task `{text, color, dueDate}` | 201 |
  | PUT | `/api/lists/<id>/order` | Đổi thứ tự `{taskIds: [...]}` | 204 |
  | PATCH | `/api/tasks/<id>` | Sửa các trường được gửi lên | 200 |
  | DELETE | `/api/tasks/<id>` | Xoá task | 204 |

- [ ] **Không tin dữ liệu từ client.** Viết hàm kiểm tra riêng rồi dùng lại, sai thì `abort(400, "lý do")`:
  - Tên và nội dung là chuỗi, không rỗng sau `strip()`, không quá độ dài.
  - Màu đúng dạng `#rrggbb`.
  - Ngày đọc bằng `date.fromisoformat()`, bắt cả `TypeError` lẫn `ValueError`.
  - `completed` phải là boolean thật.
- [ ] **PATCH chỉ sửa trường có trong request:** dùng `if "color" in data:`. Như vậy `{"color": null}` là xoá màu, còn không gửi `color` thì giữ nguyên.
- [ ] Task mới có `position` bằng số lớn nhất hiện tại cộng 1.
- [ ] Route đổi thứ tự phải chịu được id lạ hoặc thiếu id, vì thiết bị khác có thể vừa thêm hoặc xoá task.
- [ ] Thêm `errorhandler` cho 400 và 404 để API luôn trả JSON thay vì HTML.

**Tự kiểm tra:** mở trang app, F12 tab Console, gọi thử từng API:
```js
await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test" })
}).then(r => r.json())
```
Thử cả trường hợp sai: tên rỗng, màu `"red"`, id không tồn tại. Phải nhận 400 hoặc 404, không được 500.

**Cần hiểu:** khác nhau giữa PUT và PATCH? Vì sao 201 và 204 thay vì luôn trả 200?

**Commit:** `Add REST API for lists and tasks`

---

## Giai đoạn 5: Nối JavaScript với API

**Mục tiêu:** bỏ `localStorage` cho dữ liệu. Đây là phần khó nhất, hãy làm từng tính năng một.

**Quyết định thiết kế quan trọng:** đừng giữ kiểu `saveLists(lists)` gửi cả mảng lên server. Nếu tab trên máy A cũ hơn, nó sẽ ghi đè mất thay đổi vừa làm trên điện thoại. Mỗi thao tác chỉ gửi đúng một thay đổi.

- [ ] Viết lại `storage.js`, bỏ `getLists`, `saveLists`, `migrateOldTasks`:
  - `apiRequest(method, path, body)` gọi `fetch`, ném lỗi khi `!response.ok`, và xử lý riêng 204 vì không có JSON.
  - `save(method, path, body)` bọc `apiRequest`, bắt lỗi và báo cho người dùng qua `showToast`.
  - `loadLists()` gọi `GET /api/lists`.
- [ ] Sửa `main.js`: `lists` ban đầu là `[]`, gọi `await loadLists()` rồi mới render. Thử tắt server để xem lỗi được xử lý thế nào.
- [ ] **Task:** nhờ đã refactor, mọi thay đổi task đều nằm trong 4 hàm của `taskActions.js`. Chỉ cần sửa bên trong 4 hàm đó, phần vẽ, popup và bộ lọc giữ nguyên:
  - [ ] `addTask`: đợi server trả về task (có `id` do server cấp) rồi mới thêm vào mảng. Trong `submitNewTask` của `taskRender.js`, ô nhập đã được xoá trước khi gọi `addTask`, nên bấm Enter hai lần không tạo trùng.
  - [ ] `updateTask(id, changes)`: cập nhật giao diện trước, rồi gửi `PATCH /api/tasks/<id>` với đúng `changes`. Xoá màu hay xoá ngày là gửi `null`.
  - [ ] `deleteTask`: gửi `DELETE /api/tasks/<id>`.
  - [ ] `reorderTasks`: giữ logic `slots`, rồi gửi `PUT /api/lists/<id>/order` với `taskIds` là id của **toàn bộ** task theo thứ tự mới.
- [ ] **List** (trong `sidebar.js`):
  - [ ] Tạo list: đợi server trả về rồi mới thêm, vì server cấp `id`.
  - [ ] Đổi tên và xoá list. Cẩn thận: `sidebar.js` có một hàm cục bộ tên `save` trong phần đổi tên, sẽ trùng tên nếu bạn đặt hàm toàn cục cũng là `save`. Đổi tên một trong hai.
- [ ] Giữ `localStorage` cho `theme`, `sortOrder`, `currentListId`. Đây là tuỳ chọn của từng thiết bị, không cần lưu lên server.
- [ ] Làm mới khi quay lại tab: lắng nghe `visibilitychange` và gọi lại `loadLists()`. Bỏ qua nếu còn request đang lưu dở, nếu không dữ liệu cũ có thể đè lên thay đổi vừa làm.

**Lưu ý về `id` cũ:** dữ liệu trong `localStorage` dùng `id: Date.now()`. Từ bước này `id` do database cấp, nên dữ liệu cũ trong `localStorage` sẽ không dùng nữa. App bắt đầu trống, đó là bình thường.

**Hai bug cũ (kéo thả khi đang lọc làm mất task, Escape khi đổi tên list vẫn lưu) đã được sửa lúc refactor.** Khi đổi sang API, đừng làm mất 2 bản sửa này: giữ logic `slots` trong `reorderTasks` và cờ `finished` trong `sidebar.js`.

**Tự kiểm tra:**
- Làm từng thao tác, tải lại trang, dữ liệu vẫn còn.
- Mở hai cửa sổ: thêm task ở cửa sổ A, chuyển sang tab khác rồi quay lại cửa sổ B, thấy task mới.
- Lọc "Active", kéo thả, bỏ lọc: không mất task nào.
- Tắt server rồi thao tác: có thông báo lỗi, app không treo.

**Cần hiểu:** `async/await` chạy thế nào? "Cập nhật giao diện trước, lưu sau" có lợi gì, và khi lưu lỗi thì cần làm gì?

**Commit:** `Replace localStorage with API calls`

---

## Giai đoạn 6: Tài khoản người dùng

**Mục tiêu:** mỗi người chỉ thấy dữ liệu của mình. Thiếu bước này thì ai có link cũng đọc và xoá được hết, nên **không được bỏ** dù là bản basic.

- [ ] Cài `flask-login`.
- [ ] Thêm model `User`: `id`, `username` (unique, tối đa 32 ký tự), `password_hash` (String 255), `created_at`.
- [ ] Thêm `user_id` vào `TodoList`, khoá ngoại tới `users.id`, bắt buộc.
- [ ] Tạo migration và **đọc kỹ file sinh ra**. Nếu bảng `lists` đã có dữ liệu, thêm cột bắt buộc sẽ lỗi vì dòng cũ không có giá trị. Đang là dữ liệu thử nên cách đơn giản nhất là xoá `instance/todo.db` rồi `db upgrade` lại.
- [ ] Tạo `app/auth.py` với các route:
  - `/register`: kiểm tra username và mật khẩu (tối thiểu 8 ký tự), lưu bằng `generate_password_hash`. Không bao giờ lưu mật khẩu gốc.
  - `/login`: so sánh bằng `check_password_hash`, rồi `login_user(user, remember=True)`.
  - `/logout`: phải là POST, để link hay ảnh ở trang khác không đăng xuất được bạn.
- [ ] Đưa username về chữ thường trước khi lưu và trước khi tìm.
- [ ] Bắt `IntegrityError` khi trùng username, thay vì chỉ kiểm tra trước, vì hai request có thể đến cùng lúc.
- [ ] Tạo `templates/auth.html` dùng chung cho hai trang, hiện lỗi bằng `flash`.
- [ ] Thêm `@login_required` cho `/`. Cho toàn bộ API, dùng `before_request` trên Blueprint.
- [ ] Viết `unauthorized_handler`: URL `/api/...` trả JSON 401, còn lại chuyển hướng đến `/login`. Trong JS, nhận 401 thì chuyển sang `/login`.
- [ ] **Quan trọng nhất:** tìm list và task luôn phải kèm điều kiện người dùng hiện tại:
  ```python
  db.select(TodoList).filter_by(id=list_id, user_id=current_user.id)
  ```
  Task không có `user_id`, nên phải `join` qua `TodoList`. Gom vào hai hàm `get_list_or_404` và `get_task_or_404` để không route nào bỏ sót. Thêm nút đăng xuất và tên người dùng vào sidebar.

**Tự kiểm tra:**
- Chưa đăng nhập: mở `/` bị chuyển về `/login`, gọi `/api/lists` nhận 401.
- Tạo hai tài khoản A và B. B gọi `PATCH /api/tasks/<id của A>` phải nhận 404. Thử đủ mọi route.

**Cần hiểu:** vì sao lưu hash chứ không mã hoá mật khẩu? Vì sao trả 404 thay vì 403 khi truy cập dữ liệu của người khác? Lỗi này tên là IDOR, hay gặp khi phỏng vấn. Session và cookie hoạt động thế nào?

**Commit:** `Add user accounts`

---

## Giai đoạn 7: Cấu hình và bảo mật

**Mục tiêu:** không để lộ bí mật trong code, sẵn sàng cho môi trường public.

- [ ] **SECRET_KEY:** đọc từ biến môi trường, thiếu thì `raise` ngay khi khởi động. Không hardcode trong code. Tạo khoá ngẫu nhiên:
  ```powershell
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Tạo `.env` (không commit) và `.env.example` (commit, chỉ có giá trị mẫu).
- [ ] **Cookie:** bật `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE="Lax"`, `SESSION_COOKIE_SECURE`, và các cấu hình `REMEMBER_COOKIE_*` tương ứng.
- [ ] Cookie Secure chỉ gửi qua HTTPS, nên trên máy bạn sẽ đăng nhập xong lại bị đẩy về login. Hãy đọc biến `COOKIE_SECURE`, mặc định bật, và đặt `COOKIE_SECURE=0` trong `.env`.
- [ ] **CSRF:** cài `flask-wtf`, bật `CSRFProtect` trong `extensions.py` và `init_app(app)`.
  - Form HTML (đăng ký, đăng nhập, đăng xuất) thêm `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}" />`.
  - Trang chính thêm `<meta name="csrf-token" content="{{ csrf_token() }}" />`. Trong `apiRequest`, JS đọc thẻ này và gửi trong header `X-CSRFToken` với mọi request không phải GET.
  - Đặt `WTF_CSRF_TIME_LIMIT = None`. Mặc định token hết hạn sau 1 giờ, nên tab mở lâu sẽ không lưu được.
- [ ] **Giới hạn đăng nhập:** cài `flask-limiter`, cho phép 10 lần mỗi phút trên `/login`. Trên Render, IP nhìn thấy có thể là của proxy, nên hãy giới hạn theo username (dùng `key_func` đọc username từ form).
- [ ] **Đóng đăng ký:** thêm biến `REGISTRATION_OPEN`, để sau khi có tài khoản thì chặn người lạ tạo thêm.

**Tự kiểm tra:**
- Xoá `.env` thì app báo lỗi rõ ràng khi chạy. Đăng nhập ở máy vẫn bình thường khi `COOKIE_SECURE=0`.
- Gọi `fetch` POST trong Console mà không có header `X-CSRFToken` thì nhận 400. Mọi thao tác trong app vẫn lưu được.
- Sai mật khẩu 11 lần liên tiếp thì nhận 429.

**Cần hiểu:** `SECRET_KEY` dùng để làm gì? CSRF là gì, và cookie `SameSite` giúp gì? `HttpOnly` chống được loại tấn công nào? Vì sao rate limit theo username chứ không theo IP?

**Commit:** `Harden configuration for production`

---

## Giai đoạn 8: Vài test quan trọng

**Mục tiêu:** có test cho những chỗ dễ hỏng nhất. Không cần test hết mọi thứ.

- [ ] Cài `pytest`, tạo `tests/test_app.py`.
- [ ] Viết fixture tạo app với database tạm (dùng `tmp_path`), `TESTING=True`, tắt CSRF (`WTF_CSRF_ENABLED=False`) và rate limit (`RATELIMIT_ENABLED=False`), gọi `db.create_all()`.
- [ ] Viết khoảng 4 test:
  - [ ] Chưa đăng nhập thì `/api/lists` trả 401.
  - [ ] Đăng ký, đăng nhập rồi gọi được API.
  - [ ] Tạo, sửa, xoá một task.
  - [ ] **Người dùng B không sửa hay xoá được task của A** (nhận 404).

**Tự kiểm tra:** `pytest` xanh hết. Thử tạm xoá `user_id=current_user.id` trong `get_list_or_404`: test cuối phải đỏ. Nếu vẫn xanh thì test chưa kiểm tra đúng thứ cần kiểm tra.

**Commit:** `Add basic tests`

---

## Giai đoạn 9: Chuyển sang PostgreSQL

**Mục tiêu:** code chạy được với database thật, không chỉ SQLite.

- [ ] Cài `psycopg[binary]`.
- [ ] Đọc `DATABASE_URL` từ biến môi trường, nếu không có thì dùng SQLite.
- [ ] Các dịch vụ đưa URL dạng `postgresql://...` hoặc `postgres://...`, còn SQLAlchemy cần biết driver. Hãy viết hàm đổi phần đầu thành `postgresql+psycopg://`.
- [ ] Đặt `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300}`. Neon tắt database khi rảnh, nên phải kiểm tra kết nối trước khi dùng.
- [ ] Trên Neon, tạo một project riêng cho app này (đừng dùng chung với project khác). Đặt connection string vào `DATABASE_URL` trong `.env`, chạy `flask --app wsgi db upgrade`, rồi dùng thử app ở máy.

**Tự kiểm tra:** mở SQL Editor trên Neon, chạy `select * from tasks;` và thấy task vừa tạo ở máy.

**Commit:** `Support PostgreSQL`

---

## Giai đoạn 10: Deploy lên Render + Neon

**Mục tiêu:** app có link public. Giao diện của Render và Neon có thể khác đôi chút so với mô tả.

- [ ] Cài `gunicorn`, rồi cập nhật `requirements.txt` cho đủ các thư viện bạn dùng trực tiếp. Xem phiên bản đang cài bằng `pip freeze`.
- [ ] Thêm route `/healthz` trả `{"status": "ok"}`, để Render biết app còn sống.
- [ ] Thêm `ProxyFix` trong `create_app()`. Render xử lý HTTPS rồi chuyển tiếp vào app, không có nó thì Flask tưởng mọi request là HTTP:
  ```python
  app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
  ```
- [ ] Cập nhật `README.md`: bỏ phần "mở `index.html`", thêm link demo, cách chạy và mô tả tính năng mới.
- [ ] Merge vào `main` và push lên GitHub. Kiểm tra `.env` không có trong commit:
  ```powershell
  git ls-files | Select-String "\.env"
  ```
  Kết quả chỉ được có `.env.example`.
- [ ] **Render:** tạo **New > Web Service**, chọn repo, gói Free, rồi điền:

  | Mục | Giá trị |
  | --- | --- |
  | Build Command | `pip install -r requirements.txt` |
  | Start Command | `flask --app wsgi db upgrade && gunicorn wsgi:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT` |
  | Health Check Path | `/healthz` |

- [ ] Thêm biến môi trường trên Render:

  | Biến | Giá trị |
  | --- | --- |
  | `SECRET_KEY` | Chuỗi ngẫu nhiên mới, khác với ở máy |
  | `DATABASE_URL` | Connection string của Neon. Giữ bí mật vì nó chứa mật khẩu |
  | `PYTHON_VERSION` | `3.13.5`, hoặc đúng bản bạn đang dùng |

- [ ] Deploy và đọc tab Logs. Nếu lỗi, hãy đọc dòng lỗi cuối cùng trước tiên.

**Vì sao như vậy:**
- `gunicorn` thay cho `flask run`, vì server dev của Flask không dành cho production. Gunicorn không chạy trên Windows, nên ở máy bạn vẫn dùng `flask run`.
- `db upgrade` chạy trước `gunicorn`, để database luôn khớp với code.
- `--workers 1` vì gói Free ít RAM, và rate limit đang lưu trong RAM của từng worker. Nhiều worker thì mỗi worker đếm riêng, giới hạn sẽ bị nhân lên.

**Tự kiểm tra sau khi deploy:**
- [ ] Mở link, thấy trang đăng nhập, thanh địa chỉ có HTTPS.
- [ ] Tạo tài khoản, thêm task, tải lại trang.
- [ ] Đăng nhập trên điện thoại bằng dữ liệu di động, thấy cùng dữ liệu.
- [ ] Đặt `REGISTRATION_OPEN=0` trên Render. Thử đăng ký phải bị chặn, đăng nhập vẫn được.

**Lưu ý:** gói Free ngủ khi không có truy cập, nên lần mở đầu tiên có thể mất tới một phút. Hãy kiểm tra giới hạn hiện tại của Render và Neon vì chúng có thể thay đổi.

**Commit:** `Deploy to Render`

---

## Quy trình mỗi lần cập nhật

1. Sửa code trên một nhánh mới, chạy thử ở máy, chạy `pytest`.
2. Nếu đổi `models.py`, tạo migration và đọc lại file sinh ra.
3. Merge vào `main` và push. Render tự deploy và tự chạy migration.

---

## Làm thêm nếu còn thời gian (không bắt buộc)

Xếp theo thứ tự nên làm trước:

- **Thêm test:** PATCH một trường không đổi trường khác, đổi thứ tự với id lạ, dữ liệu sai bị từ chối (dùng `@pytest.mark.parametrize`).
- **Giao diện điện thoại:** tạo `styles/responsive.css` với `@media (max-width: 700px)`: sidebar rộng 100%, task `flex-wrap`, chữ dài `overflow-wrap: anywhere`, ô nhập `font-size: 16px` để iPhone không tự phóng to. Kéo thả HTML5 không chạy trên màn hình cảm ứng, có thể thêm nút lên và xuống.
- **GitHub Actions:** chạy `pytest` tự động mỗi lần push.
- **Nhập dữ liệu cũ** từ `localStorage` lên server.

---

## Khi bị lỗi

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| `No such command "db"` | Chưa cài hoặc chưa `init_app` Flask-Migrate, hoặc thiếu `--app wsgi` |
| `db migrate` không thấy bảng nào | `create_app()` chưa import models |
| CSS hoặc ảnh lỗi 404 | Chưa dùng `url_for`, hoặc JS vẫn dùng đường dẫn cũ |
| Đăng nhập xong lại về `/login` | Cookie Secure trên HTTP, cần `COOKIE_SECURE=0` trong `.env` |
| POST báo 400 "CSRF token missing" | Thiếu `csrf_token` trong form, hoặc thiếu header `X-CSRFToken` |
| Test đăng nhập bị 400 hoặc 429 | Fixture chưa tắt CSRF hoặc rate limit |
| `SECRET_KEY is not set` | Thiếu `.env`, hoặc đang đứng sai thư mục |
| Chạy ở máy được, trên Render báo lỗi driver | Thiếu `psycopg` hoặc chưa đổi URL sang `postgresql+psycopg://` |
| Trên Render thỉnh thoảng lỗi kết nối database | Thiếu `pool_pre_ping` |
| Trên Render lỗi `relation "..." does not exist` | Migration chưa chạy, hoặc chưa commit thư mục `migrations/` |

## Câu hỏi phỏng vấn nên trả lời được

1. Luồng dữ liệu khi bấm "Add" đi qua những đâu, từ JS tới database?
2. Vì sao mỗi thao tác gửi một request thay vì gửi cả danh sách?
3. Làm sao đảm bảo người dùng này không đọc được dữ liệu của người khác?
4. Mật khẩu được lưu thế nào? Session hoạt động ra sao?
5. Migration để làm gì? Thêm cột bắt buộc vào bảng đã có dữ liệu thì xử lý sao?
6. Vì sao không dùng `flask run` trên production?
7. `SECRET_KEY` để làm gì? Nếu lộ thì chuyện gì xảy ra?
8. CSRF là gì và project chống nó thế nào? Rate limit đăng nhập hoạt động ra sao?
9. Nếu có 10.000 người dùng thì phần nào sẽ gặp vấn đề trước?
