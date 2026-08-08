"""Tests for board (FR-4), comments (FR-6.1), notifications (FR-8)."""


# ---------- shared helpers ----------

def _user(client, email, name="User", pw="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": pw})
    tokens = client.post("/auth/login", json={"email": email, "password": pw}).json()
    uid = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).json()["id"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}, uid


def _project(client, hdrs, key):
    r = client.post("/projects", json={"name": key, "key": key}, headers=hdrs)
    assert r.status_code == 201, r.text
    return r.json()


def _issue(client, hdrs, pid, title="Issue", type_="TASK", **kw):
    body = {"type": type_, "title": title, "priority": "MEDIUM", **kw}
    if type_ == "BUG":
        body.setdefault("severity", "MAJOR")
    r = client.post(f"/projects/{pid}/issues", json=body, headers=hdrs)
    assert r.status_code == 201, r.text
    return r.json()


# ===================== BOARD =====================


def test_board_groups_by_status(client):
    hdrs, _ = _user(client, "brd@t.dev")
    p = _project(client, hdrs, "BRD")

    i1 = _issue(client, hdrs, p["id"], title="Todo task")
    i2 = _issue(client, hdrs, p["id"], title="In-progress task")
    i3 = _issue(client, hdrs, p["id"], title="Done task")

    client.patch(f"/issues/{i2['id']}", json={"status": "IN_PROGRESS"}, headers=hdrs)
    client.patch(f"/issues/{i3['id']}", json={"status": "DONE"}, headers=hdrs)

    board = client.get(f"/projects/{p['id']}/board", headers=hdrs).json()

    assert len(board["todo"]) == 1 and board["todo"][0]["id"] == i1["id"]
    assert len(board["in_progress"]) == 1 and board["in_progress"][0]["id"] == i2["id"]
    assert len(board["done"]) == 1 and board["done"][0]["id"] == i3["id"]
    assert board["testing"] == []


def test_board_requires_auth(client):
    assert client.get("/projects/1/board").status_code == 401


def test_board_nonmember_gets_404(client):
    hdrs_a, _ = _user(client, "ba@t.dev")
    hdrs_b, _ = _user(client, "bb@t.dev")
    p = _project(client, hdrs_a, "BNA")
    assert client.get(f"/projects/{p['id']}/board", headers=hdrs_b).status_code == 404


# ===================== COMMENTS =====================


def test_create_and_list_comment(client):
    hdrs, _ = _user(client, "cm1@t.dev")
    p = _project(client, hdrs, "CM1")
    issue = _issue(client, hdrs, p["id"])

    r = client.post(
        f"/issues/{issue['id']}/comments",
        json={"body": "First comment"},
        headers=hdrs,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["body"] == "First comment"
    assert body["author_id"] is not None

    comments = client.get(f"/issues/{issue['id']}/comments", headers=hdrs).json()
    assert len(comments) == 1
    assert comments[0]["body"] == "First comment"


def test_author_can_edit_own_comment(client):
    hdrs, _ = _user(client, "cm2@t.dev")
    p = _project(client, hdrs, "CM2")
    issue = _issue(client, hdrs, p["id"])
    c = client.post(
        f"/issues/{issue['id']}/comments", json={"body": "Original"}, headers=hdrs
    ).json()

    r = client.patch(f"/comments/{c['id']}", json={"body": "Edited"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["body"] == "Edited"
    assert r.json()["edited_at"] is not None


def test_non_author_cannot_edit(client):
    hdrs_a, _ = _user(client, "cma@t.dev", "A")
    hdrs_b, _ = _user(client, "cmb@t.dev", "B")
    p = _project(client, hdrs_a, "CME")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "cmb@t.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    issue = _issue(client, hdrs_a, p["id"])
    c = client.post(
        f"/issues/{issue['id']}/comments", json={"body": "A wrote this"}, headers=hdrs_a
    ).json()

    r = client.patch(f"/comments/{c['id']}", json={"body": "B trying"}, headers=hdrs_b)
    assert r.status_code == 403


def test_admin_can_delete_any_comment(client):
    hdrs_admin, _ = _user(client, "cadm@t.dev", "Admin")
    hdrs_dev, _ = _user(client, "cdev@t.dev", "Dev")
    p = _project(client, hdrs_admin, "CAD")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "cdev@t.dev", "role": "DEVELOPER"},
        headers=hdrs_admin,
    )
    issue = _issue(client, hdrs_admin, p["id"])
    c = client.post(
        f"/issues/{issue['id']}/comments", json={"body": "Dev comment"}, headers=hdrs_dev
    ).json()

    r = client.delete(f"/comments/{c['id']}", headers=hdrs_admin)
    assert r.status_code == 204

    remaining = client.get(f"/issues/{issue['id']}/comments", headers=hdrs_admin).json()
    assert all(x["id"] != c["id"] for x in remaining)


def test_empty_comment_body_422(client):
    hdrs, _ = _user(client, "empt@t.dev")
    p = _project(client, hdrs, "EMP")
    issue = _issue(client, hdrs, p["id"])
    r = client.post(
        f"/issues/{issue['id']}/comments", json={"body": ""}, headers=hdrs
    )
    assert r.status_code == 422


# ===================== NOTIFICATIONS =====================


def test_assignment_creates_notification(client):
    hdrs_a, _ = _user(client, "na@t.dev", "A")
    hdrs_b, uid_b = _user(client, "nb@t.dev", "B")
    p = _project(client, hdrs_a, "NTF")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "nb@t.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    _issue(client, hdrs_a, p["id"], title="Assigned to B", assignee_id=uid_b)

    summary = client.get("/notifications", headers=hdrs_b).json()
    assert summary["unread_count"] >= 1
    types = [n["type"] for n in summary["notifications"]]
    assert "ASSIGNED" in types


def test_status_change_creates_notification(client):
    hdrs_a, _ = _user(client, "nsc_a@t.dev", "A2")
    hdrs_b, uid_b = _user(client, "nsc_b@t.dev", "B2")
    p = _project(client, hdrs_a, "NSC")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "nsc_b@t.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    issue = _issue(client, hdrs_a, p["id"], title="Watch this", assignee_id=uid_b)

    # clear setup notifications first
    notif_ids = [n["id"] for n in client.get("/notifications", headers=hdrs_b).json()["notifications"]]
    if notif_ids:
        client.post("/notifications/read", json={"ids": notif_ids}, headers=hdrs_b)

    client.patch(f"/issues/{issue['id']}", json={"status": "IN_PROGRESS"}, headers=hdrs_a)

    summary = client.get("/notifications", headers=hdrs_b).json()
    assert any(n["type"] == "STATUS_CHANGE" for n in summary["notifications"])


def test_mark_notifications_read(client):   # TC-NOT-03
    hdrs_a, _ = _user(client, "nr_a@t.dev", "A3")
    hdrs_b, uid_b = _user(client, "nr_b@t.dev", "B3")
    p = _project(client, hdrs_a, "NRD")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "nr_b@t.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    _issue(client, hdrs_a, p["id"], title="Notif test", assignee_id=uid_b)

    summary = client.get("/notifications", headers=hdrs_b).json()
    assert summary["unread_count"] >= 1
    ids = [n["id"] for n in summary["notifications"] if not n["read"]]

    client.post("/notifications/read", json={"ids": ids}, headers=hdrs_b)

    after = client.get("/notifications", headers=hdrs_b).json()
    assert after["unread_count"] == 0
