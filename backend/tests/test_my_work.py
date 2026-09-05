"""My Work tests (Sprint 6).

My Work owns no data, so most of these check that it reflects the sources
faithfully — and that it can only ever show the caller their own work.
"""

from datetime import date, datetime, timedelta, timezone

import pytest


TODAY = date.today()


def day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def instant(offset_days: int, hour: int = 10) -> str:
    at = datetime.combine(TODAY + timedelta(days=offset_days), datetime.min.time())
    return at.replace(hour=hour, tzinfo=timezone.utc).isoformat()


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


def _issue(client, headers, pid, title="An issue", **fields):
    payload = {"type": "TASK", "title": title, **fields}
    r = client.post(f"/projects/{pid}/issues", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _case(client, headers, pid, title="A case", **fields):
    r = client.post(f"/projects/{pid}/test-cases", json={"title": title, **fields}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _sprint(client, headers, pid, name="Sprint 1", **fields):
    r = client.post(f"/projects/{pid}/sprints", json={"name": name, **fields}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _link(client, headers, issue_id, other_id, direction="BLOCKED_BY"):
    r = client.post(
        f"/issues/{issue_id}/dependencies",
        json={"issue_id": other_id, "direction": direction},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _my_work(client, headers, pid):
    r = client.get(f"/projects/{pid}/my-work", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _items(payload, type_=None):
    return [i for i in payload["items"] if type_ is None or i["type"] == type_]


def _find(payload, source_id, type_="ISSUE"):
    return next(i for i in payload["items"] if i["type"] == type_ and i["source_id"] == source_id)


@pytest.fixture()
def project(client):
    """An admin and a developer, both members of one project."""
    admin = _make_user(client, "admin@test.dev", "Admin")
    proj = _create_project(client, admin, key="DEV")
    _make_user(client, "dev@test.dev", "Dev")
    dev_member = _add_member(client, admin, proj["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")
    admin_id = client.get("/auth/me", headers=admin).json()["id"]
    return {
        "admin": admin, "dev": dev, "id": proj["id"],
        "admin_id": admin_id, "dev_id": dev_member["user_id"],
    }


# ---------- shape + empty state ----------


def test_empty_my_work(client, project):
    payload = _my_work(client, project["admin"], project["id"])
    assert payload == {"items": [], "sprint": None, "upcoming_meetings": []}


def test_response_shape(client, project):
    payload = _my_work(client, project["admin"], project["id"])
    assert set(payload) == {"items", "sprint", "upcoming_meetings"}


# ---------- assigned issues ----------


def test_assigned_issue_appears_with_its_context(client, project):
    admin, pid = project["admin"], project["id"]
    sprint = _sprint(client, admin, pid, "Sprint 4")
    issue = _issue(client, admin, pid, "Ship payments", assignee_id=project["admin_id"],
                   priority="HIGH", deadline=day(3), sprint_id=sprint["id"])

    item = _find(_my_work(client, admin, pid), issue["id"])
    assert item["id"] == f"issue:{issue['id']}"
    assert item["type"] == "ISSUE"
    assert item["title"] == "Ship payments"
    assert item["reference"] == issue["key"]
    assert item["status"] == "TODO"
    assert item["priority"] == "HIGH"
    assert item["issue_type"] == "TASK"
    assert item["due_date"] == day(3)
    assert item["sprint_id"] == sprint["id"]
    assert item["sprint_name"] == "Sprint 4"
    assert item["overdue"] is False
    assert item["blocked"] is False
    assert item["blocked_by"] == []


def test_unassigned_issues_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Nobody's")
    assert _my_work(client, admin, pid)["items"] == []


def test_another_persons_issues_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Dev's work", assignee_id=project["dev_id"])
    assert _items(_my_work(client, admin, pid), "ISSUE") == []
    assert len(_items(_my_work(client, project["dev"], pid), "ISSUE")) == 1


def test_deleted_issues_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Doomed", assignee_id=project["admin_id"])
    assert client.delete(f"/issues/{issue['id']}", headers=admin).status_code == 204
    assert _my_work(client, admin, pid)["items"] == []


def test_reassigning_moves_the_item_between_people(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Handover", assignee_id=project["admin_id"])
    assert len(_items(_my_work(client, admin, pid), "ISSUE")) == 1

    client.patch(f"/issues/{issue['id']}", json={"assignee_id": project["dev_id"]}, headers=admin)

    assert _items(_my_work(client, admin, pid), "ISSUE") == []
    assert len(_items(_my_work(client, project["dev"], pid), "ISSUE")) == 1


def test_my_work_is_scoped_to_its_project(client, project):
    admin, pid = project["admin"], project["id"]
    other = _create_project(client, admin, key="OTH")
    _issue(client, admin, pid, "Here", assignee_id=project["admin_id"])

    assert _my_work(client, admin, other["id"])["items"] == []


def test_no_source_record_is_duplicated(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Once", assignee_id=project["admin_id"], deadline=day(-1))
    _link(client, admin, issue["id"], _issue(client, admin, pid, "Blocker")["id"])

    # Overdue and blocked at once: still exactly one row.
    items = _items(_my_work(client, admin, pid), "ISSUE")
    assert [i["source_id"] for i in items] == [issue["id"]]


# ---------- test cases ----------


def test_my_test_cases_appear(client, project):
    """TestCase has no assignee column, so authorship is what "mine" means."""
    admin, pid = project["admin"], project["id"]
    case = _case(client, admin, pid, "Regression pass", deadline=day(2))

    item = _find(_my_work(client, admin, pid), case["id"], "TEST_CASE")
    assert item["id"] == f"test_case:{case['id']}"
    assert item["title"] == "Regression pass"
    assert item["due_date"] == day(2)
    assert item["reference"] is None       # test cases have no key
    assert item["status"] is None          # nor a status of their own
    assert item["last_result"] is None     # never run


def test_another_persons_test_cases_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    _case(client, project["dev"], pid, "Dev's case")
    assert _items(_my_work(client, admin, pid), "TEST_CASE") == []
    assert len(_items(_my_work(client, project["dev"], pid), "TEST_CASE")) == 1


def test_last_run_result_is_included(client, project):
    admin, pid = project["admin"], project["id"]
    case = _case(client, admin, pid, "Login check")
    client.post(f"/test-cases/{case['id']}/runs", json={"result": "FAIL"}, headers=admin)
    client.post(f"/test-cases/{case['id']}/runs", json={"result": "PASS"}, headers=admin)

    item = _find(_my_work(client, admin, pid), case["id"], "TEST_CASE")
    assert item["last_result"] == "PASS"   # the most recent, not the first
    assert item["last_run_at"] is not None


# ---------- overdue ----------


def test_overdue_issue_is_flagged(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Late", assignee_id=project["admin_id"], deadline=day(-2))
    assert _find(_my_work(client, admin, pid), issue["id"])["overdue"] is True


def test_due_today_is_not_overdue(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Due now", assignee_id=project["admin_id"], deadline=day(0))
    assert _find(_my_work(client, admin, pid), issue["id"])["overdue"] is False


def test_undated_work_is_never_overdue(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "No date", assignee_id=project["admin_id"])
    assert _find(_my_work(client, admin, pid), issue["id"])["overdue"] is False


def test_completed_work_is_not_overdue(client, project):
    """However long ago it was due, finished work is not outstanding."""
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Late but done",
                   assignee_id=project["admin_id"], deadline=day(-30))
    client.patch(f"/issues/{issue['id']}", json={"status": "DONE"}, headers=admin)

    item = _find(_my_work(client, admin, pid), issue["id"])
    assert item["status"] == "DONE"
    assert item["overdue"] is False


def test_overdue_test_case_is_flagged(client, project):
    admin, pid = project["admin"], project["id"]
    case = _case(client, admin, pid, "Stale", deadline=day(-1))
    assert _find(_my_work(client, admin, pid), case["id"], "TEST_CASE")["overdue"] is True


# ---------- blocked ----------


def test_blocked_issue_names_its_blocker(client, project):
    admin, pid = project["admin"], project["id"]
    blocker = _issue(client, admin, pid, "Fix auth")
    mine = _issue(client, admin, pid, "Ship", assignee_id=project["admin_id"])
    _link(client, admin, mine["id"], blocker["id"], "BLOCKED_BY")

    item = _find(_my_work(client, admin, pid), mine["id"])
    assert item["blocked"] is True
    assert [b["id"] for b in item["blocked_by"]] == [blocker["id"]]
    assert item["blocked_by"][0]["key"] == blocker["key"]
    assert item["blocked_by"][0]["title"] == "Fix auth"
    assert item["blocked_by"][0]["status"] == "TODO"
    assert set(item["blocked_by"][0]) == {"id", "key", "title", "status"}


def test_a_finished_blocker_no_longer_blocks(client, project):
    admin, pid = project["admin"], project["id"]
    blocker = _issue(client, admin, pid, "Fix auth")
    mine = _issue(client, admin, pid, "Ship", assignee_id=project["admin_id"])
    _link(client, admin, mine["id"], blocker["id"], "BLOCKED_BY")
    assert _find(_my_work(client, admin, pid), mine["id"])["blocked"] is True

    client.patch(f"/issues/{blocker['id']}", json={"status": "DONE"}, headers=admin)

    item = _find(_my_work(client, admin, pid), mine["id"])
    assert item["blocked"] is False
    assert item["blocked_by"] == []


def test_several_blockers_are_all_listed(client, project):
    admin, pid = project["admin"], project["id"]
    mine = _issue(client, admin, pid, "Ship", assignee_id=project["admin_id"])
    a = _issue(client, admin, pid, "A")
    b = _issue(client, admin, pid, "B")
    _link(client, admin, mine["id"], a["id"], "BLOCKED_BY")
    _link(client, admin, mine["id"], b["id"], "BLOCKED_BY")

    item = _find(_my_work(client, admin, pid), mine["id"])
    assert {x["id"] for x in item["blocked_by"]} == {a["id"], b["id"]}


def test_blocking_others_does_not_make_me_blocked(client, project):
    """Being the blocker is not the same as being blocked."""
    admin, pid = project["admin"], project["id"]
    mine = _issue(client, admin, pid, "Fix auth", assignee_id=project["admin_id"])
    _link(client, admin, mine["id"], _issue(client, admin, pid, "Waiting")["id"], "BLOCKS")

    assert _find(_my_work(client, admin, pid), mine["id"])["blocked"] is False


def test_a_done_issue_is_not_reported_blocked(client, project):
    admin, pid = project["admin"], project["id"]
    mine = _issue(client, admin, pid, "Ship", assignee_id=project["admin_id"])
    _link(client, admin, mine["id"], _issue(client, admin, pid, "Blocker")["id"], "BLOCKED_BY")
    client.patch(f"/issues/{mine['id']}", json={"status": "DONE"}, headers=admin)

    item = _find(_my_work(client, admin, pid), mine["id"])
    assert item["blocked"] is False
    assert item["blocked_by"] == []


def test_another_persons_blocked_issue_is_not_mine(client, project):
    admin, pid = project["admin"], project["id"]
    theirs = _issue(client, admin, pid, "Dev's", assignee_id=project["dev_id"])
    _link(client, admin, theirs["id"], _issue(client, admin, pid, "Blocker")["id"], "BLOCKED_BY")

    assert _items(_my_work(client, admin, pid), "ISSUE") == []


# ---------- ordering ----------


def test_actionable_work_sorts_first(client, project):
    admin, pid = project["admin"], project["id"]
    me = project["admin_id"]

    done = _issue(client, admin, pid, "Done", assignee_id=me)
    client.patch(f"/issues/{done['id']}", json={"status": "DONE"}, headers=admin)
    _issue(client, admin, pid, "Todo", assignee_id=me)
    progress = _issue(client, admin, pid, "Doing", assignee_id=me)
    client.patch(f"/issues/{progress['id']}", json={"status": "IN_PROGRESS"}, headers=admin)
    testing = _issue(client, admin, pid, "Testing", assignee_id=me)
    client.patch(f"/issues/{testing['id']}", json={"status": "TESTING"}, headers=admin)
    blocked = _issue(client, admin, pid, "Blocked", assignee_id=me)
    _link(client, admin, blocked["id"], _issue(client, admin, pid, "Blocker")["id"], "BLOCKED_BY")
    _issue(client, admin, pid, "Overdue", assignee_id=me, deadline=day(-1))

    order = [i["title"] for i in _my_work(client, admin, pid)["items"]]
    assert order == ["Overdue", "Blocked", "Doing", "Testing", "Todo", "Done"]


def test_soonest_due_date_first_within_a_band(client, project):
    admin, pid = project["admin"], project["id"]
    me = project["admin_id"]
    _issue(client, admin, pid, "Later", assignee_id=me, deadline=day(9))
    _issue(client, admin, pid, "Sooner", assignee_id=me, deadline=day(2))
    _issue(client, admin, pid, "Undated", assignee_id=me)

    assert [i["title"] for i in _my_work(client, admin, pid)["items"]] == [
        "Sooner", "Later", "Undated",
    ]


# ---------- sprint context ----------


def test_no_active_sprint_gives_no_context(client, project):
    admin, pid = project["admin"], project["id"]
    _sprint(client, admin, pid, "Planned only")
    assert _my_work(client, admin, pid)["sprint"] is None


def test_active_sprint_counts_only_my_issues(client, project):
    admin, pid = project["admin"], project["id"]
    sprint = _sprint(client, admin, pid, "Sprint 4", start_date=day(-1), end_date=day(9))
    client.post(f"/sprints/{sprint['id']}/start", headers=admin)

    mine = _issue(client, admin, pid, "Mine", assignee_id=project["admin_id"],
                  sprint_id=sprint["id"])
    done = _issue(client, admin, pid, "Mine done", assignee_id=project["admin_id"],
                  sprint_id=sprint["id"])
    client.patch(f"/issues/{done['id']}", json={"status": "DONE"}, headers=admin)
    # Someone else's, and one outside the sprint — neither should be counted.
    _issue(client, admin, pid, "Theirs", assignee_id=project["dev_id"], sprint_id=sprint["id"])
    _issue(client, admin, pid, "Backlog", assignee_id=project["admin_id"])

    context = _my_work(client, admin, pid)["sprint"]
    assert context["id"] == sprint["id"]
    assert context["name"] == "Sprint 4"
    assert context["state"] == "ACTIVE"
    assert context["start_date"] == day(-1)
    assert context["end_date"] == day(9)
    assert context["assigned_count"] == 2
    assert context["assigned_done"] == 1
    assert set(context) == {
        "id", "name", "start_date", "end_date", "state", "assigned_count", "assigned_done",
    }
    assert mine["id"] in [i["source_id"] for i in _my_work(client, admin, pid)["items"]]


# ---------- upcoming meetings ----------


def test_my_upcoming_meetings_appear(client, project):
    admin, pid = project["admin"], project["id"]
    r = client.post(f"/projects/{pid}/meetings",
                    json={"title": "Planning", "scheduled_at": instant(1), "duration_minutes": 30},
                    headers=admin)
    meeting = r.json()

    payload = _my_work(client, admin, pid)
    assert [m["id"] for m in payload["upcoming_meetings"]] == [meeting["id"]]
    assert payload["upcoming_meetings"][0]["title"] == "Planning"
    assert payload["upcoming_meetings"][0]["duration_minutes"] == 30
    assert set(payload["upcoming_meetings"][0]) == {
        "id", "title", "scheduled_at", "duration_minutes",
    }


def test_meetings_i_am_listed_on_appear(client, project):
    admin, pid = project["admin"], project["id"]
    client.post(f"/projects/{pid}/meetings",
                json={"title": "Invited", "scheduled_at": instant(1),
                      "participant_ids": [project["dev_id"]]},
                headers=admin)

    assert [m["title"] for m in _my_work(client, project["dev"], pid)["upcoming_meetings"]] == [
        "Invited"
    ]


def test_meetings_i_have_nothing_to_do_with_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    client.post(f"/projects/{pid}/meetings",
                json={"title": "Not mine", "scheduled_at": instant(1)}, headers=admin)
    assert _my_work(client, project["dev"], pid)["upcoming_meetings"] == []


def test_past_meetings_are_absent(client, project):
    admin, pid = project["admin"], project["id"]
    client.post(f"/projects/{pid}/meetings",
                json={"title": "Yesterday", "scheduled_at": instant(-1)}, headers=admin)
    assert _my_work(client, admin, pid)["upcoming_meetings"] == []


def test_upcoming_meetings_are_capped_and_soonest_first(client, project):
    admin, pid = project["admin"], project["id"]
    for i in range(8):
        client.post(f"/projects/{pid}/meetings",
                    json={"title": f"M{i}", "scheduled_at": instant(8 - i)}, headers=admin)

    meetings = _my_work(client, admin, pid)["upcoming_meetings"]
    assert len(meetings) == 5                       # the page is not a meetings page
    assert [m["title"] for m in meetings] == ["M7", "M6", "M5", "M4", "M3"]


def test_a_meeting_is_listed_once_even_if_i_organize_and_attend(client, project):
    admin, pid = project["admin"], project["id"]
    client.post(f"/projects/{pid}/meetings",
                json={"title": "Both", "scheduled_at": instant(1),
                      "participant_ids": [project["admin_id"]]},
                headers=admin)
    assert len(_my_work(client, admin, pid)["upcoming_meetings"]) == 1


# ---------- authorization + user isolation ----------


def test_non_member_gets_404(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    assert client.get(f"/projects/{project['id']}/my-work", headers=outsider).status_code == 404


def test_unknown_project_404(client, project):
    assert client.get("/projects/999999/my-work", headers=project["admin"]).status_code == 404


def test_the_endpoint_takes_no_user_parameter(client, project):
    """There is no way to ask for someone else's work: a user_id in the query
    string is simply ignored, and the caller's own work comes back."""
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Mine", assignee_id=project["admin_id"])
    _issue(client, admin, pid, "Theirs", assignee_id=project["dev_id"])

    spoofed = client.get(
        f"/projects/{pid}/my-work?user_id={project['dev_id']}", headers=admin
    )
    assert spoofed.status_code == 200
    assert [i["title"] for i in spoofed.json()["items"]] == ["Mine"]


def test_two_members_see_different_work(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Admin's", assignee_id=project["admin_id"])
    _issue(client, admin, pid, "Dev's", assignee_id=project["dev_id"])

    assert [i["title"] for i in _my_work(client, admin, pid)["items"]] == ["Admin's"]
    assert [i["title"] for i in _my_work(client, project["dev"], pid)["items"]] == ["Dev's"]


def test_archived_project_my_work_stays_readable(client, project):
    admin, pid = project["admin"], project["id"]
    _issue(client, admin, pid, "Still mine", assignee_id=project["admin_id"], deadline=day(-1))
    client.patch(f"/projects/{pid}", json={"archived": True}, headers=admin)

    payload = _my_work(client, admin, pid)
    assert [i["title"] for i in payload["items"]] == ["Still mine"]
    assert payload["items"][0]["overdue"] is True


def test_my_work_is_read_only(client, project):
    """No write verb exists on the endpoint."""
    pid = project["id"]
    for call in (client.post, client.patch, client.put, client.delete):
        assert call(f"/projects/{pid}/my-work", headers=project["admin"]).status_code == 405


# ---------- aggregation behaviour ----------


def test_a_full_page_is_a_fixed_number_of_queries(client, project, db_session):
    """The point of the endpoint: adding work must not add requests.

    Ten assigned issues with blockers, and ten test cases with runs, must cost
    the same number of SQL statements as one of each.
    """
    from sqlalchemy import event

    admin, pid = project["admin"], project["id"]
    me = project["admin_id"]

    def build(n):
        for i in range(n):
            issue = _issue(client, admin, pid, f"I{i}", assignee_id=me, deadline=day(i))
            blocker = _issue(client, admin, pid, f"B{i}")
            _link(client, admin, issue["id"], blocker["id"], "BLOCKED_BY")
            case = _case(client, admin, pid, f"C{i}", deadline=day(i))
            client.post(f"/test-cases/{case['id']}/runs", json={"result": "PASS"}, headers=admin)

    def count_queries():
        seen = []
        engine = db_session.get_bind()

        def before(conn, cursor, statement, *args):
            seen.append(statement)

        event.listen(engine, "before_cursor_execute", before)
        try:
            _my_work(client, admin, pid)
        finally:
            event.remove(engine, "before_cursor_execute", before)
        return len(seen)

    build(1)
    small = count_queries()
    build(9)
    large = count_queries()

    assert len(_items(_my_work(client, admin, pid), "ISSUE")) == 10
    assert len(_items(_my_work(client, admin, pid), "TEST_CASE")) == 10
    assert large == small, f"query count grew with the data: {small} -> {large}"


# ---------- existing features unaffected ----------


def test_my_work_does_not_disturb_its_sources(client, project):
    admin, pid = project["admin"], project["id"]
    issue = _issue(client, admin, pid, "Ship", assignee_id=project["admin_id"], deadline=day(1))
    case = _case(client, admin, pid, "Case", deadline=day(1))
    before_activities = client.get(f"/issues/{issue['id']}/activities", headers=admin).json()

    _my_work(client, admin, pid)

    assert client.get(f"/issues/{issue['id']}", headers=admin).json() == issue
    assert client.get(f"/test-cases/{case['id']}", headers=admin).json() == case
    # Reading My Work is a read: nothing is logged against the issue.
    assert client.get(f"/issues/{issue['id']}/activities", headers=admin).json() == before_activities
    for path in ("issues", "board", "sprints", "test-cases", "notes", "meetings",
                 "calendar", "dependencies", "members", "chat"):
        assert client.get(f"/projects/{pid}/{path}", headers=admin).status_code == 200
