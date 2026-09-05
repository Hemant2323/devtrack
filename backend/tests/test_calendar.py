"""Project calendar tests (Sprint 6).

The calendar is a view over data that already exists, so most of these check
that a source's own date is what appears — and that changing it at the source
changes the calendar with no second write anywhere.
"""

from datetime import date, datetime, timedelta, timezone

import pytest


TODAY = date.today()
IN_RANGE = TODAY.replace(day=15) if TODAY.day != 15 else TODAY
MONTH_START = TODAY.replace(day=1)


def day(offset: int) -> str:
    return (IN_RANGE + timedelta(days=offset)).isoformat()


def window(before=20, after=20):
    return {"start": (IN_RANGE - timedelta(days=before)).isoformat(),
            "end": (IN_RANGE + timedelta(days=after)).isoformat()}


def instant(offset_days: int, hour: int = 10) -> str:
    at = datetime.combine(IN_RANGE + timedelta(days=offset_days),
                          datetime.min.time()).replace(hour=hour, tzinfo=timezone.utc)
    return at.isoformat()


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


def _issue(client, headers, pid, title="An issue", deadline=None):
    payload = {"type": "TASK", "title": title}
    if deadline:
        payload["deadline"] = deadline
    r = client.post(f"/projects/{pid}/issues", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _case(client, headers, pid, title="A case", deadline=None):
    payload = {"title": title}
    if deadline:
        payload["deadline"] = deadline
    r = client.post(f"/projects/{pid}/test-cases", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _sprint(client, headers, pid, name="Sprint 1", start=None, end=None):
    payload = {"name": name}
    if start:
        payload["start_date"] = start
    if end:
        payload["end_date"] = end
    r = client.post(f"/projects/{pid}/sprints", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _meeting(client, headers, pid, title="Standup", at=None, duration=None):
    payload = {"title": title, "scheduled_at": at or instant(0)}
    if duration:
        payload["duration_minutes"] = duration
    r = client.post(f"/projects/{pid}/meetings", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _event(client, headers, pid, **fields):
    payload = {"title": "Release day", "starts_at": instant(1), **fields}
    return client.post(f"/projects/{pid}/calendar/events", json=payload, headers=headers)


def _event_ok(client, headers, pid, **fields):
    r = _event(client, headers, pid, **fields)
    assert r.status_code == 201, r.text
    return r.json()


def _calendar(client, headers, pid, **params):
    q = {**window(), **params}
    query = "&".join(f"{k}={v}" for k, v in q.items() if v is not None)
    r = client.get(f"/projects/{pid}/calendar?{query}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _by_type(entries, type_):
    return [e for e in entries if e["type"] == type_]


@pytest.fixture()
def project(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    proj = _create_project(client, admin, key="DEV")
    _make_user(client, "dev@test.dev", "Dev")
    dev_member = _add_member(client, admin, proj["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")
    return {"admin": admin, "dev": dev, "id": proj["id"], "dev_id": dev_member["user_id"]}


# ---------- aggregation ----------


def test_empty_calendar(client, project):
    assert _calendar(client, project["admin"], project["id"]) == []


def test_issue_deadline_appears(client, project):
    issue = _issue(client, project["admin"], project["id"], "Ship payments", day(0))
    entries = _calendar(client, project["admin"], project["id"])

    assert len(entries) == 1
    entry = entries[0]
    assert entry["type"] == "ISSUE"
    assert entry["source_id"] == issue["id"]
    assert entry["id"] == f"issue:{issue['id']}"
    assert entry["title"] == "Ship payments"
    assert entry["start"].startswith(day(0))
    assert entry["all_day"] is True
    assert entry["reference"] == issue["key"]     # DEV-1, for navigation and display
    assert entry["status"] == "TODO"


def test_issue_without_a_deadline_is_absent(client, project):
    _issue(client, project["admin"], project["id"], "No date")
    assert _calendar(client, project["admin"], project["id"]) == []


def test_test_case_deadline_appears(client, project):
    case = _case(client, project["admin"], project["id"], "Regression pass", day(2))
    entries = _by_type(_calendar(client, project["admin"], project["id"]), "TEST_CASE")

    assert len(entries) == 1
    assert entries[0]["source_id"] == case["id"]
    assert entries[0]["title"] == "Regression pass"
    assert entries[0]["all_day"] is True


def test_test_case_without_a_deadline_is_absent(client, project):
    _case(client, project["admin"], project["id"], "Standing check")
    assert _calendar(client, project["admin"], project["id"]) == []


def test_sprint_appears_as_a_span(client, project):
    sprint = _sprint(client, project["admin"], project["id"], "Sprint 9",
                     start=day(-2), end=day(5))
    entry = _by_type(_calendar(client, project["admin"], project["id"]), "SPRINT")[0]

    assert entry["source_id"] == sprint["id"]
    assert entry["title"] == "Sprint 9"
    assert entry["start"].startswith(day(-2))
    assert entry["end"].startswith(day(5))
    assert entry["all_day"] is True
    assert entry["status"] == "PLANNED"


def test_sprint_with_no_dates_is_absent(client, project):
    _sprint(client, project["admin"], project["id"], "Undated")
    assert _calendar(client, project["admin"], project["id"]) == []


def test_meeting_appears_with_its_time_and_duration(client, project):
    meeting = _meeting(client, project["admin"], project["id"], "Planning",
                       at=instant(1, hour=14), duration=45)
    entry = _by_type(_calendar(client, project["admin"], project["id"]), "MEETING")[0]

    assert entry["source_id"] == meeting["id"]
    assert entry["all_day"] is False           # an instant, not a date
    assert entry["start"].startswith(day(1))
    assert "14:00" in entry["start"]
    assert "14:45" in entry["end"]             # start + duration


def test_meeting_without_a_duration_has_no_end(client, project):
    _meeting(client, project["admin"], project["id"], at=instant(1))
    assert _by_type(_calendar(client, project["admin"], project["id"]), "MEETING")[0]["end"] is None


def test_custom_event_appears(client, project):
    event = _event_ok(client, project["admin"], project["id"], title="Release 2.0")
    entry = _by_type(_calendar(client, project["admin"], project["id"]), "CUSTOM")[0]

    assert entry["source_id"] == event["id"]
    assert entry["id"] == f"custom:{event['id']}"
    assert entry["title"] == "Release 2.0"


def test_every_source_appears_together_sorted_by_start(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(3))
    _case(client, admin, pid, "Case", day(4))
    _sprint(client, admin, pid, "Sprint", start=day(1), end=day(6))
    _meeting(client, admin, pid, "Meeting", at=instant(2))
    _event_ok(client, admin, pid, title="Custom", starts_at=instant(5))

    entries = _calendar(client, admin, pid)
    assert [e["type"] for e in entries] == [
        "SPRINT", "MEETING", "ISSUE", "TEST_CASE", "CUSTOM",
    ]
    assert [e["start"] for e in entries] == sorted(e["start"] for e in entries)


def test_entry_exposes_only_what_the_chip_renders(client, project):
    _issue(client, project["admin"], project["id"], "Ship", day(0))
    entry = _calendar(client, project["admin"], project["id"])[0]
    assert set(entry) == {
        "id", "type", "source_id", "title", "start", "end",
        "all_day", "editable", "reference", "status",
    }


def test_ids_are_unique_across_sources(client, project):
    """An issue and a meeting can share a numeric id; the calendar id cannot."""
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(0))
    _meeting(client, admin, pid, "Meeting", at=instant(0))
    _event_ok(client, admin, pid)

    ids = [e["id"] for e in _calendar(client, admin, pid)]
    assert len(set(ids)) == len(ids)


def test_no_source_record_is_duplicated(client, project):
    """One issue is one entry, however many times the calendar is read."""
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Once", day(0))
    for _ in range(3):
        entries = _by_type(_calendar(client, admin, pid), "ISSUE")
        assert [e["source_id"] for e in entries] == [issue["id"]]
    # And nothing was written to the calendar's own table.
    assert client.get(f"/projects/{pid}/calendar/events", headers=admin).json() == []


def test_calendar_is_scoped_to_its_project(client, project):
    admin = project["admin"]
    other = _create_project(client, admin, key="OTH")
    _issue(client, admin, project["id"], "Ours", day(0))
    _event_ok(client, admin, project["id"])

    assert _calendar(client, admin, other["id"]) == []


# ---------- date-range filtering ----------


def test_entries_outside_the_window_are_excluded(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Inside", day(0))
    _issue(client, admin, pid, "Far future", day(60))
    _issue(client, admin, pid, "Far past", day(-60))

    titles = [e["title"] for e in _calendar(client, admin, pid, **window(10, 10))]
    assert titles == ["Inside"]


def test_window_boundaries_are_inclusive(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "First day", day(-5))
    _issue(client, admin, pid, "Last day", day(5))

    titles = [e["title"] for e in _calendar(client, admin, pid, **window(5, 5))]
    assert set(titles) == {"First day", "Last day"}


def test_a_sprint_spanning_the_whole_window_is_included(client, project):
    """Neither endpoint is inside the window, but the sprint covers it."""
    admin, pid = project["admin"], project["id"]
    _sprint(client, admin, pid, "Long sprint", start=day(-40), end=day(40))

    entries = _by_type(_calendar(client, admin, pid, **window(3, 3)), "SPRINT")
    assert [e["title"] for e in entries] == ["Long sprint"]


def test_meeting_late_on_the_last_day_is_included(client, project):
    """The window's end is a date; a meeting at 23:00 that day still counts."""
    admin, pid = project["admin"], project["id"]
    _meeting(client, admin, pid, "Late", at=instant(5, hour=23))
    entries = _by_type(_calendar(client, admin, pid, **window(5, 5)), "MEETING")
    assert [e["title"] for e in entries] == ["Late"]


def test_omitting_the_range_gives_the_current_month(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "This month", MONTH_START.isoformat())

    r = client.get(f"/projects/{pid}/calendar", headers=admin)
    assert r.status_code == 200
    assert [e["title"] for e in r.json()] == ["This month"]


def test_half_a_range_is_rejected(client, project):
    r = client.get(
        f"/projects/{project['id']}/calendar?start={day(0)}", headers=project["admin"]
    )
    assert r.status_code == 422


def test_backwards_range_rejected(client, project):
    r = client.get(
        f"/projects/{project['id']}/calendar?start={day(5)}&end={day(0)}",
        headers=project["admin"],
    )
    assert r.status_code == 422


def test_excessive_range_rejected(client, project):
    r = client.get(
        f"/projects/{project['id']}/calendar?start={day(-200)}&end={day(200)}",
        headers=project["admin"],
    )
    assert r.status_code == 422


# ---------- type filtering ----------


def test_filter_to_one_type(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(0))
    _meeting(client, admin, pid, "Meeting", at=instant(0))
    _event_ok(client, admin, pid)

    only = _calendar(client, admin, pid, types="MEETING")
    assert [e["type"] for e in only] == ["MEETING"]


def test_filter_to_several_types(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(0))
    _case(client, admin, pid, "Case", day(0))
    _meeting(client, admin, pid, "Meeting", at=instant(0))

    entries = client.get(
        f"/projects/{pid}/calendar?start={day(-5)}&end={day(5)}"
        f"&types=ISSUE&types=TEST_CASE",
        headers=admin,
    ).json()
    assert {e["type"] for e in entries} == {"ISSUE", "TEST_CASE"}


def test_invalid_type_rejected(client, project):
    r = client.get(
        f"/projects/{project['id']}/calendar?types=BIRTHDAY", headers=project["admin"]
    )
    assert r.status_code == 422


# ---------- the source stays the source ----------


def test_changing_an_issue_deadline_moves_the_calendar_entry(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Ship", day(0))
    assert _calendar(client, admin, pid)[0]["start"].startswith(day(0))

    r = client.patch(f"/issues/{issue['id']}", json={"deadline": day(3)}, headers=admin)
    assert r.status_code == 200

    entries = _calendar(client, admin, pid)
    assert len(entries) == 1                       # moved, not duplicated
    assert entries[0]["start"].startswith(day(3))


def test_clearing_an_issue_deadline_removes_the_entry(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Ship", day(0))
    client.patch(f"/issues/{issue['id']}", json={"deadline": None}, headers=admin)
    assert _calendar(client, admin, pid) == []


def test_changing_a_test_case_deadline_moves_the_entry(client, project):
    admin, pid = project["admin"], project["id"]
    case = _case(client, admin, pid, "Pass", day(0))

    r = client.patch(f"/test-cases/{case['id']}", json={"deadline": day(4)}, headers=admin)
    assert r.status_code == 200
    assert r.json()["deadline"] == day(4)

    entries = _by_type(_calendar(client, admin, pid), "TEST_CASE")
    assert len(entries) == 1
    assert entries[0]["start"].startswith(day(4))


def test_rescheduling_a_meeting_moves_the_entry(client, project):
    admin, pid = project["admin"], project["id"]
    meeting = _meeting(client, admin, pid, "Sync", at=instant(0))

    r = client.patch(f"/meetings/{meeting['id']}",
                     json={"scheduled_at": instant(2, hour=16)}, headers=admin)
    assert r.status_code == 200

    entries = _by_type(_calendar(client, admin, pid), "MEETING")
    assert len(entries) == 1
    assert entries[0]["start"].startswith(day(2))
    assert "16:00" in entries[0]["start"]


def test_moving_a_sprint_moves_the_entry(client, project):
    admin, pid = project["admin"], project["id"]
    sprint = _sprint(client, admin, pid, "S", start=day(0), end=day(3))

    client.patch(f"/sprints/{sprint['id']}",
                 json={"start_date": day(1), "end_date": day(6)}, headers=admin)

    entry = _by_type(_calendar(client, admin, pid), "SPRINT")[0]
    assert entry["start"].startswith(day(1))
    assert entry["end"].startswith(day(6))


def test_a_deleted_issue_leaves_the_calendar(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Doomed", day(0))
    assert client.delete(f"/issues/{issue['id']}", headers=admin).status_code == 204
    assert _calendar(client, admin, pid) == []


# ---------- which entries are editable from the calendar ----------


def test_issues_and_test_cases_are_editable_by_any_member(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(0))
    _case(client, admin, pid, "Case", day(0))

    for entry in _calendar(client, project["dev"], pid):
        assert entry["editable"] is True, entry


def test_sprints_are_never_editable_from_the_calendar(client, project):
    """Sprint dates are admin-only and refuse edits once completed, so the
    calendar declines to offer them rather than inventing a safe-looking one."""
    admin, pid = project["admin"], project["id"]
    _sprint(client, admin, pid, "S", start=day(0), end=day(3))
    assert _by_type(_calendar(client, admin, pid), "SPRINT")[0]["editable"] is False


def test_a_meeting_is_editable_only_by_its_organizer(client, project):
    admin, pid = project["admin"], project["id"]
    _meeting(client, admin, pid, "Admin's meeting", at=instant(0))

    assert _by_type(_calendar(client, admin, pid), "MEETING")[0]["editable"] is True
    assert _by_type(_calendar(client, project["dev"], pid), "MEETING")[0]["editable"] is False


def test_a_custom_event_is_editable_only_by_its_creator(client, project):
    admin, pid = project["admin"], project["id"]
    _event_ok(client, admin, pid)

    assert _by_type(_calendar(client, admin, pid), "CUSTOM")[0]["editable"] is True
    assert _by_type(_calendar(client, project["dev"], pid), "CUSTOM")[0]["editable"] is False


def test_nothing_is_editable_in_an_archived_project(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Issue", day(0))
    _case(client, admin, pid, "Case", day(0))
    _meeting(client, admin, pid, "Meeting", at=instant(0))
    _event_ok(client, admin, pid)
    client.patch(f"/projects/{pid}", json={"archived": True}, headers=admin)

    entries = _calendar(client, admin, pid)
    assert len(entries) == 4
    assert all(entry["editable"] is False for entry in entries)


# ---------- custom event CRUD ----------


def test_create_custom_event(client, project):
    event = _event_ok(client, project["admin"], project["id"],
                      title="Release 2.0", description="Ship it",
                      starts_at=instant(1, hour=9), ends_at=instant(1, hour=17))

    assert event["title"] == "Release 2.0"
    assert event["description"] == "Ship it"
    assert event["creator_name"] == "Admin"
    assert event["ends_at"] is not None
    assert set(event) == {
        "id", "project_id", "creator_id", "creator_name", "title", "description",
        "starts_at", "ends_at", "created_at", "updated_at",
    }


def test_read_and_list_custom_events(client, project):
    admin, pid = project["admin"], project["id"]
    event = _event_ok(client, admin, pid, title="Listed")

    assert client.get(f"/calendar/events/{event['id']}", headers=admin).json()["title"] == "Listed"
    listed = client.get(
        f"/projects/{pid}/calendar/events?start={day(-5)}&end={day(5)}", headers=admin
    ).json()
    assert [e["id"] for e in listed] == [event["id"]]


def test_update_custom_event(client, project):
    admin = project["admin"]
    event = _event_ok(client, admin, project["id"])

    r = client.patch(f"/calendar/events/{event['id']}",
                     json={"title": "Renamed", "starts_at": instant(4)}, headers=admin)
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["starts_at"].startswith(day(4))

    entry = _by_type(_calendar(client, admin, project["id"]), "CUSTOM")[0]
    assert entry["start"].startswith(day(4))


def test_delete_custom_event(client, project):
    admin = project["admin"]
    event = _event_ok(client, admin, project["id"])
    assert client.delete(f"/calendar/events/{event['id']}", headers=admin).status_code == 204
    assert client.get(f"/calendar/events/{event['id']}", headers=admin).status_code == 404
    assert _calendar(client, admin, project["id"]) == []


def test_unknown_event_404(client, project):
    admin = project["admin"]
    assert client.get("/calendar/events/999999", headers=admin).status_code == 404
    assert client.patch("/calendar/events/999999", json={"title": "x"}, headers=admin).status_code == 404
    assert client.delete("/calendar/events/999999", headers=admin).status_code == 404


def test_custom_event_validation(client, project):
    admin, pid = project["admin"], project["id"]
    assert _event(client, admin, pid, title="").status_code == 422
    assert _event(client, admin, pid, title="   ").status_code == 422
    assert _event(client, admin, pid, title="x" * 201).status_code == 422
    r = client.post(f"/projects/{pid}/calendar/events", json={"title": "No when"}, headers=admin)
    assert r.status_code == 422
    assert _event(client, admin, pid, starts_at="whenever").status_code == 422


def test_end_before_start_rejected(client, project):
    admin, pid = project["admin"], project["id"]
    assert _event(client, admin, pid,
                  starts_at=instant(3), ends_at=instant(1)).status_code == 422

    # And on a partial patch, checked against the stored start.
    event = _event_ok(client, admin, pid, starts_at=instant(3), ends_at=instant(4))
    assert client.patch(f"/calendar/events/{event['id']}",
                        json={"ends_at": instant(1)}, headers=admin).status_code == 422


def test_offset_aware_input_is_converted_not_truncated(client, project):
    """A client may send any offset; the stored instant must still be right."""
    event = _event_ok(client, project["admin"], project["id"],
                      starts_at="2030-06-01T09:00:00+05:30")
    assert event["starts_at"].startswith("2030-06-01T03:30:00")


# ---------- custom event permissions ----------


def test_any_member_can_create_a_custom_event(client, project):
    assert _event(client, project["dev"], project["id"]).status_code == 201


def test_only_the_creator_can_edit(client, project):
    event = _event_ok(client, project["dev"], project["id"])
    assert client.patch(f"/calendar/events/{event['id']}",
                        json={"title": "no"}, headers=project["admin"]).status_code == 403


def test_creator_can_delete_their_own(client, project):
    event = _event_ok(client, project["dev"], project["id"])
    assert client.delete(f"/calendar/events/{event['id']}", headers=project["dev"]).status_code == 204


def test_admin_can_delete_any_custom_event(client, project):
    event = _event_ok(client, project["dev"], project["id"])
    assert client.delete(f"/calendar/events/{event['id']}", headers=project["admin"]).status_code == 204


def test_member_cannot_delete_another_members_event(client, project):
    admin, pid = project["admin"], project["id"]
    _make_user(client, "qa@test.dev", "QA")
    _add_member(client, admin, pid, "qa@test.dev")
    qa = _make_user(client, "qa@test.dev", "QA")

    event = _event_ok(client, project["dev"], pid)
    assert client.delete(f"/calendar/events/{event['id']}", headers=qa).status_code == 403


# ---------- authorization ----------


def test_non_member_gets_404_everywhere(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    pid = project["id"]
    event = _event_ok(client, project["admin"], pid)

    assert client.get(f"/projects/{pid}/calendar", headers=outsider).status_code == 404
    assert client.get(f"/projects/{pid}/calendar/events", headers=outsider).status_code == 404
    assert _event(client, outsider, pid).status_code == 404
    assert client.get(f"/calendar/events/{event['id']}", headers=outsider).status_code == 404
    assert client.patch(f"/calendar/events/{event['id']}",
                        json={"title": "x"}, headers=outsider).status_code == 404
    assert client.delete(f"/calendar/events/{event['id']}", headers=outsider).status_code == 404


# ---------- archived project ----------


def test_archived_project_calendar_is_read_only(client, project):
    admin, pid = project["admin"], project["id"]
    event = _event_ok(client, admin, pid)
    client.patch(f"/projects/{pid}", json={"archived": True}, headers=admin)

    assert client.get(f"/projects/{pid}/calendar", headers=admin).status_code == 200
    assert client.get(f"/calendar/events/{event['id']}", headers=admin).status_code == 200

    assert _event(client, admin, pid).status_code == 403
    assert client.patch(f"/calendar/events/{event['id']}",
                        json={"title": "x"}, headers=admin).status_code == 403
    assert client.delete(f"/calendar/events/{event['id']}", headers=admin).status_code == 403


def test_calendar_resumes_after_restore(client, project):
    admin, pid = project["admin"], project["id"]
    client.patch(f"/projects/{pid}", json={"archived": True}, headers=admin)
    client.patch(f"/projects/{pid}", json={"archived": False}, headers=admin)
    assert _event(client, admin, pid).status_code == 201


# ---------- existing features unaffected ----------


def test_test_case_deadline_is_optional_and_defaults_to_none(client, project):
    case = _case(client, project["admin"], project["id"], "No date")
    assert case["deadline"] is None


def test_calendar_does_not_disturb_its_sources(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Ship", day(0))
    sprint = _sprint(client, admin, pid, "S", start=day(0), end=day(3))
    meeting = _meeting(client, admin, pid, at=instant(0))
    before_activities = client.get(f"/issues/{issue['id']}/activities", headers=admin).json()

    _calendar(client, admin, pid)

    assert client.get(f"/issues/{issue['id']}", headers=admin).json() == issue
    assert client.get(f"/sprints/{sprint['id']}", headers=admin).json() == sprint
    assert client.get(f"/meetings/{meeting['id']}", headers=admin).json() == meeting
    # Reading the calendar is a read: nothing is logged against the issue.
    assert client.get(f"/issues/{issue['id']}/activities", headers=admin).json() == before_activities
    assert client.get(f"/projects/{pid}/board", headers=admin).status_code == 200
    assert client.get(f"/projects/{pid}/notes", headers=admin).status_code == 200
