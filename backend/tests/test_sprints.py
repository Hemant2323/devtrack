"""Sprint and backlog tests — FR-5.1..5.4, plus backlog filtering (FR-5.2)."""


# ---------- helpers (same pattern as test_issues / test_projects) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="TST"):
    r = client.post("/projects", json={"name": "Test", "key": key}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _create_sprint(client, headers, project_id, name="Sprint 1", **extra):
    r = client.post(
        f"/projects/{project_id}/sprints", json={"name": name, **extra}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_issue(client, headers, project_id, **extra):
    body = {"type": "TASK", "title": "Fix it", "priority": "MEDIUM", **extra}
    r = client.post(f"/projects/{project_id}/issues", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- FR-5.1: creation ----------


def test_create_sprint_defaults_to_planned(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(
        client, headers, project["id"], goal="Ship checkout",
        start_date="2026-09-01", end_date="2026-09-14",
    )
    assert sprint["state"] == "PLANNED"
    assert sprint["project_id"] == project["id"]
    assert sprint["goal"] == "Ship checkout"
    assert sprint["start_date"] == "2026-09-01"


def test_create_sprint_requires_name(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(f"/projects/{project['id']}/sprints", json={"name": ""}, headers=headers)
    assert r.status_code == 422


def test_end_date_before_start_date_422(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(
        f"/projects/{project['id']}/sprints",
        json={"name": "Bad", "start_date": "2026-09-10", "end_date": "2026-09-01"},
        headers=headers,
    )
    assert r.status_code == 422


def test_only_admin_can_create_sprint(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "dev@test.dev", "role": "DEVELOPER"},
        headers=admin,
    )
    r = client.post(f"/projects/{project['id']}/sprints", json={"name": "S"}, headers=dev)
    assert r.status_code == 403


def test_non_member_cannot_see_or_create_sprints(client):
    owner = _make_user(client, "owner@test.dev", "Owner")
    outsider = _make_user(client, "out@test.dev", "Out")
    project = _create_project(client, owner)
    # Existence hiding: 404, not 403.
    assert client.get(f"/projects/{project['id']}/sprints", headers=outsider).status_code == 404
    assert client.post(
        f"/projects/{project['id']}/sprints", json={"name": "S"}, headers=outsider
    ).status_code == 404


def test_sprint_creation_blocked_on_archived_project(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=headers)
    r = client.post(f"/projects/{project['id']}/sprints", json={"name": "S"}, headers=headers)
    assert r.status_code == 403


# ---------- listing / retrieval ----------


def test_list_and_get_sprints(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    _create_sprint(client, headers, project["id"], name="Sprint 1")
    second = _create_sprint(client, headers, project["id"], name="Sprint 2")

    listed = client.get(f"/projects/{project['id']}/sprints", headers=headers).json()
    assert [s["name"] for s in listed] == ["Sprint 2", "Sprint 1"]  # newest first

    got = client.get(f"/sprints/{second['id']}", headers=headers)
    assert got.status_code == 200
    assert got.json()["name"] == "Sprint 2"


def test_get_unknown_sprint_404(client):
    headers = _make_user(client)
    assert client.get("/sprints/999999", headers=headers).status_code == 404


def test_sprint_of_other_project_hidden(client):
    owner = _make_user(client, "owner@test.dev", "Owner")
    outsider = _make_user(client, "out@test.dev", "Out")
    project = _create_project(client, owner)
    sprint = _create_sprint(client, owner, project["id"])
    assert client.get(f"/sprints/{sprint['id']}", headers=outsider).status_code == 404


# ---------- update ----------


def test_update_sprint_fields(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    r = client.patch(
        f"/sprints/{sprint['id']}", json={"name": "Renamed", "goal": "New goal"}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"
    assert r.json()["goal"] == "New goal"


def test_patch_cannot_produce_inverted_dates(client):
    """A partial patch must be validated against the stored value too."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"], start_date="2026-09-10")
    r = client.patch(f"/sprints/{sprint['id']}", json={"end_date": "2026-09-01"}, headers=headers)
    assert r.status_code == 422


# ---------- FR-5.3: one active sprint per project ----------


def test_start_sprint_activates_it(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    r = client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    assert r.status_code == 200
    assert r.json()["state"] == "ACTIVE"


def test_only_one_active_sprint_per_project(client):  # FR-5.3
    headers = _make_user(client)
    project = _create_project(client, headers)
    first = _create_sprint(client, headers, project["id"], name="Sprint 1")
    second = _create_sprint(client, headers, project["id"], name="Sprint 2")

    assert client.post(f"/sprints/{first['id']}/start", headers=headers).status_code == 200
    r = client.post(f"/sprints/{second['id']}/start", headers=headers)
    assert r.status_code == 409
    assert "Sprint 1" in r.json()["detail"]


def test_other_project_active_sprint_does_not_block(client):
    """The rule is per project, not global."""
    headers = _make_user(client)
    a = _create_project(client, headers, key="AAA")
    b = _create_project(client, headers, key="BBB")
    sprint_a = _create_sprint(client, headers, a["id"])
    sprint_b = _create_sprint(client, headers, b["id"])
    assert client.post(f"/sprints/{sprint_a['id']}/start", headers=headers).status_code == 200
    assert client.post(f"/sprints/{sprint_b['id']}/start", headers=headers).status_code == 200


def test_restarting_an_active_sprint_409(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    assert client.post(f"/sprints/{sprint['id']}/start", headers=headers).status_code == 409


def test_only_admin_can_start_sprint(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "dev@test.dev", "role": "DEVELOPER"},
        headers=admin,
    )
    sprint = _create_sprint(client, admin, project["id"])
    assert client.post(f"/sprints/{sprint['id']}/start", headers=dev).status_code == 403


# ---------- FR-5.4: completion returns unfinished work to the backlog ----------


def test_complete_sprint_returns_unfinished_to_backlog(client):  # FR-5.4
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)

    done = _create_issue(client, headers, project["id"], title="Done work", sprint_id=sprint["id"])
    open_one = _create_issue(client, headers, project["id"], title="Unfinished", sprint_id=sprint["id"])
    client.patch(f"/issues/{done['id']}", json={"status": "DONE"}, headers=headers)

    r = client.post(f"/sprints/{sprint['id']}/complete", headers=headers)
    assert r.status_code == 200, r.text
    report = r.json()

    assert report["sprint"]["state"] == "COMPLETED"
    assert report["planned"] == 2
    assert report["completed"] == 1
    assert report["returned_to_backlog"] == 1
    assert report["returned_issue_ids"] == [open_one["id"]]

    # The unfinished issue is back in the backlog; the done one stays attached.
    assert client.get(f"/issues/{open_one['id']}", headers=headers).json()["sprint_id"] is None
    assert client.get(f"/issues/{done['id']}", headers=headers).json()["sprint_id"] == sprint["id"]


def test_completion_logs_activity_for_returned_issues(client):
    """FR-6.2/NFR-10: the automatic move must still be traceable."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    issue = _create_issue(client, headers, project["id"], sprint_id=sprint["id"])

    client.post(f"/sprints/{sprint['id']}/complete", headers=headers)

    acts = client.get(f"/issues/{issue['id']}/activities", headers=headers).json()
    moves = [a for a in acts if a["field"] == "sprint_id"]
    assert any(a["old_value"] == str(sprint["id"]) and a["new_value"] is None for a in moves)


def test_cannot_complete_a_planned_sprint(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    assert client.post(f"/sprints/{sprint['id']}/complete", headers=headers).status_code == 409


def test_cannot_complete_twice(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    assert client.post(f"/sprints/{sprint['id']}/complete", headers=headers).status_code == 200
    assert client.post(f"/sprints/{sprint['id']}/complete", headers=headers).status_code == 409


def test_completed_sprint_cannot_be_edited(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    client.post(f"/sprints/{sprint['id']}/complete", headers=headers)
    r = client.patch(f"/sprints/{sprint['id']}", json={"name": "Nope"}, headers=headers)
    assert r.status_code == 409


def test_completing_a_sprint_after_all_work_is_done(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    issue = _create_issue(client, headers, project["id"], sprint_id=sprint["id"])
    client.patch(f"/issues/{issue['id']}", json={"status": "DONE"}, headers=headers)

    report = client.post(f"/sprints/{sprint['id']}/complete", headers=headers).json()
    assert (report["planned"], report["completed"], report["returned_to_backlog"]) == (1, 1, 0)


# ---------- FR-5.2: assignment and removal ----------


def test_assign_and_remove_issue_from_sprint(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    issue = _create_issue(client, headers, project["id"])
    assert issue["sprint_id"] is None  # created straight into the backlog

    r = client.patch(f"/issues/{issue['id']}", json={"sprint_id": sprint["id"]}, headers=headers)
    assert r.status_code == 200
    assert r.json()["sprint_id"] == sprint["id"]

    r = client.patch(f"/issues/{issue['id']}", json={"sprint_id": None}, headers=headers)
    assert r.status_code == 200
    assert r.json()["sprint_id"] is None


def test_cannot_assign_issue_to_another_projects_sprint(client):
    headers = _make_user(client)
    a = _create_project(client, headers, key="AAA")
    b = _create_project(client, headers, key="BBB")
    foreign = _create_sprint(client, headers, b["id"])
    issue = _create_issue(client, headers, a["id"])
    r = client.patch(f"/issues/{issue['id']}", json={"sprint_id": foreign["id"]}, headers=headers)
    assert r.status_code == 404


def test_cannot_assign_issue_to_unknown_sprint(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    issue = _create_issue(client, headers, project["id"])
    r = client.patch(f"/issues/{issue['id']}", json={"sprint_id": 999999}, headers=headers)
    assert r.status_code == 404


def test_cannot_move_issue_into_completed_sprint(client):  # FR-5.2
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    client.post(f"/sprints/{sprint['id']}/complete", headers=headers)

    issue = _create_issue(client, headers, project["id"])
    r = client.patch(f"/issues/{issue['id']}", json={"sprint_id": sprint["id"]}, headers=headers)
    assert r.status_code == 409


def test_create_issue_into_unknown_sprint_404(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(
        f"/projects/{project['id']}/issues",
        json={"type": "TASK", "title": "x", "sprint_id": 999999},
        headers=headers,
    )
    assert r.status_code == 404


# ---------- backlog filtering ----------


def test_backlog_filter_splits_issues(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    in_sprint = _create_issue(client, headers, project["id"], title="In sprint", sprint_id=sprint["id"])
    backlog = _create_issue(client, headers, project["id"], title="Backlog")

    only_backlog = client.get(
        f"/projects/{project['id']}/issues?in_backlog=true", headers=headers
    ).json()
    assert [i["id"] for i in only_backlog] == [backlog["id"]]

    only_sprinted = client.get(
        f"/projects/{project['id']}/issues?in_backlog=false", headers=headers
    ).json()
    assert [i["id"] for i in only_sprinted] == [in_sprint["id"]]

    # Omitting the parameter keeps the existing unfiltered behaviour.
    assert len(client.get(f"/projects/{project['id']}/issues", headers=headers).json()) == 2


def test_sprint_id_filter_still_works_alongside_backlog_filter(client):
    """The pre-existing ?sprint_id capability must not be displaced."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    in_sprint = _create_issue(client, headers, project["id"], sprint_id=sprint["id"])
    _create_issue(client, headers, project["id"], title="Backlog")

    r = client.get(
        f"/projects/{project['id']}/issues?sprint_id={sprint['id']}", headers=headers
    ).json()
    assert [i["id"] for i in r] == [in_sprint["id"]]


def test_backlog_filter_combines_with_status_filter(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    _create_issue(client, headers, project["id"], sprint_id=sprint["id"])
    backlog_done = _create_issue(client, headers, project["id"], title="Backlog done")
    client.patch(f"/issues/{backlog_done['id']}", json={"status": "DONE"}, headers=headers)
    _create_issue(client, headers, project["id"], title="Backlog todo")

    r = client.get(
        f"/projects/{project['id']}/issues?in_backlog=true&status=DONE", headers=headers
    ).json()
    assert [i["id"] for i in r] == [backlog_done["id"]]


def test_completed_sprint_issues_appear_in_backlog_filter(client):
    """After completion the unfinished issue must show up as backlog again."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    client.post(f"/sprints/{sprint['id']}/start", headers=headers)
    issue = _create_issue(client, headers, project["id"], sprint_id=sprint["id"])

    before = client.get(f"/projects/{project['id']}/issues?in_backlog=true", headers=headers).json()
    assert before == []

    client.post(f"/sprints/{sprint['id']}/complete", headers=headers)

    after = client.get(f"/projects/{project['id']}/issues?in_backlog=true", headers=headers).json()
    assert [i["id"] for i in after] == [issue["id"]]


def test_board_sprint_filter_unchanged(client):
    """Sprint 4's board must keep working with ?sprint_id."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    sprint = _create_sprint(client, headers, project["id"])
    in_sprint = _create_issue(client, headers, project["id"], sprint_id=sprint["id"])
    _create_issue(client, headers, project["id"], title="Backlog")

    board = client.get(
        f"/projects/{project['id']}/board?sprint_id={sprint['id']}", headers=headers
    ).json()
    assert [i["id"] for i in board["todo"]] == [in_sprint["id"]]

    full = client.get(f"/projects/{project['id']}/board", headers=headers).json()
    assert len(full["todo"]) == 2
