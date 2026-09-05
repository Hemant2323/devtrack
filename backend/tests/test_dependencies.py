"""Issue dependency tests (Sprint 6).

Dependencies are informational, so these check the shape of the graph and who
may change it — never that a status moved. Nothing in the feature is allowed
to alter an issue, and one test holds that line explicitly.
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


def _create_issue(client, headers, pid, title="An issue", **extra):
    payload = {"type": "TASK", "title": title, **extra}
    r = client.post(f"/projects/{pid}/issues", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _add_member(client, admin, pid, email, role="DEVELOPER"):
    r = client.post(
        f"/projects/{pid}/members", json={"email": email, "role": role}, headers=admin
    )
    assert r.status_code == 201, r.text


def _link(client, headers, issue_id, other_id, direction="BLOCKS"):
    return client.post(
        f"/issues/{issue_id}/dependencies",
        json={"issue_id": other_id, "direction": direction},
        headers=headers,
    )


def _link_ok(client, headers, issue_id, other_id, direction="BLOCKS"):
    r = _link(client, headers, issue_id, other_id, direction)
    assert r.status_code == 201, r.text
    return r.json()


def _deps(client, headers, issue_id):
    r = client.get(f"/issues/{issue_id}/dependencies", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def project(client):
    """One admin, one project, four issues — enough for chains and diamonds."""
    admin = _make_user(client, "admin@test.dev", "Admin")
    proj = _create_project(client, admin, key="DEV")
    issues = [
        _create_issue(client, admin, proj["id"], f"Issue {n}") for n in ("A", "B", "C", "D")
    ]
    return {"admin": admin, "id": proj["id"], "key": proj["key"], "issues": issues}


# ---------- create + list ----------


def test_create_dependency(client, project):
    a, b = project["issues"][0], project["issues"][1]
    link = _link_ok(client, project["admin"], a["id"], b["id"], "BLOCKS")

    assert link["issue"]["id"] == b["id"]
    assert link["issue"]["key"] == b["key"]
    assert link["issue"]["title"] == b["title"]
    assert link["id"] > 0


def test_both_sides_of_one_edge(client, project):
    """A single row is read from either end: A blocks B, B is blocked by A."""
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, project["admin"], a["id"], b["id"], "BLOCKS")

    from_a = _deps(client, project["admin"], a["id"])
    from_b = _deps(client, project["admin"], b["id"])

    assert [d["issue"]["key"] for d in from_a["blocks"]] == [b["key"]]
    assert from_a["blocked_by"] == []
    assert [d["issue"]["key"] for d in from_b["blocked_by"]] == [a["key"]]
    assert from_b["blocks"] == []


def test_blocked_by_direction(client, project):
    """Creating from the blocked issue's side produces the same single edge."""
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, project["admin"], b["id"], a["id"], "BLOCKED_BY")

    assert [d["issue"]["key"] for d in _deps(client, project["admin"], b["id"])["blocked_by"]] == [
        a["key"]
    ]
    assert [d["issue"]["key"] for d in _deps(client, project["admin"], a["id"])["blocks"]] == [
        b["key"]
    ]


def test_dependency_payload_carries_what_the_row_shows(client, project):
    admin = project["admin"]
    bug = _create_issue(
        client, admin, project["id"], "Fix authentication", type="BUG", severity="MAJOR"
    )
    target = project["issues"][0]
    _link_ok(client, admin, target["id"], bug["id"], "BLOCKED_BY")

    row = _deps(client, admin, target["id"])["blocked_by"][0]
    assert row["issue"]["key"] == bug["key"]
    assert row["issue"]["title"] == "Fix authentication"
    assert row["issue"]["type"] == "BUG"
    assert row["issue"]["status"] == "TODO"
    assert row["created_at"]
    # Nothing beyond what the row renders.
    assert set(row["issue"]) == {"id", "key", "title", "type", "status"}


def test_empty_dependencies(client, project):
    assert _deps(client, project["admin"], project["issues"][0]["id"]) == {
        "blocked_by": [],
        "blocks": [],
    }


def test_multiple_blockers_are_all_listed(client, project):
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKED_BY")
    _link_ok(client, admin, a["id"], c["id"], "BLOCKED_BY")

    keys = {d["issue"]["key"] for d in _deps(client, admin, a["id"])["blocked_by"]}
    assert keys == {b["key"], c["key"]}


# ---------- remove ----------


def test_remove_dependency(client, project):
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    link = _link_ok(client, admin, a["id"], b["id"])

    assert client.delete(f"/dependencies/{link['id']}", headers=admin).status_code == 204
    assert _deps(client, admin, a["id"])["blocks"] == []
    assert _deps(client, admin, b["id"])["blocked_by"] == []


def test_any_member_can_remove_a_dependency(client, project):
    """No admin tier — a dependency is a statement about the work."""
    admin = project["admin"]
    _make_user(client, "dev@test.dev", "Dev")
    _add_member(client, admin, project["id"], "dev@test.dev")
    dev = _make_user(client, "dev@test.dev", "Dev")

    a, b = project["issues"][0], project["issues"][1]
    link = _link_ok(client, admin, a["id"], b["id"])

    assert client.delete(f"/dependencies/{link['id']}", headers=dev).status_code == 204


def test_removing_twice_is_404(client, project):
    admin = project["admin"]
    link = _link_ok(client, admin, project["issues"][0]["id"], project["issues"][1]["id"])
    client.delete(f"/dependencies/{link['id']}", headers=admin)
    assert client.delete(f"/dependencies/{link['id']}", headers=admin).status_code == 404


def test_unknown_dependency_404(client, project):
    assert client.delete("/dependencies/999999", headers=project["admin"]).status_code == 404


# ---------- validation ----------


def test_self_dependency_rejected(client, project):
    a = project["issues"][0]
    r = _link(client, project["admin"], a["id"], a["id"], "BLOCKS")
    assert r.status_code == 422
    r = _link(client, project["admin"], a["id"], a["id"], "BLOCKED_BY")
    assert r.status_code == 422


def test_duplicate_dependency_rejected(client, project):
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    assert _link(client, admin, a["id"], b["id"], "BLOCKS").status_code == 409
    # The same edge expressed from the other end is still the same edge.
    assert _link(client, admin, b["id"], a["id"], "BLOCKED_BY").status_code == 409


def test_opposite_edge_is_a_cycle_not_a_duplicate(client, project):
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    r = _link(client, admin, b["id"], a["id"], "BLOCKS")
    assert r.status_code == 422
    assert "circular" in r.json()["detail"].lower()


def test_cross_project_dependency_rejected(client, project):
    admin = project["admin"]
    other_project = _create_project(client, admin, key="OTH")
    outside = _create_issue(client, admin, other_project["id"], "Elsewhere")

    r = _link(client, admin, project["issues"][0]["id"], outside["id"])
    assert r.status_code == 422
    assert "same project" in r.json()["detail"].lower()


def test_unknown_other_issue_404(client, project):
    r = _link(client, project["admin"], project["issues"][0]["id"], 999999)
    assert r.status_code == 404


def test_unknown_issue_404(client, project):
    r = _link(client, project["admin"], 999999, project["issues"][0]["id"])
    assert r.status_code == 404
    assert client.get("/issues/999999/dependencies", headers=project["admin"]).status_code == 404


# ---------- cycles ----------


def test_indirect_cycle_rejected(client, project):
    """A -> B -> C, so C -> A must be refused."""
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], c["id"], "BLOCKS")

    r = _link(client, admin, c["id"], a["id"], "BLOCKS")
    assert r.status_code == 422
    assert "circular" in r.json()["detail"].lower()
    # And nothing was written.
    assert _deps(client, admin, a["id"])["blocked_by"] == []


def test_long_chain_cycle_rejected(client, project):
    """The walk is not depth-limited: A -> B -> C -> D, then D -> A."""
    admin = project["admin"]
    a, b, c, d = project["issues"]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], c["id"], "BLOCKS")
    _link_ok(client, admin, c["id"], d["id"], "BLOCKS")

    assert _link(client, admin, d["id"], a["id"], "BLOCKS").status_code == 422


def test_cycle_detected_through_the_blocked_by_direction(client, project):
    """The same loop, closed from the other side, is caught the same way."""
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], c["id"], "BLOCKS")

    # "A is blocked by C" is the edge C -> A, which closes the loop.
    assert _link(client, admin, a["id"], c["id"], "BLOCKED_BY").status_code == 422


def test_valid_chain_allowed(client, project):
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], c["id"], "BLOCKS")

    middle = _deps(client, admin, b["id"])
    assert [d["issue"]["key"] for d in middle["blocked_by"]] == [a["key"]]
    assert [d["issue"]["key"] for d in middle["blocks"]] == [c["key"]]


def test_diamond_is_not_a_cycle(client, project):
    """A blocks B and C; both block D. Converging paths are fine."""
    admin = project["admin"]
    a, b, c, d = project["issues"]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, a["id"], c["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], d["id"], "BLOCKS")
    assert _link(client, admin, c["id"], d["id"], "BLOCKS").status_code == 201


def test_cycle_check_is_scoped_to_one_project(client, project):
    """A chain in one project never blocks a link in another."""
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    other = _create_project(client, admin, key="OTH")
    x = _create_issue(client, admin, other["id"], "X")
    y = _create_issue(client, admin, other["id"], "Y")
    assert _link(client, admin, x["id"], y["id"], "BLOCKS").status_code == 201
    assert _link(client, admin, y["id"], x["id"], "BLOCKS").status_code == 422


# ---------- authorization ----------


def test_non_member_cannot_read_dependencies(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    a = project["issues"][0]
    assert client.get(f"/issues/{a['id']}/dependencies", headers=outsider).status_code == 404


def test_non_member_cannot_create_dependency(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    a, b = project["issues"][0], project["issues"][1]
    assert _link(client, outsider, a["id"], b["id"]).status_code == 404


def test_non_member_cannot_remove_dependency(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    link = _link_ok(
        client, project["admin"], project["issues"][0]["id"], project["issues"][1]["id"]
    )
    assert client.delete(f"/dependencies/{link['id']}", headers=outsider).status_code == 404


def test_non_member_cannot_read_the_project_feed(client, project):
    outsider = _make_user(client, "out@test.dev", "Out")
    assert client.get(
        f"/projects/{project['id']}/dependencies", headers=outsider
    ).status_code == 404


def test_any_member_can_create_a_dependency(client, project):
    admin = project["admin"]
    _make_user(client, "qa@test.dev", "QA")
    _add_member(client, admin, project["id"], "qa@test.dev", role="TESTER")
    qa = _make_user(client, "qa@test.dev", "QA")

    a, b = project["issues"][0], project["issues"][1]
    assert _link(client, qa, a["id"], b["id"]).status_code == 201


# ---------- archived project ----------


def test_archived_project_dependencies_are_read_only(client, project):
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    link = _link_ok(client, admin, a["id"], b["id"])
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)

    # Still readable.
    assert [d["issue"]["key"] for d in _deps(client, admin, a["id"])["blocks"]] == [b["key"]]
    assert client.get(
        f"/projects/{project['id']}/dependencies", headers=admin
    ).status_code == 200

    # Writes refused.
    assert _link(client, admin, a["id"], c["id"]).status_code == 403
    assert client.delete(f"/dependencies/{link['id']}", headers=admin).status_code == 403


def test_dependencies_resume_after_restore(client, project):
    admin = project["admin"]
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=admin)
    client.patch(f"/projects/{project['id']}", json={"archived": False}, headers=admin)
    assert _link(client, admin, project["issues"][0]["id"], project["issues"][1]["id"]).status_code == 201


# ---------- project feed (board indicator) ----------


def test_project_feed_lists_every_edge_with_the_blocker_status(client, project):
    admin = project["admin"]
    a, b, c = project["issues"][0], project["issues"][1], project["issues"][2]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")
    _link_ok(client, admin, b["id"], c["id"], "BLOCKS")

    feed = client.get(f"/projects/{project['id']}/dependencies", headers=admin).json()
    assert {(e["blocking_issue_id"], e["blocked_issue_id"]) for e in feed} == {
        (a["id"], b["id"]),
        (b["id"], c["id"]),
    }
    assert all(e["blocking_status"] == "TODO" for e in feed)
    assert set(feed[0]) == {"id", "blocking_issue_id", "blocked_issue_id", "blocking_status"}


def test_project_feed_reflects_a_resolved_blocker(client, project):
    """The board reads 'blocked' as 'has an edge whose blocker isn't DONE'."""
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    client.patch(f"/issues/{a['id']}", json={"status": "DONE"}, headers=admin)
    feed = client.get(f"/projects/{project['id']}/dependencies", headers=admin).json()
    assert [e["blocking_status"] for e in feed] == ["DONE"]


def test_project_feed_is_scoped_to_its_project(client, project):
    admin = project["admin"]
    _link_ok(client, admin, project["issues"][0]["id"], project["issues"][1]["id"])

    other = _create_project(client, admin, key="OTH")
    assert client.get(f"/projects/{other['id']}/dependencies", headers=admin).json() == []


# ---------- deleted issues ----------


def test_deleted_issue_drops_out_of_dependency_lists(client, project):
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    assert client.delete(f"/issues/{b['id']}", headers=admin).status_code == 204
    assert _deps(client, admin, a["id"])["blocks"] == []
    assert client.get(f"/projects/{project['id']}/dependencies", headers=admin).json() == []


# ---------- dependencies stay informational ----------


def test_dependencies_never_change_an_issue(client, project):
    """Adding a blocker must not touch status, priority, sprint or assignee."""
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    before = client.get(f"/issues/{b['id']}", headers=admin).json()

    _link_ok(client, admin, b["id"], a["id"], "BLOCKED_BY")

    after = client.get(f"/issues/{b['id']}", headers=admin).json()
    assert after == before


def test_a_blocked_issue_can_still_be_moved_and_completed(client, project):
    """Blocking is advice, not a gate — the team decides."""
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    for state in ("IN_PROGRESS", "DONE"):
        r = client.patch(f"/issues/{b['id']}", json={"status": state}, headers=admin)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == state


def test_dependencies_write_no_activity_rows(client, project):
    """The activity log records changes to the issue; a link is not one."""
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    before = client.get(f"/issues/{b['id']}/activities", headers=admin).json()

    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    after = client.get(f"/issues/{b['id']}/activities", headers=admin).json()
    assert [x["id"] for x in after] == [x["id"] for x in before]


def test_existing_issue_endpoints_are_unaffected(client, project):
    admin = project["admin"]
    a, b = project["issues"][0], project["issues"][1]
    _link_ok(client, admin, a["id"], b["id"], "BLOCKS")

    issues = client.get(f"/projects/{project['id']}/issues", headers=admin).json()
    assert len(issues) == 4
    assert all("blocked" not in issue for issue in issues)

    board = client.get(f"/projects/{project['id']}/board", headers=admin).json()
    assert sorted(board) == ["done", "in_progress", "testing", "todo"]
    assert len(board["todo"]) == 4
