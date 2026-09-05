"""Project meeting tests (Sprint 6).

Meetings are a schedule with an agenda and a pasted link. Nothing here calls
Google or any calendar, and no test asserts that it does — the link is opaque
text the API stores and returns.
"""

from datetime import datetime, timedelta, timezone

import pytest


def _iso(delta: timedelta) -> str:
    """An offset-aware ISO timestamp relative to now."""
    return (datetime.now(timezone.utc) + delta).isoformat()


SOON = timedelta(days=2)
LATER = timedelta(days=9)
AGO = timedelta(days=-3)
LONG_AGO = timedelta(days=-30)


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
    return r.json()


def _create_sprint(client, headers, pid, name="Sprint 1"):
    r = client.post(f"/projects/{pid}/sprints", json={"name": name}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _meeting(client, headers, pid, **fields):
    payload = {"title": "Standup", "scheduled_at": _iso(SOON), **fields}
    return client.post(f"/projects/{pid}/meetings", json=payload, headers=headers)


def _meeting_ok(client, headers, pid, **fields):
    r = _meeting(client, headers, pid, **fields)
    assert r.status_code == 201, r.text
    return r.json()


def _me(client, headers):
    return client.get("/auth/me", headers=headers).json()["id"]


@pytest.fixture()
def project(client):
    """An admin plus one developer, both members of one project."""
    admin = _make_user(client, "admin@test.dev", "Admin")
    proj = _create_project(client, admin, key="DEV")
    _make_user(client, "dev@test.dev", "Dev")
    dev_member = _add_member(client, admin, proj["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")
    return {
        "admin": admin,
        "dev": dev,
        "id": proj["id"],
        "admin_id": _me(client, admin),
        "dev_id": dev_member["user_id"],
    }


# ---------- create + read ----------


def test_member_can_create_a_meeting(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"],
                          title="Sprint planning", description="Agenda:\n- scope")

    assert meeting["title"] == "Sprint planning"
    assert meeting["description"] == "Agenda:\n- scope"   # multiline kept
    assert meeting["organizer_id"] == project["admin_id"]
    assert meeting["organizer_name"] == "Admin"
    assert meeting["duration_minutes"] is None
    assert meeting["meet_url"] is None
    assert meeting["sprint"] is None
    assert meeting["participants"] == []


def test_meeting_response_has_every_field_the_ui_needs(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"])
    assert set(meeting) == {
        "id", "project_id", "organizer_id", "organizer_name", "title", "description",
        "scheduled_at", "duration_minutes", "meet_url", "sprint", "participants",
        "created_at", "updated_at",
    }


def test_any_member_can_create_regardless_of_role(client, project):
    admin = project["admin"]
    _make_user(client, "qa@test.dev", "QA")
    _add_member(client, admin, project["id"], "qa@test.dev", role="TESTER")
    qa = _make_user(client, "qa@test.dev", "QA")
    assert _meeting(client, qa, project["id"]).status_code == 201


def test_member_can_read_the_list_and_one_meeting(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"], title="Readable")

    listed = client.get(f"/projects/{project['id']}/meetings", headers=project["dev"]).json()
    assert [m["id"] for m in listed] == [meeting["id"]]
    assert client.get(f"/meetings/{meeting['id']}", headers=project["dev"]).json()["title"] == "Readable"


def test_empty_list(client, project):
    assert client.get(f"/projects/{project['id']}/meetings", headers=project["admin"]).json() == []


def test_unknown_meeting_404(client, project):
    admin = project["admin"]
    assert client.get("/meetings/999999", headers=admin).status_code == 404
    assert client.patch("/meetings/999999", json={"title": "x"}, headers=admin).status_code == 404
    assert client.delete("/meetings/999999", headers=admin).status_code == 404


def test_meetings_are_scoped_to_their_project(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    _meeting_ok(client, admin, project["id"])
    assert client.get(f"/projects/{other['id']}/meetings", headers=admin).json() == []


# ---------- scheduling: upcoming vs past ----------


def test_upcoming_and_past_are_separated(client, project):
    admin = project["admin"]
    soon = _meeting_ok(client, admin, project["id"], title="Soon", scheduled_at=_iso(SOON))
    later = _meeting_ok(client, admin, project["id"], title="Later", scheduled_at=_iso(LATER))
    recent = _meeting_ok(client, admin, project["id"], title="Recent", scheduled_at=_iso(AGO))
    old = _meeting_ok(client, admin, project["id"], title="Old", scheduled_at=_iso(LONG_AGO))

    upcoming = client.get(
        f"/projects/{project['id']}/meetings?scope=upcoming", headers=admin
    ).json()
    past = client.get(f"/projects/{project['id']}/meetings?scope=past", headers=admin).json()

    # Upcoming counts forward: the next one first.
    assert [m["id"] for m in upcoming] == [soon["id"], later["id"]]
    # Past counts back: the most recent first.
    assert [m["id"] for m in past] == [recent["id"], old["id"]]


def test_unscoped_list_returns_everything(client, project):
    admin = project["admin"]
    _meeting_ok(client, admin, project["id"], scheduled_at=_iso(SOON))
    _meeting_ok(client, admin, project["id"], scheduled_at=_iso(AGO))
    assert len(client.get(f"/projects/{project['id']}/meetings", headers=admin).json()) == 2


def test_invalid_scope_422(client, project):
    assert client.get(
        f"/projects/{project['id']}/meetings?scope=sideways", headers=project["admin"]
    ).status_code == 422


def test_rescheduling_moves_a_meeting_between_sections(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], scheduled_at=_iso(SOON))
    assert len(client.get(f"/projects/{project['id']}/meetings?scope=upcoming", headers=admin).json()) == 1

    client.patch(f"/meetings/{meeting['id']}", json={"scheduled_at": _iso(AGO)}, headers=admin)

    assert client.get(f"/projects/{project['id']}/meetings?scope=upcoming", headers=admin).json() == []
    assert len(client.get(f"/projects/{project['id']}/meetings?scope=past", headers=admin).json()) == 1


def test_offset_aware_input_is_converted_not_truncated(client, project):
    """A client may send any offset; the stored instant must still be right."""
    admin = project["admin"]
    # 09:00 at +05:30 is 03:30 UTC on the same day.
    meeting = _meeting_ok(client, admin, project["id"],
                          scheduled_at="2030-06-01T09:00:00+05:30")
    assert meeting["scheduled_at"].startswith("2030-06-01T03:30:00")


def test_naive_input_is_taken_as_given(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"],
                          scheduled_at="2030-06-01T09:00:00")
    assert meeting["scheduled_at"].startswith("2030-06-01T09:00:00")


# ---------- validation ----------


def test_blank_title_rejected(client, project):
    assert _meeting(client, project["admin"], project["id"], title="").status_code == 422
    assert _meeting(client, project["admin"], project["id"], title="   ").status_code == 422


def test_overlong_title_rejected(client, project):
    assert _meeting(client, project["admin"], project["id"], title="x" * 201).status_code == 422


def test_missing_schedule_rejected(client, project):
    r = client.post(f"/projects/{project['id']}/meetings",
                    json={"title": "No when"}, headers=project["admin"])
    assert r.status_code == 422


def test_unparseable_schedule_rejected(client, project):
    assert _meeting(client, project["admin"], project["id"],
                    scheduled_at="next tuesday").status_code == 422


def test_duration_is_bounded(client, project):
    admin, pid = project["admin"], project["id"]
    assert _meeting_ok(client, admin, pid, duration_minutes=30)["duration_minutes"] == 30
    assert _meeting(client, admin, pid, duration_minutes=0).status_code == 422
    assert _meeting(client, admin, pid, duration_minutes=-15).status_code == 422
    assert _meeting(client, admin, pid, duration_minutes=24 * 60 + 1).status_code == 422
    assert _meeting_ok(client, admin, pid, duration_minutes=24 * 60)["duration_minutes"] == 1440


# ---------- the pasted meeting link ----------


def test_a_valid_link_is_stored_verbatim(client, project):
    url = "https://meet.google.com/abc-defg-hij"
    assert _meeting_ok(client, project["admin"], project["id"], meet_url=url)["meet_url"] == url


def test_http_is_accepted_and_so_is_a_non_google_host(client, project):
    """Nothing calls the URL, so it is not restricted to one provider."""
    admin, pid = project["admin"], project["id"]
    assert _meeting_ok(client, admin, pid, meet_url="http://meet.example.dev/x")["meet_url"]
    assert _meeting_ok(client, admin, pid, meet_url="https://zoom.us/j/123")["meet_url"]


def test_malformed_links_rejected(client, project):
    admin, pid = project["admin"], project["id"]
    for bad in ("meet.google.com/abc", "javascript:alert(1)", "ftp://x.dev/a", "https://", "not a url"):
        assert _meeting(client, admin, pid, meet_url=bad).status_code == 422, bad


def test_overlong_link_rejected(client, project):
    long_url = "https://meet.google.com/" + "x" * 500
    assert _meeting(client, project["admin"], project["id"], meet_url=long_url).status_code == 422


def test_link_can_be_added_and_cleared(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"])

    added = client.patch(f"/meetings/{meeting['id']}",
                         json={"meet_url": "https://meet.google.com/xyz"}, headers=admin).json()
    assert added["meet_url"] == "https://meet.google.com/xyz"

    for clearing in ({"meet_url": None}, {"meet_url": "   "}):
        client.patch(f"/meetings/{meeting['id']}",
                     json={"meet_url": "https://meet.google.com/xyz"}, headers=admin)
        cleared = client.patch(f"/meetings/{meeting['id']}", json=clearing, headers=admin).json()
        assert cleared["meet_url"] is None, clearing


# ---------- participants ----------


def test_participants_are_stored_and_returned(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"],
                          participant_ids=[project["admin_id"], project["dev_id"]])

    assert [p["user_id"] for p in meeting["participants"]] == [
        project["admin_id"], project["dev_id"],
    ]
    assert {p["name"] for p in meeting["participants"]} == {"Admin", "Dev"}
    # Only the identity fields the UI shows — no user record is copied in.
    assert set(meeting["participants"][0]) == {"user_id", "name", "email"}


def test_non_member_cannot_be_a_participant(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    outsider_id = _me(client, outsider)

    r = _meeting(client, project["admin"], project["id"], participant_ids=[outsider_id])
    assert r.status_code == 422
    assert "member of this project" in r.json()["detail"].lower()


def test_unknown_participant_rejected(client, project):
    assert _meeting(client, project["admin"], project["id"],
                    participant_ids=[999999]).status_code == 422


def test_duplicate_participants_are_collapsed(client, project):
    meeting = _meeting_ok(client, project["admin"], project["id"],
                          participant_ids=[project["dev_id"], project["dev_id"]])
    assert [p["user_id"] for p in meeting["participants"]] == [project["dev_id"]]


def test_participants_can_be_replaced_and_emptied(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"],
                          participant_ids=[project["admin_id"], project["dev_id"]])

    only_dev = client.patch(f"/meetings/{meeting['id']}",
                            json={"participant_ids": [project["dev_id"]]}, headers=admin).json()
    assert [p["user_id"] for p in only_dev["participants"]] == [project["dev_id"]]

    emptied = client.patch(f"/meetings/{meeting['id']}",
                           json={"participant_ids": []}, headers=admin).json()
    assert emptied["participants"] == []


def test_a_patch_omitting_participants_leaves_them_alone(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], participant_ids=[project["dev_id"]])
    patched = client.patch(f"/meetings/{meeting['id']}",
                           json={"title": "Renamed"}, headers=admin).json()
    assert [p["user_id"] for p in patched["participants"]] == [project["dev_id"]]


def test_removing_a_member_from_the_project_rejects_them_on_the_next_edit(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], participant_ids=[project["dev_id"]])
    assert client.delete(
        f"/projects/{project['id']}/members/{project['dev_id']}", headers=admin
    ).status_code == 204

    assert client.patch(f"/meetings/{meeting['id']}",
                        json={"participant_ids": [project["dev_id"]]},
                        headers=admin).status_code == 422


# ---------- sprint link ----------


def test_meeting_can_link_a_sprint(client, project):
    admin = project["admin"]
    sprint = _create_sprint(client, admin, project["id"], "Sprint 7")
    meeting = _meeting_ok(client, admin, project["id"], sprint_id=sprint["id"])
    assert meeting["sprint"] == {"id": sprint["id"], "name": "Sprint 7", "state": "PLANNED"}


def test_cross_project_sprint_rejected(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    outside = _create_sprint(client, admin, other["id"])

    r = _meeting(client, admin, project["id"], sprint_id=outside["id"])
    assert r.status_code == 422
    assert "same project" in r.json()["detail"].lower()


def test_unknown_sprint_404(client, project):
    assert _meeting(client, project["admin"], project["id"], sprint_id=999999).status_code == 404


def test_sprint_link_can_be_cleared(client, project):
    admin = project["admin"]
    sprint = _create_sprint(client, admin, project["id"])
    meeting = _meeting_ok(client, admin, project["id"], sprint_id=sprint["id"])
    cleared = client.patch(f"/meetings/{meeting['id']}",
                           json={"sprint_id": None}, headers=admin).json()
    assert cleared["sprint"] is None


def test_sprint_is_referenced_not_copied(client, project):
    admin = project["admin"]
    sprint = _create_sprint(client, admin, project["id"], "Old name")
    meeting = _meeting_ok(client, admin, project["id"], sprint_id=sprint["id"])

    client.patch(f"/sprints/{sprint['id']}", json={"name": "New name"}, headers=admin)

    fresh = client.get(f"/meetings/{meeting['id']}", headers=admin).json()
    assert fresh["sprint"]["name"] == "New name"
    assert fresh["updated_at"] == meeting["updated_at"]  # the meeting was untouched


# ---------- edit + delete permissions ----------


def test_organizer_can_edit_their_meeting(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], title="Draft")
    r = client.patch(f"/meetings/{meeting['id']}",
                     json={"title": "Final", "description": "Agenda", "duration_minutes": 45},
                     headers=admin)
    assert r.status_code == 200
    assert r.json()["title"] == "Final"
    assert r.json()["duration_minutes"] == 45


def test_another_member_cannot_edit_even_as_admin(client, project):
    """Matches the author-only edit rule used by notes, comments and chat."""
    meeting = _meeting_ok(client, project["dev"], project["id"], title="Dev's meeting")
    assert client.patch(f"/meetings/{meeting['id']}",
                        json={"title": "Hijacked"}, headers=project["admin"]).status_code == 403


def test_organizer_can_delete_their_meeting(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"])
    assert client.delete(f"/meetings/{meeting['id']}", headers=admin).status_code == 204
    assert client.get(f"/meetings/{meeting['id']}", headers=admin).status_code == 404


def test_admin_can_delete_any_meeting(client, project):
    meeting = _meeting_ok(client, project["dev"], project["id"])
    assert client.delete(f"/meetings/{meeting['id']}", headers=project["admin"]).status_code == 204


def test_member_cannot_delete_another_members_meeting(client, project):
    admin = project["admin"]
    _make_user(client, "qa@test.dev", "QA")
    _add_member(client, admin, project["id"], "qa@test.dev")
    qa = _make_user(client, "qa@test.dev", "QA")

    meeting = _meeting_ok(client, project["dev"], project["id"])
    assert client.delete(f"/meetings/{meeting['id']}", headers=qa).status_code == 403


def test_deleting_a_meeting_removes_its_participants(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"],
                          participant_ids=[project["admin_id"], project["dev_id"]])
    assert client.delete(f"/meetings/{meeting['id']}", headers=admin).status_code == 204
    # The project's members are untouched by the cascade.
    assert len(client.get(f"/projects/{project['id']}/members", headers=admin).json()) == 2


# ---------- authorization ----------


def test_non_member_gets_404_everywhere(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    meeting = _meeting_ok(client, project["admin"], project["id"])

    assert client.get(f"/projects/{project['id']}/meetings", headers=outsider).status_code == 404
    assert _meeting(client, outsider, project["id"]).status_code == 404
    assert client.get(f"/meetings/{meeting['id']}", headers=outsider).status_code == 404
    assert client.patch(f"/meetings/{meeting['id']}",
                        json={"title": "x"}, headers=outsider).status_code == 404
    assert client.delete(f"/meetings/{meeting['id']}", headers=outsider).status_code == 404


# ---------- archived project ----------


def test_archived_project_meetings_are_read_only(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], title="Before archiving")
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)

    assert client.get(f"/projects/{project['id']}/meetings", headers=admin).status_code == 200
    assert client.get(f"/meetings/{meeting['id']}", headers=admin).json()["title"] == "Before archiving"

    assert _meeting(client, admin, project["id"]).status_code == 403
    assert client.patch(f"/meetings/{meeting['id']}",
                        json={"title": "nope"}, headers=admin).status_code == 403
    assert client.delete(f"/meetings/{meeting['id']}", headers=admin).status_code == 403


def test_meetings_resume_after_restore(client, project):
    admin = project["admin"]
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)
    client.patch(f"/projects/{project['id']}", json={"archived": False}, headers=admin)
    assert _meeting(client, admin, project["id"]).status_code == 201


# ---------- the optional note link ----------


def _note(client, headers, pid, **fields):
    payload = {"title": "Meeting notes", "content": "Decisions:", **fields}
    return client.post(f"/projects/{pid}/notes", json=payload, headers=headers)


def test_a_note_can_be_linked_to_a_meeting(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"], title="Retro")
    r = _note(client, admin, project["id"], meeting_id=meeting["id"])
    assert r.status_code == 201, r.text
    assert r.json()["meeting"] == {
        "id": meeting["id"], "title": "Retro", "scheduled_at": meeting["scheduled_at"],
    }


def test_a_meetings_notes_are_fetched_in_one_request(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"])
    other = _meeting_ok(client, admin, project["id"], title="Other")
    mine = _note(client, admin, project["id"], title="Mine", meeting_id=meeting["id"]).json()
    _note(client, admin, project["id"], title="Theirs", meeting_id=other["id"])
    _note(client, admin, project["id"], title="Unlinked")

    listed = client.get(
        f"/projects/{project['id']}/notes?meeting_id={meeting['id']}", headers=admin
    ).json()
    assert [n["id"] for n in listed] == [mine["id"]]


def test_cross_project_meeting_link_rejected(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    outside = _meeting_ok(client, admin, other["id"])

    r = _note(client, admin, project["id"], meeting_id=outside["id"])
    assert r.status_code == 422
    assert "same project" in r.json()["detail"].lower()


def test_unknown_meeting_link_404(client, project):
    assert _note(client, project["admin"], project["id"], meeting_id=999999).status_code == 404


def test_deleting_a_meeting_detaches_its_notes_without_losing_them(client, project):
    admin = project["admin"]
    meeting = _meeting_ok(client, admin, project["id"])
    note = _note(client, admin, project["id"], title="Survivor", meeting_id=meeting["id"]).json()

    assert client.delete(f"/meetings/{meeting['id']}", headers=admin).status_code == 204

    fresh = client.get(f"/notes/{note['id']}", headers=admin).json()
    assert fresh["title"] == "Survivor"
    assert fresh["meeting"] is None


def test_notes_without_a_meeting_are_unaffected(client, project):
    admin = project["admin"]
    plain = _note(client, admin, project["id"], title="Plain").json()
    assert plain["meeting"] is None
    listed = client.get(f"/projects/{project['id']}/notes", headers=admin).json()
    assert [n["id"] for n in listed] == [plain["id"]]


# ---------- existing features unaffected ----------


def test_meetings_do_not_disturb_sprints_or_members(client, project):
    admin = project["admin"]
    sprint = _create_sprint(client, admin, project["id"])
    before_members = client.get(f"/projects/{project['id']}/members", headers=admin).json()

    _meeting_ok(client, admin, project["id"], sprint_id=sprint["id"],
                participant_ids=[project["dev_id"]])

    assert client.get(f"/sprints/{sprint['id']}", headers=admin).json() == sprint
    assert client.get(f"/projects/{project['id']}/members", headers=admin).json() == before_members
    assert client.get(f"/projects/{project['id']}/issues", headers=admin).status_code == 200
    assert client.get(f"/projects/{project['id']}/board", headers=admin).status_code == 200
