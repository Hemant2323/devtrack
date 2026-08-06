"""Authentication tests — cover TC-AUTH-01..04 from docs/05-Test-Plan.md.

(TC-AUTH-05, role enforcement, lands with the projects feature where
roles first exist.)
"""

from datetime import timedelta

from app.core import security


# ---------- signup ----------


def test_signup_returns_user_without_password(client):
    response = client.post(
        "/auth/signup",
        json={"name": "Asha", "email": "asha@test.dev", "password": "secret123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "asha@test.dev"
    assert "password" not in body and "password_hash" not in body


def test_signup_duplicate_email_409(client, signup_user):
    signup_user()
    response = client.post(
        "/auth/signup",
        json={"name": "Other", "email": "asha@test.dev", "password": "different1"},
    )
    assert response.status_code == 409


def test_signup_short_password_422(client):  # TC-AUTH-03
    response = client.post(
        "/auth/signup",
        json={"name": "A", "email": "a@test.dev", "password": "short"},
    )
    assert response.status_code == 422


def test_signup_invalid_email_422(client):
    response = client.post(
        "/auth/signup",
        json={"name": "A", "email": "not-an-email", "password": "secret123"},
    )
    assert response.status_code == 422


# ---------- login ----------


def test_login_success_returns_tokens(client, signup_user):  # TC-AUTH-01
    creds = signup_user()
    response = client.post(
        "/auth/login", json={"email": creds["email"], "password": creds["password"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password_401_generic(client, signup_user):  # TC-AUTH-02
    creds = signup_user()
    response = client.post(
        "/auth/login", json={"email": creds["email"], "password": "wrongpass1"}
    )
    assert response.status_code == 401
    # generic message — must not reveal whether the email exists
    assert response.json()["detail"] == "Invalid email or password"


def test_login_unknown_email_same_401(client):  # TC-AUTH-02 (enumeration)
    response = client.post(
        "/auth/login", json={"email": "ghost@test.dev", "password": "whatever1"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


# ---------- protected endpoint: /auth/me ----------


def _login(client, creds):
    return client.post(
        "/auth/login", json={"email": creds["email"], "password": creds["password"]}
    ).json()


def test_me_with_valid_token(client, signup_user):
    creds = signup_user()
    tokens = _login(client, creds)
    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == creds["email"]


def test_me_without_token_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_with_garbage_token_401(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_expired_token_401(client, signup_user):  # TC-AUTH-04
    user = signup_user()
    expired = security._create_token(user["id"], "access", timedelta(minutes=-1))
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


# ---------- refresh ----------


def test_refresh_returns_new_tokens(client, signup_user):
    creds = signup_user()
    tokens = _login(client, creds)
    response = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_access_token_rejected_as_refresh(client, signup_user):
    creds = signup_user()
    tokens = _login(client, creds)
    response = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401
