"""Direct message tests.

The team-chat suite in test_chat.py is left untouched on purpose: it is the
regression net proving DMs never leak into the team transcript, so it has to
keep passing exactly as written.
"""

import pytest


# ---------- helpers (same pattern as test_chat.py) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="TST"):
    r = client.post("/projects", json={"name": "Test", "key": key}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _add_member(client, admin, pid, email, role="DEVELOPER"):
    r = client.post(
        f"/projects/{pid}/members", json={"email": email, "role": role}, headers=admin
    )
    assert r.status_code == 201, r.text
    return r.json()


def _dm(client, headers, pid, to_user_id, body="Hi there"):
    r = client.post(
        f"/projects/{pid}/chat/dm/{to_user_id}", json={"body": body}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _me(client, headers):
    return client.get("/auth/me", headers=headers).json()


@pytest.fixture()
def team(client):
    """An admin plus two developers in one project, with their user ids."""
    admin = _make_user(client, "admin@test.dev", "Admin")
    alice = _make_user(client, "alice@test.dev", "Alice")
    bob = _make_user(client, "bob@test.dev", "Bob")
    project = _create_project(client, admin)
    pid = project["id"]
    alice_member = _add_member(client, admin, pid, "alice@test.dev")
    bob_member = _add_member(client, admin, pid, "bob@test.dev")

    return {
        "pid": pid,
        "admin": admin,
        "alice": alice,
        "bob": bob,
        "admin_id": _me(client, admin)["id"],
        "alice_id": alice_member["user_id"],
        "bob_id": bob_member["user_id"],
    }


# ---------- sending + reading ----------


def test_member_can_dm_another_member(client, team):
    sent = _dm(client, team["alice"], team["pid"], team["bob_id"], "Hello Bob")

    assert sent["body"] == "Hello Bob"
    assert sent["author_id"] == team["alice_id"]
    assert sent["recipient_id"] == team["bob_id"]
    assert sent["author_name"] == "Alice"
    assert sent["recipient_name"] == "Bob"
    assert sent["edited_at"] is None


def test_author_can_read_the_dm(client, team):
    sent = _dm(client, team["alice"], team["pid"], team["bob_id"])

    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert [m["id"] for m in listed] == [sent["id"]]


def test_recipient_can_read_the_dm(client, team):
    sent = _dm(client, team["alice"], team["pid"], team["bob_id"])

    # Bob reads the same thread by naming Alice — direction does not matter.
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['alice_id']}", headers=team["bob"]
    ).json()
    assert [m["id"] for m in listed] == [sent["id"]]


def test_both_directions_form_one_thread(client, team):
    a = _dm(client, team["alice"], team["pid"], team["bob_id"], "from Alice")
    b = _dm(client, team["bob"], team["pid"], team["alice_id"], "from Bob")

    for headers, other in (
        (team["alice"], team["bob_id"]),
        (team["bob"], team["alice_id"]),
    ):
        listed = client.get(
            f"/projects/{team['pid']}/chat/dm/{other}", headers=headers
        ).json()
        assert [m["id"] for m in listed] == [a["id"], b["id"]]


def test_dms_are_returned_oldest_first(client, team):
    ids = [
        _dm(client, team["alice"], team["pid"], team["bob_id"], f"m{i}")["id"]
        for i in range(5)
    ]
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert [m["id"] for m in listed] == ids


# ---------- isolation: the central guarantee ----------


def test_team_chat_never_returns_dms(client, team):
    client.post(
        f"/projects/{team['pid']}/chat", json={"body": "team message"},
        headers=team["alice"],
    )
    _dm(client, team["alice"], team["pid"], team["bob_id"], "private message")

    listed = client.get(f"/projects/{team['pid']}/chat", headers=team["alice"]).json()
    assert [m["body"] for m in listed] == ["team message"]
    assert all(m["recipient_id"] is None for m in listed)

    # Not even to the participants themselves.
    for headers in (team["alice"], team["bob"], team["admin"]):
        rows = client.get(f"/projects/{team['pid']}/chat", headers=headers).json()
        assert all(m["body"] != "private message" for m in rows)


def test_dm_thread_returns_only_that_pair(client, team):
    ab = _dm(client, team["alice"], team["pid"], team["bob_id"], "alice to bob")
    _dm(client, team["alice"], team["pid"], team["admin_id"], "alice to admin")
    _dm(client, team["bob"], team["pid"], team["admin_id"], "bob to admin")
    client.post(
        f"/projects/{team['pid']}/chat", json={"body": "team"}, headers=team["alice"]
    )

    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert [m["id"] for m in listed] == [ab["id"]]


def test_unrelated_member_cannot_read_the_thread(client, team):
    """Admin is a member of the project but not of Alice and Bob's thread."""
    _dm(client, team["alice"], team["pid"], team["bob_id"], "private")

    # Asking for Alice's thread returns the admin's own (empty) thread with
    # Alice, never Alice's conversation with Bob.
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['alice_id']}", headers=team["admin"]
    ).json()
    assert listed == []


def test_dms_are_scoped_to_their_project(client, team):
    """The same two users in two projects have two separate threads."""
    other = _create_project(client, team["admin"], key="OTH")
    _add_member(client, team["admin"], other["id"], "alice@test.dev")
    _add_member(client, team["admin"], other["id"], "bob@test.dev")

    _dm(client, team["alice"], team["pid"], team["bob_id"], "in first project")

    listed = client.get(
        f"/projects/{other['id']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert listed == []


# ---------- recipient validation ----------


def test_cannot_dm_self(client, team):
    r = client.post(
        f"/projects/{team['pid']}/chat/dm/{team['alice_id']}",
        json={"body": "note to self"},
        headers=team["alice"],
    )
    assert r.status_code == 422

    assert client.get(
        f"/projects/{team['pid']}/chat/dm/{team['alice_id']}", headers=team["alice"]
    ).status_code == 422


def test_cannot_dm_a_member_of_another_project(client, team):
    outsider = _make_user(client, "out@test.dev", "Out")
    their_project = _create_project(client, outsider, key="OUT")
    outsider_id = _me(client, outsider)["id"]
    assert their_project["id"] != team["pid"]

    r = client.post(
        f"/projects/{team['pid']}/chat/dm/{outsider_id}",
        json={"body": "hello stranger"},
        headers=team["alice"],
    )
    assert r.status_code == 404

    assert client.get(
        f"/projects/{team['pid']}/chat/dm/{outsider_id}", headers=team["alice"]
    ).status_code == 404


def test_cannot_dm_an_unknown_user(client, team):
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/999999",
        json={"body": "hi"},
        headers=team["alice"],
    ).status_code == 404


def test_removed_member_can_no_longer_be_dmed(client, team):
    _dm(client, team["alice"], team["pid"], team["bob_id"], "before removal")
    assert client.delete(
        f"/projects/{team['pid']}/members/{team['bob_id']}", headers=team["admin"]
    ).status_code == 204

    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": "after removal"},
        headers=team["alice"],
    ).status_code == 404


# ---------- non-members ----------


def test_non_member_gets_404_on_every_dm_endpoint(client, team):
    outsider = _make_user(client, "out@test.dev", "Out")
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    assert client.get(
        f"/projects/{team['pid']}/chat/dm", headers=outsider
    ).status_code == 404
    assert client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=outsider
    ).status_code == 404
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": "hi"},
        headers=outsider,
    ).status_code == 404
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "hi"}, headers=outsider
    ).status_code == 404
    assert client.delete(f"/chat/{message['id']}", headers=outsider).status_code == 404


# ---------- validation ----------


def test_empty_dm_body_422(client, team):
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": ""},
        headers=team["alice"],
    ).status_code == 422


def test_whitespace_only_dm_body_422(client, team):
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": "  \n\t "},
        headers=team["alice"],
    ).status_code == 422


def test_dm_body_is_trimmed(client, team):
    sent = _dm(client, team["alice"], team["pid"], team["bob_id"], "  padded  ")
    assert sent["body"] == "padded"


def test_overlong_dm_body_422(client, team):
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": "x" * 10001},
        headers=team["alice"],
    ).status_code == 422


# ---------- edit ----------


def test_author_can_edit_own_dm(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"], "original")

    r = client.patch(f"/chat/{message['id']}", json={"body": "edited"}, headers=team["alice"])
    assert r.status_code == 200
    assert r.json()["body"] == "edited"
    assert r.json()["edited_at"] is not None
    assert r.json()["recipient_id"] == team["bob_id"]


def test_recipient_cannot_edit_the_authors_dm(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    # Bob can read it, so this is 403 — not 404. He may not rewrite her words.
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "tampered"}, headers=team["bob"]
    ).status_code == 403


def test_admin_cannot_edit_a_dm(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    assert client.patch(
        f"/chat/{message['id']}", json={"body": "tampered"}, headers=team["admin"]
    ).status_code == 404


def test_dm_edit_rejects_blank_body(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "   "}, headers=team["alice"]
    ).status_code == 422


# ---------- delete ----------


def test_author_can_delete_own_dm(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    assert client.delete(f"/chat/{message['id']}", headers=team["alice"]).status_code == 204
    assert client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json() == []


def test_recipient_cannot_delete_the_authors_dm(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    assert client.delete(f"/chat/{message['id']}", headers=team["bob"]).status_code == 403


def test_admin_cannot_delete_a_dm(client, team):
    """The team-chat admin override deliberately stops at the DM boundary: an
    admin cannot read the message, so they may not destroy it either."""
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    assert client.delete(f"/chat/{message['id']}", headers=team["admin"]).status_code == 404

    # And it is genuinely still there.
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert [m["id"] for m in listed] == [message["id"]]


def test_admin_still_moderates_team_chat(client, team):
    """The override that was narrowed for DMs is untouched for team chat."""
    r = client.post(
        f"/projects/{team['pid']}/chat", json={"body": "team"}, headers=team["alice"]
    )
    assert client.delete(f"/chat/{r.json()['id']}", headers=team["admin"]).status_code == 204


def test_id_guessing_reveals_nothing(client, team):
    """A project member who is not a participant gets the same 404 for a real
    DM as for a message that does not exist."""
    message = _dm(client, team["alice"], team["pid"], team["bob_id"])

    real = client.patch(f"/chat/{message['id']}", json={"body": "x"}, headers=team["admin"])
    missing = client.patch("/chat/999999", json={"body": "x"}, headers=team["admin"])

    assert real.status_code == missing.status_code == 404
    assert real.json()["detail"] == missing.json()["detail"]


# ---------- limit + before_id ----------


def test_dm_default_limit_returns_newest_window(client, team):
    ids = [
        _dm(client, team["alice"], team["pid"], team["bob_id"], f"m{i}")["id"]
        for i in range(60)
    ]
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert len(listed) == 50
    assert [m["id"] for m in listed] == ids[10:]


def test_dm_limit_is_bounded(client, team):
    base = f"/projects/{team['pid']}/chat/dm/{team['bob_id']}"
    assert client.get(f"{base}?limit=0", headers=team["alice"]).status_code == 422
    assert client.get(f"{base}?limit=101", headers=team["alice"]).status_code == 422


def test_dm_before_id_returns_older_messages(client, team):
    ids = [
        _dm(client, team["alice"], team["pid"], team["bob_id"], f"m{i}")["id"]
        for i in range(10)
    ]
    older = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}?limit=3&before_id={ids[5]}",
        headers=team["alice"],
    ).json()
    assert [m["id"] for m in older] == ids[2:5]


def test_dm_before_id_stays_inside_the_conversation(client, team):
    """Interleave three conversations, then page back through one of them: the
    cursor must not walk into the others just because their ids are lower."""
    wanted = []
    for i in range(6):
        wanted.append(
            _dm(client, team["alice"], team["pid"], team["bob_id"], f"ab{i}")["id"]
        )
        _dm(client, team["alice"], team["pid"], team["admin_id"], f"aa{i}")
        _dm(client, team["bob"], team["pid"], team["admin_id"], f"ba{i}")
        client.post(
            f"/projects/{team['pid']}/chat", json={"body": f"team{i}"},
            headers=team["alice"],
        )

    first = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}?limit=2",
        headers=team["alice"],
    ).json()
    older = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}"
        f"?limit=2&before_id={first[0]['id']}",
        headers=team["alice"],
    ).json()

    assert [m["id"] for m in first] == wanted[-2:]
    assert [m["id"] for m in older] == wanted[-4:-2]
    assert all(m["id"] in wanted for m in older + first)
    assert set(m["id"] for m in first).isdisjoint(m["id"] for m in older)


def test_dm_before_id_at_the_start_returns_empty(client, team):
    ids = [
        _dm(client, team["alice"], team["pid"], team["bob_id"], f"m{i}")["id"]
        for i in range(3)
    ]
    assert client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}?before_id={ids[0]}",
        headers=team["alice"],
    ).json() == []


# ---------- partner / conversation list ----------


def test_partner_list_contains_every_other_member(client, team):
    rows = client.get(f"/projects/{team['pid']}/chat/dm", headers=team["alice"]).json()

    assert sorted(r["user_id"] for r in rows) == sorted(
        [team["admin_id"], team["bob_id"]]
    )
    assert team["alice_id"] not in [r["user_id"] for r in rows]
    # No conversation yet.
    assert all(r["last_message_at"] is None for r in rows)
    assert all(r["last_message_body"] is None for r in rows)


def test_partner_list_carries_the_last_message(client, team):
    _dm(client, team["alice"], team["pid"], team["bob_id"], "first")
    _dm(client, team["bob"], team["pid"], team["alice_id"], "last word")

    rows = client.get(f"/projects/{team['pid']}/chat/dm", headers=team["alice"]).json()
    bob_row = next(r for r in rows if r["user_id"] == team["bob_id"])
    admin_row = next(r for r in rows if r["user_id"] == team["admin_id"])

    assert bob_row["last_message_body"] == "last word"
    assert bob_row["last_message_at"] is not None
    assert admin_row["last_message_body"] is None


def test_partner_list_puts_active_conversations_first(client, team):
    _dm(client, team["alice"], team["pid"], team["bob_id"], "hi bob")

    rows = client.get(f"/projects/{team['pid']}/chat/dm", headers=team["alice"]).json()
    assert rows[0]["user_id"] == team["bob_id"]
    assert rows[1]["user_id"] == team["admin_id"]


def test_partner_list_never_leaks_another_pairs_message(client, team):
    _dm(client, team["alice"], team["pid"], team["bob_id"], "alice and bob only")

    rows = client.get(f"/projects/{team['pid']}/chat/dm", headers=team["admin"]).json()
    assert all(r["last_message_body"] is None for r in rows)


def test_partner_list_ignores_team_messages(client, team):
    client.post(
        f"/projects/{team['pid']}/chat", json={"body": "team"}, headers=team["alice"]
    )
    rows = client.get(f"/projects/{team['pid']}/chat/dm", headers=team["alice"]).json()
    assert all(r["last_message_at"] is None for r in rows)


# ---------- archived project ----------


def test_archived_project_dms_are_read_only(client, team):
    message = _dm(client, team["alice"], team["pid"], team["bob_id"], "before archiving")
    client.patch(
        f"/projects/{team['pid']}", json={"archived": True}, headers=team["admin"]
    )

    # History and the partner list stay readable.
    listed = client.get(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}", headers=team["alice"]
    ).json()
    assert [m["id"] for m in listed] == [message["id"]]
    assert client.get(
        f"/projects/{team['pid']}/chat/dm", headers=team["alice"]
    ).status_code == 200

    # Every write is refused.
    assert client.post(
        f"/projects/{team['pid']}/chat/dm/{team['bob_id']}",
        json={"body": "nope"},
        headers=team["alice"],
    ).status_code == 403
    assert client.patch(
        f"/chat/{message['id']}", json={"body": "nope"}, headers=team["alice"]
    ).status_code == 403
    assert client.delete(
        f"/chat/{message['id']}", headers=team["alice"]
    ).status_code == 403


def test_dms_resume_after_restore(client, team):
    client.patch(
        f"/projects/{team['pid']}", json={"archived": True}, headers=team["admin"]
    )
    client.patch(
        f"/projects/{team['pid']}", json={"archived": False}, headers=team["admin"]
    )
    assert _dm(client, team["alice"], team["pid"], team["bob_id"], "back")["body"] == "back"
