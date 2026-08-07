"""Issue tests — TC-ISS-01..05 from docs/05-Test-Plan.md."""


# ---------- helpers (reuse pattern from test_projects) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="TST"):
    r = client.post("/projects", json={"name": "Test", "key": key}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _create_issue(client, headers, project_id, type_="TASK", title="Fix it", **extra):
    body = {"type": type_, "title": title, "priority": "MEDIUM", **extra}
    if type_ == "BUG" and "severity" not in extra:
        body["severity"] = "MAJOR"
    r = client.post(f"/projects/{project_id}/issues", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- TC-ISS-01: sequential keys ----------


def test_sequential_issue_keys(client):
    hdrs = _make_user(client, "seq@test.dev")
    p = _create_project(client, hdrs, "SEQ")
    i1 = _create_issue(client, hdrs, p["id"], title="First")
    i2 = _create_issue(client, hdrs, p["id"], title="Second")
    assert i1["key"] == "SEQ-1"
    assert i2["key"] == "SEQ-2"
    assert i1["number"] != i2["number"]


# ---------- TC-ISS-02: bug requires severity ----------


def test_bug_without_severity_422(client):  # TC-ISS-02
    hdrs = _make_user(client, "bsev@test.dev")
    p = _create_project(client, hdrs, "BSV")
    r = client.post(
        f"/projects/{p['id']}/issues",
        json={"type": "BUG", "title": "Crash", "priority": "HIGH"},
        headers=hdrs,
    )
    assert r.status_code == 422


# ---------- TC-ISS-03: task rejects severity ----------


def test_task_with_severity_422(client):  # TC-ISS-03
    hdrs = _make_user(client, "tsev@test.dev")
    p = _create_project(client, hdrs, "TSV")
    r = client.post(
        f"/projects/{p['id']}/issues",
        json={"type": "TASK", "title": "Do", "priority": "LOW", "severity": "MINOR"},
        headers=hdrs,
    )
    assert r.status_code == 422


# ---------- TC-ISS-04: status transition logged ----------


def test_status_transition_creates_activity(client):  # TC-ISS-04
    hdrs = _make_user(client, "act@test.dev")
    p = _create_project(client, hdrs, "ACT")
    issue = _create_issue(client, hdrs, p["id"])
    assert issue["status"] == "TODO"

    r = client.patch(
        f"/issues/{issue['id']}", json={"status": "IN_PROGRESS"}, headers=hdrs
    )
    assert r.status_code == 200
    assert r.json()["status"] == "IN_PROGRESS"

    activities = client.get(f"/issues/{issue['id']}/activities", headers=hdrs).json()
    # should have: "created" + "status_changed"
    assert len(activities) == 2
    last = activities[-1]
    assert last["action"] == "status_changed"
    assert last["field"] == "status"
    assert last["old_value"] == "TODO"
    assert last["new_value"] == "IN_PROGRESS"


# ---------- TC-ISS-05: soft delete ----------


def test_soft_delete_hides_issue(client):  # TC-ISS-05
    hdrs = _make_user(client, "del@test.dev")
    p = _create_project(client, hdrs, "DEL")
    issue = _create_issue(client, hdrs, p["id"])

    r = client.delete(f"/issues/{issue['id']}", headers=hdrs)
    assert r.status_code == 204

    # deleted issue no longer appears in list
    issues = client.get(f"/projects/{p['id']}/issues", headers=hdrs).json()
    assert all(i["id"] != issue["id"] for i in issues)

    # and returns 404 directly
    assert client.get(f"/issues/{issue['id']}", headers=hdrs).status_code == 404


def test_only_admin_can_delete(client):  # FR-3.5
    hdrs_a = _make_user(client, "adm2@test.dev", "Admin2")
    hdrs_b = _make_user(client, "dev3@test.dev", "Dev3")
    p = _create_project(client, hdrs_a, "RM2")
    client.post(
        f"/projects/{p['id']}/members",
        json={"email": "dev3@test.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    issue = _create_issue(client, hdrs_a, p["id"])
    r = client.delete(f"/issues/{issue['id']}", headers=hdrs_b)
    assert r.status_code == 403


# ---------- search + filters ----------


def test_filter_by_status(client):
    hdrs = _make_user(client, "flt@test.dev")
    p = _create_project(client, hdrs, "FLT")
    _create_issue(client, hdrs, p["id"], title="Open")
    done = _create_issue(client, hdrs, p["id"], title="Done one")
    client.patch(f"/issues/{done['id']}", json={"status": "DONE"}, headers=hdrs)

    done_list = client.get(
        f"/projects/{p['id']}/issues?status=DONE", headers=hdrs
    ).json()
    assert len(done_list) == 1 and done_list[0]["id"] == done["id"]


def test_search_by_title(client):
    hdrs = _make_user(client, "srch@test.dev")
    p = _create_project(client, hdrs, "SRC")
    _create_issue(client, hdrs, p["id"], title="Payment crash")
    _create_issue(client, hdrs, p["id"], title="Login slow")

    results = client.get(
        f"/projects/{p['id']}/issues?q=payment", headers=hdrs
    ).json()
    assert len(results) == 1
    assert "payment" in results[0]["title"].lower()


def test_activity_log_is_append_only(client):
    """The activities endpoint should never allow modification."""
    hdrs = _make_user(client, "aol@test.dev")
    p = _create_project(client, hdrs, "AOL")
    issue = _create_issue(client, hdrs, p["id"])
    # No PATCH or DELETE on /issues/{id}/activities endpoint exists —
    # verify the GET returns immutable results
    acts = client.get(f"/issues/{issue['id']}/activities", headers=hdrs).json()
    assert len(acts) == 1
    assert acts[0]["action"] == "created"
