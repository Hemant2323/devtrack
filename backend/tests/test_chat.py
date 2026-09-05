"""Project chat tests."""


# ---------- helpers (same pattern as the other suites) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="TST"):
    r = client.post("/projects", json={"name": "Test", "key": key}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _send(client, headers, pid, body="Hello team"):
    r = client.post(f"/projects/{pid}/chat", json={"body": body}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _add_member(client, admin, pid, email, role="DEVELOPER"):
    r = client.post(
        f"/projects/{pid}/members", json={"email": email, "role": role}, headers=admin
    )
    assert r.status_code == 201, r.text


# ---------- sending + reading ----------


def test_send_and_list_message(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sent = _send(client, headers, project["id"], "First message")

    assert sent["body"] == "First message"
    assert sent["project_id"] == project["id"]
    assert sent["edited_at"] is None
    assert sent["author_name"] == "User"  # denormalised

    listed = client.get(f"/projects/{project['id']}/chat", headers=headers).json()
    assert [m["id"] for m in listed] == [sent["id"]]


def test_empty_chat_returns_empty_list(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    assert client.get(f"/projects/{project['id']}/chat", headers=headers).json() == []


def test_messages_are_returned_oldest_first(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(5)]

    listed = client.get(f"/projects/{project['id']}/chat", headers=headers).json()
    assert [m["id"] for m in listed] == ids  # chronological display order


def test_author_name_reflects_the_sender(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    _add_member(client, admin, project["id"], "dev@test.dev")

    _send(client, admin, project["id"], "from admin")
    _send(client, dev, project["id"], "from dev")

    listed = client.get(f"/projects/{project['id']}/chat", headers=admin).json()
    assert [m["author_name"] for m in listed] == ["Admin", "Dev"]


# ---------- validation ----------


def test_empty_body_422(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(f"/projects/{project['id']}/chat", json={"body": ""}, headers=headers)
    assert r.status_code == 422


def test_whitespace_only_body_422(client):
    """min_length alone would accept "   "; the validator trims first."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(
        f"/projects/{project['id']}/chat", json={"body": "   \n\t "}, headers=headers
    )
    assert r.status_code == 422


def test_body_is_trimmed(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sent = _send(client, headers, project["id"], "  padded  ")
    assert sent["body"] == "padded"


def test_overlong_body_422(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(
        f"/projects/{project['id']}/chat", json={"body": "x" * 10001}, headers=headers
    )
    assert r.status_code == 422


# ---------- limit + before_id ----------


def test_default_limit_returns_newest_window(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(60)]

    listed = client.get(f"/projects/{project['id']}/chat", headers=headers).json()
    assert len(listed) == 50
    # The newest 50, still oldest-first within the window.
    assert [m["id"] for m in listed] == ids[10:]


def test_explicit_limit(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(10)]

    listed = client.get(f"/projects/{project['id']}/chat?limit=3", headers=headers).json()
    assert [m["id"] for m in listed] == ids[-3:]


def test_limit_is_bounded(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    assert client.get(f"/projects/{project['id']}/chat?limit=0", headers=headers).status_code == 422
    assert client.get(f"/projects/{project['id']}/chat?limit=101", headers=headers).status_code == 422


def test_before_id_returns_older_messages(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(10)]

    older = client.get(
        f"/projects/{project['id']}/chat?limit=3&before_id={ids[5]}", headers=headers
    ).json()
    # Strictly older than ids[5], newest window of those, oldest-first.
    assert [m["id"] for m in older] == ids[2:5]


def test_before_id_at_the_start_returns_empty(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(3)]

    assert client.get(
        f"/projects/{project['id']}/chat?before_id={ids[0]}", headers=headers
    ).json() == []


def test_before_id_windows_do_not_overlap(client):
    """Paging back must not re-serve a message the client already has."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    ids = [_send(client, headers, project["id"], f"m{i}")["id"] for i in range(12)]

    first = client.get(f"/projects/{project['id']}/chat?limit=5", headers=headers).json()
    older = client.get(
        f"/projects/{project['id']}/chat?limit=5&before_id={first[0]['id']}", headers=headers
    ).json()

    assert set(m["id"] for m in first).isdisjoint(m["id"] for m in older)
    assert [m["id"] for m in older] + [m["id"] for m in first] == ids[2:]


# ---------- authorization ----------


def test_non_member_gets_404_everywhere(client):
    owner = _make_user(client, "owner@test.dev", "Owner")
    outsider = _make_user(client, "out@test.dev", "Out")
    project = _create_project(client, owner)
    message = _send(client, owner, project["id"])

    assert client.get(f"/projects/{project['id']}/chat", headers=outsider).status_code == 404
    assert client.post(
        f"/projects/{project['id']}/chat", json={"body": "hi"}, headers=outsider
    ).status_code == 404
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "hi"}, headers=outsider
    ).status_code == 404
    assert client.delete(f"/chat/{message['id']}", headers=outsider).status_code == 404


def test_any_member_can_read_and_post(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    tester = _make_user(client, "qa@test.dev", "QA")
    project = _create_project(client, admin)
    _add_member(client, admin, project["id"], "qa@test.dev", role="TESTER")

    assert client.get(f"/projects/{project['id']}/chat", headers=tester).status_code == 200
    assert _send(client, tester, project["id"], "hello")["author_name"] == "QA"


def test_unknown_message_404(client):
    headers = _make_user(client)
    assert client.patch("/chat/999999", json={"body": "x"}, headers=headers).status_code == 404
    assert client.delete("/chat/999999", headers=headers).status_code == 404


# ---------- edit ----------


def test_author_can_edit_own_message(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    message = _send(client, headers, project["id"], "original")

    r = client.patch(f"/chat/{message['id']}", json={"body": "edited"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["body"] == "edited"
    assert r.json()["edited_at"] is not None


def test_non_author_cannot_edit(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    _add_member(client, admin, project["id"], "dev@test.dev")
    message = _send(client, dev, project["id"], "dev's message")

    # Not even an admin may edit someone else's words.
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "tampered"}, headers=admin
    ).status_code == 403


def test_edit_rejects_blank_body(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    message = _send(client, headers, project["id"])
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "  "}, headers=headers
    ).status_code == 422


# ---------- delete ----------


def test_author_can_delete_own_message(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    message = _send(client, headers, project["id"])

    assert client.delete(f"/chat/{message['id']}", headers=headers).status_code == 204
    assert client.get(f"/projects/{project['id']}/chat", headers=headers).json() == []


def test_admin_can_delete_any_message(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    _add_member(client, admin, project["id"], "dev@test.dev")
    message = _send(client, dev, project["id"], "dev's message")

    assert client.delete(f"/chat/{message['id']}", headers=admin).status_code == 204


def test_member_cannot_delete_another_members_message(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    other = _make_user(client, "other@test.dev", "Other")
    project = _create_project(client, admin)
    _add_member(client, admin, project["id"], "dev@test.dev")
    _add_member(client, admin, project["id"], "other@test.dev")
    message = _send(client, dev, project["id"], "dev's message")

    assert client.delete(f"/chat/{message['id']}", headers=other).status_code == 403


def test_delete_is_hard(client):
    """No tombstone — the row is gone, matching comments."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    message = _send(client, headers, project["id"])
    client.delete(f"/chat/{message['id']}", headers=headers)

    assert client.patch(
        f"/chat/{message['id']}", json={"body": "x"}, headers=headers
    ).status_code == 404


# ---------- archived project ----------


def test_archived_project_chat_is_read_only(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    message = _send(client, headers, project["id"], "before archiving")
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=headers)

    # History stays readable.
    listed = client.get(f"/projects/{project['id']}/chat", headers=headers).json()
    assert [m["id"] for m in listed] == [message["id"]]

    # Every write is refused.
    assert client.post(
        f"/projects/{project['id']}/chat", json={"body": "nope"}, headers=headers
    ).status_code == 403
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "nope"}, headers=headers
    ).status_code == 403
    assert client.delete(f"/chat/{message['id']}", headers=headers).status_code == 403


def test_chat_resumes_after_restore(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=headers)
    client.patch(f"/projects/{project['id']}", json={"archived": False}, headers=headers)
    assert _send(client, headers, project["id"], "back")["body"] == "back"


# ---------- isolation ----------


def test_chat_is_scoped_to_its_project(client):
    headers = _make_user(client)
    a = _create_project(client, headers, key="AAA")
    b = _create_project(client, headers, key="BBB")
    _send(client, headers, a["id"], "in A")

    assert client.get(f"/projects/{b['id']}/chat", headers=headers).json() == []
    assert len(client.get(f"/projects/{a['id']}/chat", headers=headers).json()) == 1
