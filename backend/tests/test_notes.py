"""Project notes tests (Sprint 6).

Notes are lightweight documentation, so these cover the shape of the record,
who may change it, and that a link never becomes a copy — nothing about
rendering or templates, which live entirely in the frontend.
"""

import pytest


# ---------- helpers (same pattern as the other suites) ----------


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


def _create_issue(client, headers, pid, title="An issue"):
    r = client.post(
        f"/projects/{pid}/issues", json={"type": "TASK", "title": title}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_sprint(client, headers, pid, name="Sprint 1"):
    r = client.post(f"/projects/{pid}/sprints", json={"name": name}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _note(client, headers, pid, **fields):
    payload = {"title": "A note", "content": "Some content", **fields}
    return client.post(f"/projects/{pid}/notes", json=payload, headers=headers)


def _note_ok(client, headers, pid, **fields):
    r = _note(client, headers, pid, **fields)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def project(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    proj = _create_project(client, admin, key="DEV")
    return {"admin": admin, "id": proj["id"], "key": proj["key"]}


# ---------- create + read ----------


def test_member_can_create_note(client, project):
    note = _note_ok(client, project["admin"], project["id"],
                    title="Kickoff", content="Line one\nLine two")

    assert note["title"] == "Kickoff"
    assert note["content"] == "Line one\nLine two"   # multiline preserved
    assert note["note_type"] == "GENERAL"            # default
    assert note["author_name"] == "Admin"
    assert note["project_id"] == project["id"]
    assert note["issue"] is None and note["sprint"] is None


def test_note_response_has_every_field_the_ui_needs(client, project):
    note = _note_ok(client, project["admin"], project["id"])
    assert set(note) == {
        "id", "project_id", "author_id", "author_name", "title", "content",
        "note_type", "issue", "sprint", "meeting", "created_at", "updated_at",
    }


def test_member_can_list_notes(client, project):
    admin = project["admin"]
    _make_user(client, "dev@test.dev", "Dev")
    _add_member(client, admin, project["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")

    _note_ok(client, admin, project["id"], title="From admin")
    _note_ok(client, dev, project["id"], title="From dev")

    listed = client.get(f"/projects/{project['id']}/notes", headers=dev).json()
    assert {n["title"] for n in listed} == {"From admin", "From dev"}
    assert {n["author_name"] for n in listed} == {"Admin", "Dev"}


def test_member_can_read_one_note(client, project):
    note = _note_ok(client, project["admin"], project["id"], title="Readable")
    r = client.get(f"/notes/{note['id']}", headers=project["admin"])
    assert r.status_code == 200
    assert r.json()["title"] == "Readable"


def test_empty_notes_list(client, project):
    assert client.get(f"/projects/{project['id']}/notes", headers=project["admin"]).json() == []


def test_unknown_note_404(client, project):
    assert client.get("/notes/999999", headers=project["admin"]).status_code == 404
    assert client.patch(
        "/notes/999999", json={"title": "x"}, headers=project["admin"]
    ).status_code == 404
    assert client.delete("/notes/999999", headers=project["admin"]).status_code == 404


# ---------- ordering + filtering ----------


def test_notes_are_ordered_by_most_recently_edited(client, project):
    admin = project["admin"]
    first = _note_ok(client, admin, project["id"], title="First")
    second = _note_ok(client, admin, project["id"], title="Second")

    listed = client.get(f"/projects/{project['id']}/notes", headers=admin).json()
    assert [n["id"] for n in listed] == [second["id"], first["id"]]

    # Editing the older one brings it back to the top.
    client.patch(f"/notes/{first['id']}", json={"content": "edited"}, headers=admin)
    listed = client.get(f"/projects/{project['id']}/notes", headers=admin).json()
    assert [n["id"] for n in listed] == [first["id"], second["id"]]


def test_filter_by_note_type(client, project):
    admin = project["admin"]
    _note_ok(client, admin, project["id"], title="Retro", note_type="RETROSPECTIVE")
    _note_ok(client, admin, project["id"], title="Meeting", note_type="MEETING")
    _note_ok(client, admin, project["id"], title="Plain")

    only = client.get(
        f"/projects/{project['id']}/notes?note_type=MEETING", headers=admin
    ).json()
    assert [n["title"] for n in only] == ["Meeting"]
    assert len(client.get(f"/projects/{project['id']}/notes", headers=admin).json()) == 3


def test_every_note_type_is_accepted(client, project):
    for note_type in ("GENERAL", "MEETING", "SPRINT", "TECHNICAL", "RETROSPECTIVE"):
        note = _note_ok(client, project["admin"], project["id"], note_type=note_type)
        assert note["note_type"] == note_type


def test_invalid_note_type_422(client, project):
    assert _note(client, project["admin"], project["id"], note_type="JOURNAL").status_code == 422
    assert client.get(
        f"/projects/{project['id']}/notes?note_type=JOURNAL", headers=project["admin"]
    ).status_code == 422


def test_notes_are_scoped_to_their_project(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    _note_ok(client, admin, project["id"], title="In DEV")

    assert client.get(f"/projects/{other['id']}/notes", headers=admin).json() == []


# ---------- validation ----------


def test_blank_title_rejected(client, project):
    assert _note(client, project["admin"], project["id"], title="").status_code == 422
    assert _note(client, project["admin"], project["id"], title="   \n ").status_code == 422


def test_blank_content_rejected(client, project):
    assert _note(client, project["admin"], project["id"], content="").status_code == 422
    assert _note(client, project["admin"], project["id"], content="  \t ").status_code == 422


def test_title_and_content_are_trimmed(client, project):
    note = _note_ok(client, project["admin"], project["id"],
                    title="  Padded  ", content="  body  ")
    assert note["title"] == "Padded"
    assert note["content"] == "body"


def test_overlong_title_rejected(client, project):
    assert _note(client, project["admin"], project["id"], title="x" * 201).status_code == 422


def test_overlong_content_rejected(client, project):
    assert _note(client, project["admin"], project["id"], content="x" * 50_001).status_code == 422


def test_edit_cannot_blank_a_field(client, project):
    note = _note_ok(client, project["admin"], project["id"])
    for patch in ({"title": "   "}, {"content": ""}):
        assert client.patch(
            f"/notes/{note['id']}", json=patch, headers=project["admin"]
        ).status_code == 422


# ---------- linked issue / sprint ----------


def test_note_can_link_an_issue(client, project):
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"], "Fix login")
    note = _note_ok(client, admin, project["id"], issue_id=issue["id"])

    assert note["issue"] == {
        "id": issue["id"], "key": issue["key"], "title": "Fix login", "status": "TODO",
    }
    assert note["sprint"] is None


def test_note_can_link_a_sprint(client, project):
    admin = project["admin"]
    sprint = _create_sprint(client, admin, project["id"], "Sprint 7")
    note = _note_ok(client, admin, project["id"], sprint_id=sprint["id"])

    assert note["sprint"] == {"id": sprint["id"], "name": "Sprint 7", "state": "PLANNED"}
    assert note["issue"] is None


def test_note_can_link_both(client, project):
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"])
    sprint = _create_sprint(client, admin, project["id"])
    note = _note_ok(client, admin, project["id"],
                    issue_id=issue["id"], sprint_id=sprint["id"])

    assert note["issue"]["id"] == issue["id"]
    assert note["sprint"]["id"] == sprint["id"]


def test_links_are_referenced_not_copied(client, project):
    """Renaming the issue changes what the note shows, with no write to it."""
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"], "Old title")
    note = _note_ok(client, admin, project["id"], issue_id=issue["id"])

    client.patch(f"/issues/{issue['id']}", json={"title": "New title"}, headers=admin)

    fresh = client.get(f"/notes/{note['id']}", headers=admin).json()
    assert fresh["issue"]["title"] == "New title"
    assert fresh["updated_at"] == note["updated_at"]  # the note itself was untouched


def test_link_to_a_deleted_issue_resolves_to_none(client, project):
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"])
    note = _note_ok(client, admin, project["id"], issue_id=issue["id"])

    assert client.delete(f"/issues/{issue['id']}", headers=admin).status_code == 204

    fresh = client.get(f"/notes/{note['id']}", headers=admin).json()
    assert fresh["issue"] is None      # the link stops resolving
    assert fresh["title"] == note["title"]  # but the note survives


def test_cross_project_issue_link_rejected(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    outside = _create_issue(client, admin, other["id"])

    r = _note(client, admin, project["id"], issue_id=outside["id"])
    assert r.status_code == 422
    assert "same project" in r.json()["detail"].lower()


def test_cross_project_sprint_link_rejected(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    outside = _create_sprint(client, admin, other["id"])

    r = _note(client, admin, project["id"], sprint_id=outside["id"])
    assert r.status_code == 422
    assert "same project" in r.json()["detail"].lower()


def test_unknown_link_targets_404(client, project):
    assert _note(client, project["admin"], project["id"], issue_id=999999).status_code == 404
    assert _note(client, project["admin"], project["id"], sprint_id=999999).status_code == 404


def test_links_can_be_added_changed_and_cleared(client, project):
    admin = project["admin"]
    a = _create_issue(client, admin, project["id"], "A")
    b = _create_issue(client, admin, project["id"], "B")
    note = _note_ok(client, admin, project["id"])

    linked = client.patch(
        f"/notes/{note['id']}", json={"issue_id": a["id"]}, headers=admin
    ).json()
    assert linked["issue"]["id"] == a["id"]

    moved = client.patch(
        f"/notes/{note['id']}", json={"issue_id": b["id"]}, headers=admin
    ).json()
    assert moved["issue"]["id"] == b["id"]

    cleared = client.patch(
        f"/notes/{note['id']}", json={"issue_id": None}, headers=admin
    ).json()
    assert cleared["issue"] is None


def test_a_patch_that_omits_a_link_leaves_it_alone(client, project):
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"])
    note = _note_ok(client, admin, project["id"], issue_id=issue["id"])

    patched = client.patch(
        f"/notes/{note['id']}", json={"title": "Renamed"}, headers=admin
    ).json()
    assert patched["title"] == "Renamed"
    assert patched["issue"]["id"] == issue["id"]


def test_cross_project_link_rejected_on_edit_too(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    outside = _create_sprint(client, admin, other["id"])
    note = _note_ok(client, admin, project["id"])

    assert client.patch(
        f"/notes/{note['id']}", json={"sprint_id": outside["id"]}, headers=admin
    ).status_code == 422


# ---------- edit + delete permissions ----------


def test_author_can_edit_own_note(client, project):
    admin = project["admin"]
    note = _note_ok(client, admin, project["id"], title="Draft", content="rough")

    r = client.patch(
        f"/notes/{note['id']}",
        json={"title": "Final", "content": "polished", "note_type": "TECHNICAL"},
        headers=admin,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Final"
    assert r.json()["content"] == "polished"
    assert r.json()["note_type"] == "TECHNICAL"


def test_non_author_cannot_edit_even_as_admin(client, project):
    """Matches comments and chat: a note carries someone's name."""
    admin = project["admin"]
    _make_user(client, "dev@test.dev", "Dev")
    _add_member(client, admin, project["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")

    note = _note_ok(client, dev, project["id"], title="Dev's note")

    assert client.patch(
        f"/notes/{note['id']}", json={"title": "Rewritten"}, headers=admin
    ).status_code == 403


def test_author_can_delete_own_note(client, project):
    admin = project["admin"]
    note = _note_ok(client, admin, project["id"])
    assert client.delete(f"/notes/{note['id']}", headers=admin).status_code == 204
    assert client.get(f"/notes/{note['id']}", headers=admin).status_code == 404


def test_admin_can_delete_any_note(client, project):
    admin = project["admin"]
    _make_user(client, "dev@test.dev", "Dev")
    _add_member(client, admin, project["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")

    note = _note_ok(client, dev, project["id"])
    assert client.delete(f"/notes/{note['id']}", headers=admin).status_code == 204


def test_member_cannot_delete_another_members_note(client, project):
    admin = project["admin"]
    for email, name in (("dev@test.dev", "Dev"), ("qa@test.dev", "QA")):
        _make_user(client, email, name)
        _add_member(client, admin, project["id"], email)
    dev = _make_user(client, "dev@test.dev", "Dev")
    qa = _make_user(client, "qa@test.dev", "QA")

    note = _note_ok(client, dev, project["id"])
    assert client.delete(f"/notes/{note['id']}", headers=qa).status_code == 403


def test_delete_is_hard(client, project):
    admin = project["admin"]
    note = _note_ok(client, admin, project["id"])
    client.delete(f"/notes/{note['id']}", headers=admin)
    assert client.patch(
        f"/notes/{note['id']}", json={"title": "x"}, headers=admin
    ).status_code == 404


# ---------- authorization ----------


def test_non_member_gets_404_everywhere(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    note = _note_ok(client, project["admin"], project["id"])

    assert client.get(f"/projects/{project['id']}/notes", headers=outsider).status_code == 404
    assert _note(client, outsider, project["id"]).status_code == 404
    assert client.get(f"/notes/{note['id']}", headers=outsider).status_code == 404
    assert client.patch(
        f"/notes/{note['id']}", json={"title": "x"}, headers=outsider
    ).status_code == 404
    assert client.delete(f"/notes/{note['id']}", headers=outsider).status_code == 404


def test_any_member_can_create_regardless_of_role(client, project):
    admin = project["admin"]
    _make_user(client, "qa@test.dev", "QA")
    _add_member(client, admin, project["id"], "qa@test.dev", role="TESTER")
    qa = _make_user(client, "qa@test.dev", "QA")

    assert _note(client, qa, project["id"], title="Test plan").status_code == 201


# ---------- archived project ----------


def test_archived_project_notes_are_read_only(client, project):
    admin = project["admin"]
    note = _note_ok(client, admin, project["id"], title="Before archiving")
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)

    # Reading is unchanged.
    assert client.get(f"/projects/{project['id']}/notes", headers=admin).status_code == 200
    assert client.get(f"/notes/{note['id']}", headers=admin).json()["title"] == "Before archiving"

    # Every write is refused.
    assert _note(client, admin, project["id"]).status_code == 403
    assert client.patch(
        f"/notes/{note['id']}", json={"title": "nope"}, headers=admin
    ).status_code == 403
    assert client.delete(f"/notes/{note['id']}", headers=admin).status_code == 403


def test_notes_resume_after_restore(client, project):
    admin = project["admin"]
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)
    client.patch(f"/projects/{project['id']}", json={"archived": False}, headers=admin)
    assert _note(client, admin, project["id"], title="Back").status_code == 201


# ---------- existing features unaffected ----------


def test_notes_do_not_disturb_issues_or_sprints(client, project):
    admin = project["admin"]
    issue = _create_issue(client, admin, project["id"])
    sprint = _create_sprint(client, admin, project["id"])
    before_issue = client.get(f"/issues/{issue['id']}", headers=admin).json()
    before_activities = client.get(f"/issues/{issue['id']}/activities", headers=admin).json()

    _note_ok(client, admin, project["id"], issue_id=issue["id"], sprint_id=sprint["id"])

    assert client.get(f"/issues/{issue['id']}", headers=admin).json() == before_issue
    # Linking a note is not a change to the issue, so nothing is logged.
    assert client.get(f"/issues/{issue['id']}/activities", headers=admin).json() == before_activities
    assert client.get(f"/sprints/{sprint['id']}", headers=admin).json() == sprint
    assert "note" not in str(client.get(f"/projects/{project['id']}/board", headers=admin).json())
