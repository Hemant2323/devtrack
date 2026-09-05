"""The archived-project contract, in one place (Sprint 7.1).

An archived project is readable and frozen: every read keeps working, every
write is refused with 403. The rule was applied per-feature as each was built,
and Sprint 7.1 verification found five write paths that had been missed —
issue delete, comment edit/delete, and member role-change/removal — each one
inconsistent with its own sibling operation (you could not *add* a member to an
archived project but could remove one).

These tests exist so that stays fixed, and so any future write path has an
obvious place to prove it honours the rule.

The one deliberate exception is PATCH /projects/{id} itself: it has to keep
working on an archived project, because it is how a project is un-archived.
"""

import pytest


# ---------- helpers (same pattern as the other suites) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture()
def archived(client):
    """A project with one of everything, then archived.

    Everything is built *before* archiving, because building it afterwards is
    exactly what the rule forbids.
    """
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = client.post("/projects", json={"name": "P", "key": "PAY"}, headers=admin).json()
    pid = project["id"]
    dev_id = client.post(
        f"/projects/{pid}/members", json={"email": "dev@test.dev", "role": "DEVELOPER"},
        headers=admin,
    ).json()["user_id"]

    issue = client.post(
        f"/projects/{pid}/issues", json={"type": "TASK", "title": "Issue"}, headers=admin
    ).json()
    spare = client.post(
        f"/projects/{pid}/issues", json={"type": "TASK", "title": "Spare"}, headers=admin
    ).json()
    comment = client.post(
        f"/issues/{issue['id']}/comments", json={"body": "hello"}, headers=admin
    ).json()

    client.patch(f"/projects/{pid}", json={"archived": True}, headers=admin)
    assert client.get(f"/projects/{pid}", headers=admin).json()["archived"] is True

    return {
        "admin": admin, "dev": dev, "id": pid,
        "dev_id": dev_id, "issue": issue, "spare": spare, "comment": comment,
    }


# ---------- reads keep working ----------


@pytest.mark.parametrize(
    "path",
    ["issues", "board", "sprints", "test-cases", "chat", "chat/dm", "dependencies",
     "notes", "meetings", "calendar", "my-work", "members", "components"],
)
def test_archived_project_stays_readable(client, archived, path):
    r = client.get(f"/projects/{archived['id']}/{path}", headers=archived["admin"])
    assert r.status_code == 200, r.text


def test_archived_issue_and_comment_stay_readable(client, archived):
    admin, issue = archived["admin"], archived["issue"]
    assert client.get(f"/issues/{issue['id']}", headers=admin).status_code == 200
    assert client.get(f"/issues/{issue['id']}/comments", headers=admin).status_code == 200
    assert client.get(f"/issues/{issue['id']}/activities", headers=admin).status_code == 200


# ---------- the five paths Sprint 7.1 found unguarded ----------


def test_issue_delete_is_refused(client, archived):
    """Create and update were guarded; delete was not."""
    r = client.delete(f"/issues/{archived['spare']['id']}", headers=archived["admin"])
    assert r.status_code == 403
    # And the issue is genuinely still there.
    assert client.get(f"/issues/{archived['spare']['id']}",
                      headers=archived["admin"]).status_code == 200


def test_comment_edit_is_refused(client, archived):
    r = client.patch(f"/comments/{archived['comment']['id']}",
                     json={"body": "edited"}, headers=archived["admin"])
    assert r.status_code == 403
    assert client.get(
        f"/issues/{archived['issue']['id']}/comments", headers=archived["admin"]
    ).json()[0]["body"] == "hello"


def test_comment_delete_is_refused(client, archived):
    r = client.delete(f"/comments/{archived['comment']['id']}", headers=archived["admin"])
    assert r.status_code == 403
    assert len(client.get(f"/issues/{archived['issue']['id']}/comments",
                          headers=archived["admin"]).json()) == 1


def test_member_role_change_is_refused(client, archived):
    """Adding a member was guarded; changing a role was not."""
    r = client.patch(f"/projects/{archived['id']}/members/{archived['dev_id']}",
                     json={"role": "TESTER"}, headers=archived["admin"])
    assert r.status_code == 403
    roles = {m["user_id"]: m["role"] for m in
             client.get(f"/projects/{archived['id']}/members", headers=archived["admin"]).json()}
    assert roles[archived["dev_id"]] == "DEVELOPER"


def test_member_removal_is_refused(client, archived):
    r = client.delete(f"/projects/{archived['id']}/members/{archived['dev_id']}",
                      headers=archived["admin"])
    assert r.status_code == 403
    assert len(client.get(f"/projects/{archived['id']}/members",
                          headers=archived["admin"]).json()) == 2


# ---------- the paths that were already guarded, kept honest ----------


def test_every_creation_path_is_refused(client, archived):
    admin, pid, issue = archived["admin"], archived["id"], archived["issue"]
    refused = {
        "issue": client.post(f"/projects/{pid}/issues",
                             json={"type": "TASK", "title": "x"}, headers=admin),
        "comment": client.post(f"/issues/{issue['id']}/comments",
                               json={"body": "x"}, headers=admin),
        "sprint": client.post(f"/projects/{pid}/sprints", json={"name": "x"}, headers=admin),
        "test case": client.post(f"/projects/{pid}/test-cases",
                                 json={"title": "x"}, headers=admin),
        "chat message": client.post(f"/projects/{pid}/chat", json={"body": "x"}, headers=admin),
        "direct message": client.post(f"/projects/{pid}/chat/dm/{archived['dev_id']}",
                                      json={"body": "x"}, headers=admin),
        "dependency": client.post(f"/issues/{issue['id']}/dependencies",
                                  json={"issue_id": archived["spare"]["id"],
                                        "direction": "BLOCKS"}, headers=admin),
        "note": client.post(f"/projects/{pid}/notes",
                            json={"title": "x", "content": "y"}, headers=admin),
        "meeting": client.post(f"/projects/{pid}/meetings",
                               json={"title": "x", "scheduled_at": "2030-01-01T10:00:00Z"},
                               headers=admin),
        "calendar event": client.post(f"/projects/{pid}/calendar/events",
                                      json={"title": "x", "starts_at": "2030-01-01T10:00:00Z"},
                                      headers=admin),
        "member": client.post(f"/projects/{pid}/members",
                              json={"email": "dev@test.dev", "role": "DEVELOPER"},
                              headers=admin),
        "component": client.post(f"/projects/{pid}/components",
                                 json={"name": "x"}, headers=admin),
    }
    assert {k: r.status_code for k, r in refused.items()} == dict.fromkeys(refused, 403)


def test_issue_update_is_refused(client, archived):
    assert client.patch(f"/issues/{archived['issue']['id']}",
                        json={"title": "x"}, headers=archived["admin"]).status_code == 403


def test_calendar_offers_nothing_as_editable(client, archived):
    entries = client.get(f"/projects/{archived['id']}/calendar",
                         headers=archived["admin"]).json()
    assert all(entry["editable"] is False for entry in entries)


# ---------- the deliberate exception, and the way back ----------


def test_un_archiving_is_itself_allowed(client, archived):
    """PATCH /projects/{id} must stay open — it is the way out."""
    r = client.patch(f"/projects/{archived['id']}", json={"archived": False},
                     headers=archived["admin"])
    assert r.status_code == 200
    assert r.json()["archived"] is False


def test_restoring_reenables_every_write(client, archived):
    admin, pid = archived["admin"], archived["id"]
    client.patch(f"/projects/{pid}", json={"archived": False}, headers=admin)

    assert client.patch(f"/issues/{archived['issue']['id']}",
                        json={"title": "edited"}, headers=admin).status_code == 200
    assert client.patch(f"/comments/{archived['comment']['id']}",
                        json={"body": "edited"}, headers=admin).status_code == 200
    assert client.patch(f"/projects/{pid}/members/{archived['dev_id']}",
                        json={"role": "TESTER"}, headers=admin).status_code == 200
    assert client.delete(f"/issues/{archived['spare']['id']}", headers=admin).status_code == 204
    assert client.delete(f"/projects/{pid}/members/{archived['dev_id']}",
                         headers=admin).status_code == 204


def test_nothing_was_lost_while_archived(client, archived):
    admin, pid = archived["admin"], archived["id"]
    client.patch(f"/projects/{pid}", json={"archived": False}, headers=admin)

    assert len(client.get(f"/projects/{pid}/issues", headers=admin).json()) == 2
    assert len(client.get(f"/projects/{pid}/members", headers=admin).json()) == 2
    assert len(client.get(f"/issues/{archived['issue']['id']}/comments",
                          headers=admin).json()) == 1
