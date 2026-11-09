# sending email through brevo + the signed links in verification emails.
# named mailer.py, not email.py, so it doesn't get mixed up with python's email module
import json
import urllib.request

from flask import current_app, url_for
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

BREVO_URL = "https://api.brevo.com/v3/smtp/email"

# verification links stop working after 24h
VERIFY_MAX_AGE = 24 * 60 * 60


def send_email(to, subject, text):
    api_key = current_app.config["BREVO_API_KEY"]

    # no key on your laptop -> print the email in the flask run terminal instead.
    # lets you test verification and reminders without a brevo account
    if not api_key:
        current_app.logger.warning("BREVO_API_KEY not set, not sending. would send:\nTo: %s\nSubject: %s\n\n%s",
                                   to, subject, text)
        return

    body = {
        "sender": {"email": current_app.config["MAIL_SENDER"], "name": current_app.config["MAIL_SENDER_NAME"]},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": text,
    }
    request = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    # raises on 4xx/5xx or timeout, the caller decides what to do
    with urllib.request.urlopen(request, timeout=10):
        pass


# the token is the user id + email, signed with SECRET_KEY so nobody can make their own.
# email is in there so an old link stops working once you change your email
def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="verify-email")


def make_verify_token(user):
    return _serializer().dumps({"uid": user.id, "email": user.email})


# None if it's fake, edited, or older than 24h
def read_verify_token(token):
    try:
        return _serializer().loads(token, max_age=VERIFY_MAX_AGE)
    except (SignatureExpired, BadSignature):
        return None


def send_verification_email(user):
    link = url_for("auth.verify_email", token=make_verify_token(user), _external=True)
    send_email(
        user.email,
        "Verify your email for To-do List",
        f"Hi {user.shown_name},\n\n"
        f"Click this link to verify your email and turn on due date reminders:\n{link}\n\n"
        "The link works for 24 hours. If you didn't ask for this, you can ignore this email.",
    )
