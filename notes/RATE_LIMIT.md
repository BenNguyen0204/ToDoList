# Ghi chú: Rate limit với Flask-Limiter

## Rate limit là gì?

Giới hạn số lần một người được gọi một route trong một khoảng thời gian. Ví dụ: "tối đa 5 lần đăng nhập mỗi phút".

Vượt quá thì Flask trả **429 Too Many Requests**, route không chạy nữa.

Giống ATM: nhập sai PIN 3 lần là bị khoá thẻ, không cho thử tiếp.

---

## Vì sao cần?

`/login` trong `auth.py` hiện cho thử mật khẩu **không giới hạn**. Kẻ xấu viết script thử hàng nghìn mật khẩu cho user `ben` cho tới khi trúng. Kiểu tấn công này gọi là **brute force**.

- `generate_password_hash` chậm sẵn nên mỗi lần thử tốn thời gian hơn, nhưng **không chặn được**.
- Rate limit mới chặn: sai vài lần, thử tiếp chỉ nhận 429.

Route cần giới hạn:

| Route | Vì sao |
|---|---|
| `POST /login` | Chống đoán mật khẩu |
| `POST /register` | Chống tạo hàng loạt tài khoản rác |

---

## Cài đặt

```powershell
pip install Flask-Limiter
pip freeze > requirements.txt
```

---

## Cách dùng

Giống `db`, `migrate`, `login_manager`: tạo trong `extensions.py`, gắn vào app trong `create_app()`.

```python
# extensions.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# key_func: đếm theo cái gì. get_remote_address = theo IP
limiter = Limiter(key_func=get_remote_address)
```

```python
# __init__.py, trong create_app()
from .extensions import limiter
limiter.init_app(app)
```

```python
# auth.py
from .extensions import limiter

@blueprint.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])   # chỉ đếm lúc gửi form, mở trang không tính
def login():
    ...
```

### Cách viết giới hạn

| Chuỗi | Nghĩa |
|---|---|
| `"5 per minute"` | 5 lần / phút |
| `"10 per hour"` | 10 lần / giờ |
| `"100 per day"` | 100 lần / ngày |
| `"5/minute;50/day"` | Cả hai cùng lúc, vượt cái nào cũng bị chặn |

### `key_func` là gì?

Mỗi giá trị key có **một bộ đếm riêng**.

```
key = IP           -> 1.2.3.4 có bộ đếm riêng, 5.6.7.8 có bộ đếm riêng
key = username     -> "ben" có bộ đếm riêng, "hung" có bộ đếm riêng
```

---

## Đếm theo IP hay username?

| Đếm theo | Chặn được | Lỗ hổng |
|---|---|---|
| **IP** | Một máy thử rất nhiều tài khoản | Đổi IP liên tục (VPN, botnet) là né được |
| **Username** | Thử nhiều mật khẩu cho **một** tài khoản, đổi bao nhiêu IP cũng vậy | Kẻ xấu cố tình gõ sai để khoá tạm tài khoản người khác |

Mục tiêu là bảo vệ **tài khoản**, nên chính là đếm theo **username**. Thêm giới hạn theo IP để một máy không spam được quá nhiều. **Dùng cả hai:**

```python
def username_key():
    # giống read_form(): lowercase để "Ben" và "ben" chung một bộ đếm
    return request.form.get("username", "").strip().lower()

@blueprint.route("/login", methods=["GET", "POST"])
@limiter.limit("10 per hour", key_func=username_key, methods=["POST"])  # mỗi tài khoản
@limiter.limit("20 per minute", methods=["POST"])                      # mỗi IP
def login():
    ...
```

Nhớ `lower()`. Nếu không, kẻ xấu thử `Ben`, `BEN`, `bEn`... mỗi kiểu được một bộ đếm mới, trong khi tất cả đều là cùng một tài khoản.

### Chỉ đếm lần đăng nhập SAI

Mặc định mọi lần POST đều bị đếm, kể cả đăng nhập đúng. Có thể chỉ trừ lượt khi sai:

```python
@limiter.limit(
    "10 per hour",
    key_func=username_key,
    methods=["POST"],
    # login sai -> render lại trang -> 200. login đúng -> redirect -> 302
    deduct_when=lambda response: response.status_code == 200,
)
```

---

## Khi bị chặn (429)

Flask-Limiter trả trang lỗi 429 mặc định, khá xấu. Có thể bắt lỗi rồi hiện thông báo trên trang login:

```python
from flask import flash, render_template

@app.errorhandler(429)
def too_many_requests(error):
    if request.path.startswith("/api/"):
        return jsonify(error="Too many requests, slow down"), 429
    flash("Too many attempts. Try again later.")
    return render_template("auth.html", mode="login", username=""), 429
```

Hoặc thêm `429` vào vòng `for code in (400, 404, 405)` trong `register_error_handlers` ở `api.py` cho phần `/api/`.

---

## Khi deploy

### 1. Bộ đếm lưu ở đâu?

Mặc định lưu trong **RAM** (`memory://`):

- Restart server -> mất hết bộ đếm.
- Gunicorn chạy nhiều worker -> mỗi worker đếm riêng. 4 worker thì thực tế cho thử gấp 4 lần.

Production dùng Redis để mọi worker dùng chung một bộ đếm:

```python
limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
```

Trên máy thì `memory://` là đủ.

### 2. Chạy sau proxy

Render, Heroku, nginx... đều đứng giữa người dùng và Flask. IP mà Flask thấy là **IP của proxy**, nên mọi người dùng chung một bộ đếm theo IP: 1 người spam là tất cả bị chặn.

Sửa bằng `ProxyFix` để đọc IP thật từ header `X-Forwarded-For`:

```python
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)   # 1 = có 1 lớp proxy phía trước
```

Không bật `ProxyFix` khi **không** có proxy: lúc đó ai cũng tự gửi `X-Forwarded-For` giả để đổi IP được.

### 3. Khi test

Tắt limiter, không thì test gọi `/login` nhiều lần sẽ bị 429:

```python
app.config["RATELIMIT_ENABLED"] = False
```

---

## Thử tận tay

1. Thêm `@limiter.limit("3 per minute", methods=["POST"])` vào `/login`.
2. Đăng nhập sai 4 lần liên tiếp.
3. Lần thứ 4 nhận 429.
4. Đợi 1 phút, thử lại được.

---

## Tóm tắt

- Rate limit = giới hạn số lần gọi route trong một khoảng thời gian, vượt thì 429.
- Cần cho `/login` (chống đoán mật khẩu) và `/register` (chống spam tài khoản).
- `key_func` quyết định đếm theo gì. Dùng **cả username lẫn IP**.
- Username nhớ `lower()`, không thì đổi hoa thường là né được.
- Deploy: bộ đếm để trong Redis, chạy sau proxy thì cần `ProxyFix`.
- Test: `RATELIMIT_ENABLED=False`.
