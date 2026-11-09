# Ghi chú: Session cookie và SECRET_KEY

## Vấn đề

HTTP không có trí nhớ. Mỗi request tới Flask đều như của một người lạ, server không biết request này với request lúc nãy có phải của cùng một người không.

Vậy sau khi đăng nhập, làm sao server biết các request tiếp theo là của mình? Câu trả lời là **cookie**.

---

## Cookie là gì?

Cookie là một đoạn dữ liệu nhỏ mà server bảo trình duyệt cất giữ. Từ đó, **mỗi request** gửi tới trang đó, trình duyệt đều tự gửi kèm cookie lên.

Có thể hình dung như vé gửi xe: lần đầu bãi đưa vé, lần sau mình chỉ cần đưa vé ra là bãi biết xe nào của mình.

---

## Session cookie trong Flask

Flask có sẵn một dict tên `session`. Ghi gì vào đó thì Flask tự nhét vào một cookie tên `session` rồi gửi về trình duyệt.

```
1. Đăng nhập     -> server ghi session["_user_id"] = "5"
2. Server trả về -> Set-Cookie: session=eyJfdXNlcl9pZCI6IjUifQ.Zx3k...
3. Request sau   -> trình duyệt tự gửi Cookie: session=...
4. Flask đọc     -> session["_user_id"] == "5" -> biết là user 5
```

Flask không lưu session ở server. **Toàn bộ dữ liệu nằm trong cookie ở trình duyệt.**

---

## Flask-Login làm gì?

Flask-Login lo phần đăng nhập dựa trên `session`:

| Hàm / thứ | Nó làm gì |
|---|---|
| `login_user(user)` | Ghi id của user vào `session` |
| `@login_manager.user_loader` | Mỗi request, lấy id từ cookie rồi tìm `User` trong database |
| `current_user` | User đang đăng nhập (hoặc user ẩn danh nếu chưa đăng nhập) |
| `@login_required` | Chặn route nếu chưa đăng nhập, gọi `unauthorized_handler` |
| `logout_user()` | Xoá id khỏi `session` |

Trong project:

- `app/auth.py`: `login_user(user, remember=True)` khi đăng ký / đăng nhập thành công.
- `app/__init__.py`: `load_user` đổi id thành `User`. `unauthorized` trả 401 cho `/api/...`, còn trang thường thì chuyển về `/login`.
- `app/api.py`: mọi query đều lọc theo `current_user.id`, nên không ai sửa được list của người khác.

**Chỉ lưu id trong cookie, không lưu cả object User.** Mỗi request lại đọc User từ database, nên nếu user bị xoá thì cookie cũ cũng hết tác dụng.

### `remember=True`

Cookie `session` mặc định sẽ mất khi đóng trình duyệt. `remember=True` tạo thêm một cookie `remember_token` sống lâu hơn (mặc định 365 ngày), nên đóng trình duyệt mở lại vẫn còn đăng nhập.

---

## SECRET_KEY để làm gì?

Cookie `session` **được ký, không được mã hoá**.

- **Không mã hoá:** ai cũng giải ra đọc được, thấy rõ `{"_user_id": "5"}`.
- **Có ký:** Flask lấy dữ liệu + `SECRET_KEY` tính ra một chữ ký rồi gắn vào cuối cookie.

Khi cookie gửi lên, Flask tính lại chữ ký và so:

```
Cookie gốc:   {"_user_id": "5"} + chữ ký đúng        -> OK
Bị sửa:       {"_user_id": "1"} + chữ ký cũ          -> không khớp, bỏ cookie
```

Muốn tạo chữ ký đúng cho dữ liệu mới thì phải biết `SECRET_KEY`. Nên:

> **SECRET_KEY chống SỬA cookie, không chống ĐỌC cookie.**

Giống con dấu giáp lai: ai cũng đọc được giấy, nhưng sửa chữ thì con dấu không khớp nữa.

### Nếu lộ SECRET_KEY thì sao?

Người khác tự tạo được cookie `{"_user_id": "1"}` với chữ ký hợp lệ, tức là **đăng nhập vào tài khoản bất kỳ mà không cần mật khẩu**.

Cách xử lý: đổi `SECRET_KEY`. Mọi cookie cũ không còn khớp chữ ký, nên tất cả mọi người bị đăng xuất (kể cả kẻ xấu).

### Hiện tại trong project

```python
app.config["SECRET_KEY"] = "dev-only-change-me"
```

Tạm ổn khi code trên máy, nhưng key này **đã nằm trên GitHub**, ai cũng đọc được. Trước khi deploy (giai đoạn 7):

```python
import os

secret = os.environ.get("SECRET_KEY")
if not secret:
    raise RuntimeError("SECRET_KEY is not set")
app.config["SECRET_KEY"] = secret
```

- Để key trong `.env` (đã có trong `.gitignore`).
- Tạo key ngẫu nhiên: `python -c "import secrets; print(secrets.token_hex(32))"`
- Key trên server khác key trên máy.

---

## Những thứ KHÔNG được bỏ vào session

Vì ai cũng đọc được cookie:

- Không bỏ mật khẩu, hash mật khẩu, token, thông tin riêng tư.
- Chỉ bỏ thứ nhỏ, không bí mật, như `user_id`.
- Cookie bị giới hạn khoảng 4KB, nên cũng không bỏ dữ liệu lớn.

---

## Các cờ (flag) của cookie

| Cờ | Ý nghĩa | Chống được gì |
|---|---|---|
| `HttpOnly` | JS không đọc được cookie (`document.cookie` không thấy) | Bị XSS thì script lạ cũng không lấy cắp được cookie |
| `Secure` | Chỉ gửi cookie qua HTTPS | Bị nghe lén trên mạng (wifi quán cà phê) |
| `SameSite=Lax` | Trang web khác gửi request (form POST) tới mình thì không kèm cookie | CSRF |

Flask mặc định đã bật `HttpOnly` cho cookie `session`. `Secure` và `SameSite` cần tự bật khi deploy:

```python
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["REMEMBER_COOKIE_SECURE"] = True
app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"
```

Không bật `Secure` khi chạy `flask run` trên máy, vì máy chạy `http://` chứ không phải `https://`, cookie sẽ không được gửi và không đăng nhập được.

### CSRF là gì?

Mình đang đăng nhập trang ToDo. Một trang xấu có form ẩn tự POST tới `/logout` hoặc `/api/lists/5` (DELETE). Trình duyệt tự gửi kèm cookie của mình, nên server tưởng là mình làm.

`SameSite=Lax` chặn việc gửi kèm cookie trong trường hợp đó. Đây cũng là lý do `/logout` chỉ nhận POST: nếu nhận GET thì chỉ một thẻ `<img src="/logout">` ở trang khác cũng đăng xuất được mình.

---

## Xem cookie thật

F12 -> tab **Application** -> **Cookies** -> `http://127.0.0.1:5000`:

- `session`: cột HttpOnly có dấu tick.
- `remember_token`: có ngày hết hạn (Expires) xa.

Thử xoá `session` và `remember_token` rồi reload: bị đưa về `/login`.

Thử sửa vài ký tự trong `session` rồi reload: chữ ký sai, Flask bỏ cookie, cũng bị đưa về `/login` (nếu đã xoá `remember_token`).

---

## Tóm tắt

- HTTP không nhớ ai, cookie là cách để nhớ.
- Flask lưu `session` ngay trong cookie, ở trình duyệt.
- Cookie được **ký** bằng `SECRET_KEY`: đọc được, nhưng không sửa được.
- Lộ `SECRET_KEY` = ai cũng giả làm được user bất kỳ. Đổi key là cách sửa.
- Chỉ bỏ `user_id` vào session, không bỏ thứ bí mật.
- Khi deploy: key để trong `.env`, bật `Secure` + `SameSite`.
