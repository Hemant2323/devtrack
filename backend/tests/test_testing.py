"""Test-case and test-run tests — FR-9.1, FR-9.2, TC-TCM-01."""


# ---------- helpers (same pattern as test_issues / test_sprints) ----------


def _make_user(client, email="u@test.dev", name="User", password="secret123"):
    client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="TST"):
    r = client.post("/projects", json={"name": "Test", "key": key}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _create_issue(client, headers, project_id, **extra):
    body = {"type": "TASK", "title": "Fix it", "priority": "MEDIUM", **extra}
    r = client.post(f"/projects/{project_id}/issues", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _create_case(client, headers, project_id, title="Checkout applies coupon", **extra):
    body = {
        "title": title,
        "preconditions": "A coupon exists",
        "steps": "1. Add item\n2. Apply coupon",
        "expected_result": "Total is discounted",
        **extra,
    }
    r = client.post(f"/projects/{project_id}/test-cases", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _record_run(client, headers, case_id, result="PASS", notes=""):
    r = client.post(
        f"/test-cases/{case_id}/runs", json={"result": result, "notes": notes}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------- FR-9.1: test case CRUD ----------


def test_create_test_case_with_all_fields(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    assert case["project_id"] == project["id"]
    assert case["title"] == "Checkout applies coupon"
    assert case["preconditions"] == "A coupon exists"
    assert "Apply coupon" in case["steps"]
    assert case["expected_result"] == "Total is discounted"
    assert case["issue_id"] is None  # optional link


def test_create_test_case_linked_to_issue(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    issue = _create_issue(client, headers, project["id"])
    case = _create_case(client, headers, project["id"], issue_id=issue["id"])
    assert case["issue_id"] == issue["id"]


def test_title_is_required(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(f"/projects/{project['id']}/test-cases", json={"title": ""}, headers=headers)
    assert r.status_code == 422


def test_cannot_link_issue_from_another_project(client):
    headers = _make_user(client)
    a = _create_project(client, headers, key="AAA")
    b = _create_project(client, headers, key="BBB")
    foreign = _create_issue(client, headers, b["id"])
    r = client.post(
        f"/projects/{a['id']}/test-cases",
        json={"title": "x", "issue_id": foreign["id"]},
        headers=headers,
    )
    assert r.status_code == 404


def test_cannot_link_unknown_issue(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    r = client.post(
        f"/projects/{project['id']}/test-cases",
        json={"title": "x", "issue_id": 999999},
        headers=headers,
    )
    assert r.status_code == 404


def test_list_and_get_test_cases(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    _create_case(client, headers, project["id"], title="First")
    second = _create_case(client, headers, project["id"], title="Second")

    listed = client.get(f"/projects/{project['id']}/test-cases", headers=headers).json()
    assert [c["title"] for c in listed] == ["Second", "First"]  # newest first

    got = client.get(f"/test-cases/{second['id']}", headers=headers)
    assert got.status_code == 200
    assert got.json()["title"] == "Second"


def test_list_filtered_by_issue(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    issue = _create_issue(client, headers, project["id"])
    linked = _create_case(client, headers, project["id"], title="Linked", issue_id=issue["id"])
    _create_case(client, headers, project["id"], title="Standalone")

    r = client.get(
        f"/projects/{project['id']}/test-cases?issue_id={issue['id']}", headers=headers
    ).json()
    assert [c["id"] for c in r] == [linked["id"]]


def test_update_test_case(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    r = client.patch(
        f"/test-cases/{case['id']}",
        json={"title": "Renamed", "expected_result": "New expectation"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["expected_result"] == "New expectation"


def test_unlink_issue_from_case(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    issue = _create_issue(client, headers, project["id"])
    case = _create_case(client, headers, project["id"], issue_id=issue["id"])
    r = client.patch(f"/test-cases/{case['id']}", json={"issue_id": None}, headers=headers)
    assert r.status_code == 200
    assert r.json()["issue_id"] is None


def test_only_admin_can_delete_test_case(client):
    admin = _make_user(client, "admin@test.dev", "Admin")
    dev = _make_user(client, "dev@test.dev", "Dev")
    project = _create_project(client, admin)
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "dev@test.dev", "role": "DEVELOPER"},
        headers=admin,
    )
    case = _create_case(client, admin, project["id"])
    assert client.delete(f"/test-cases/{case['id']}", headers=dev).status_code == 403
    assert client.delete(f"/test-cases/{case['id']}", headers=admin).status_code == 204
    assert client.get(f"/test-cases/{case['id']}", headers=admin).status_code == 404


def test_deleting_a_case_removes_its_runs(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    _record_run(client, headers, case["id"], "PASS")
    _record_run(client, headers, case["id"], "FAIL")

    assert client.delete(f"/test-cases/{case['id']}", headers=headers).status_code == 204
    # The case is gone, so its runs are unreachable — 404, not an orphan list.
    assert client.get(f"/test-cases/{case['id']}/runs", headers=headers).status_code == 404


def test_unknown_test_case_404(client):
    headers = _make_user(client)
    assert client.get("/test-cases/999999", headers=headers).status_code == 404


# ---------- authorization ----------


def test_non_member_cannot_see_or_create_test_cases(client):
    owner = _make_user(client, "owner@test.dev", "Owner")
    outsider = _make_user(client, "out@test.dev", "Out")
    project = _create_project(client, owner)
    case = _create_case(client, owner, project["id"])

    # Existence hiding: 404, not 403.
    assert client.get(f"/projects/{project['id']}/test-cases", headers=outsider).status_code == 404
    assert client.post(
        f"/projects/{project['id']}/test-cases", json={"title": "x"}, headers=outsider
    ).status_code == 404
    assert client.get(f"/test-cases/{case['id']}", headers=outsider).status_code == 404
    assert client.get(f"/test-cases/{case['id']}/runs", headers=outsider).status_code == 404


def test_tester_role_can_create_case_and_record_run(client):
    """The SRS grants Testers exactly these two capabilities."""
    admin = _make_user(client, "admin@test.dev", "Admin")
    tester = _make_user(client, "qa@test.dev", "QA")
    project = _create_project(client, admin)
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "qa@test.dev", "role": "TESTER"},
        headers=admin,
    )
    case = _create_case(client, tester, project["id"])
    run = _record_run(client, tester, case["id"], "FAIL", notes="Coupon ignored")
    assert run["result"] == "FAIL"


def test_archived_project_blocks_test_writes(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=headers)

    assert client.post(
        f"/projects/{project['id']}/test-cases", json={"title": "x"}, headers=headers
    ).status_code == 403
    assert client.patch(
        f"/test-cases/{case['id']}", json={"title": "y"}, headers=headers
    ).status_code == 403
    assert client.post(
        f"/test-cases/{case['id']}/runs", json={"result": "PASS"}, headers=headers
    ).status_code == 403
    assert client.delete(f"/test-cases/{case['id']}", headers=headers).status_code == 403
    # Reading stays available.
    assert client.get(f"/test-cases/{case['id']}", headers=headers).status_code == 200


# ---------- FR-9.2: test runs ----------


def test_record_runs_with_each_result(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    for result in ("PASS", "FAIL", "BLOCKED"):
        run = _record_run(client, headers, case["id"], result, notes=f"{result} note")
        assert run["result"] == result
        assert run["notes"] == f"{result} note"
        assert run["test_case_id"] == case["id"]
        assert run["issue_id"] is None


def test_invalid_result_422(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    r = client.post(
        f"/test-cases/{case['id']}/runs", json={"result": "MAYBE"}, headers=headers
    )
    assert r.status_code == 422


def test_runs_are_append_only_history_newest_first(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    _record_run(client, headers, case["id"], "FAIL")
    _record_run(client, headers, case["id"], "PASS")

    runs = client.get(f"/test-cases/{case['id']}/runs", headers=headers).json()
    assert len(runs) == 2
    assert runs[0]["result"] == "PASS"  # most recent first
    assert runs[1]["result"] == "FAIL"


def test_run_on_unknown_case_404(client):
    headers = _make_user(client)
    r = client.post("/test-cases/999999/runs", json={"result": "PASS"}, headers=headers)
    assert r.status_code == 404


# ---------- FR-9.2 / TC-TCM-01: one-click bug from a failed run ----------


def test_bug_from_failed_run_is_prefilled(client):  # TC-TCM-01
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "FAIL", notes="Coupon ignored at UPI")

    r = client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers)
    assert r.status_code == 201, r.text
    body = r.json()
    issue = body["issue"]

    # Pre-filled from the test case: title and steps carry over (TC-TCM-01).
    assert case["title"] in issue["title"]
    assert issue["steps_to_reproduce"] == case["steps"]
    assert case["expected_result"] in issue["description"]
    assert "Coupon ignored at UPI" in issue["description"]

    # Created through the normal issue flow: real bug, real key, real severity.
    assert issue["type"] == "BUG"
    assert issue["severity"] == "MAJOR"
    assert issue["key"].startswith("TST-")
    assert issue["status"] == "TODO"

    # The run now points at the bug it raised.
    assert body["run"]["issue_id"] == issue["id"]


def test_bug_from_run_appears_in_the_issue_list(client):
    """It must be an ordinary issue, not a parallel record."""
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "FAIL")
    issue = client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers).json()["issue"]

    listed = client.get(f"/projects/{project['id']}/issues", headers=headers).json()
    assert issue["id"] in [i["id"] for i in listed]
    # And it logs a creation activity like any other issue.
    acts = client.get(f"/issues/{issue['id']}/activities", headers=headers).json()
    assert any(a["action"] == "created" for a in acts)


def test_bug_from_run_accepts_overrides(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "FAIL")
    r = client.post(
        f"/test-runs/{run['id']}/bug",
        json={"title": "Custom title", "severity": "BLOCKER", "priority": "CRITICAL"},
        headers=headers,
    )
    assert r.status_code == 201
    issue = r.json()["issue"]
    assert issue["title"] == "Custom title"
    assert issue["severity"] == "BLOCKER"
    assert issue["priority"] == "CRITICAL"


def test_cannot_raise_bug_from_a_passing_run(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "PASS")
    r = client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers)
    assert r.status_code == 409


def test_cannot_raise_bug_from_a_blocked_run(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "BLOCKED")
    assert client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers).status_code == 409


def test_cannot_raise_two_bugs_from_one_run(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "FAIL")
    assert client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers).status_code == 201
    assert client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers).status_code == 409


def test_bug_from_unknown_run_404(client):
    headers = _make_user(client)
    assert client.post("/test-runs/999999/bug", json={}, headers=headers).status_code == 404


def test_non_member_cannot_raise_bug_from_run(client):
    owner = _make_user(client, "owner@test.dev", "Owner")
    outsider = _make_user(client, "out@test.dev", "Out")
    project = _create_project(client, owner)
    case = _create_case(client, owner, project["id"])
    run = _record_run(client, owner, case["id"], "FAIL")
    assert client.post(f"/test-runs/{run['id']}/bug", json={}, headers=outsider).status_code == 404


def test_bug_creation_blocked_on_archived_project(client):
    headers = _make_user(client)
    project = _create_project(client, headers)
    case = _create_case(client, headers, project["id"])
    run = _record_run(client, headers, case["id"], "FAIL")
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=headers)
    assert client.post(f"/test-runs/{run['id']}/bug", json={}, headers=headers).status_code == 403
