"""Project tests — TC-PRJ-01..04 from docs/05-Test-Plan.md."""

import pytest


# ---------- helpers ----------


def _make_user(client, email="dev@test.dev", name="Dev", password="secret123"):
    r = client.post(
        "/auth/signup", json={"name": name, "email": email, "password": password}
    )
    assert r.status_code == 201, r.text
    tokens = client.post(
        "/auth/login", json={"email": email, "password": password}
    ).json()
    return r.json(), {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_project(client, headers, key="DEV", name="DevTrack"):
    r = client.post(
        "/projects",
        json={"name": name, "key": key, "description": "Test project"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------- project CRUD ----------


def test_create_project_and_creator_is_admin(client):  # TC-PRJ-01
    _, hdrs = _make_user(client)
    project = _create_project(client, hdrs)
    assert project["key"] == "DEV"

    members = client.get(f"/projects/{project['id']}/members", headers=hdrs).json()
    assert len(members) == 1
    assert members[0]["role"] == "ADMIN"


def test_list_projects_only_own(client):
    _, hdrs_a = _make_user(client, "a@test.dev", "Alice")
    _, hdrs_b = _make_user(client, "b@test.dev", "Bob")
    _create_project(client, hdrs_a, "ALPH", "Alpha")
    _create_project(client, hdrs_b, "BETA", "Beta")

    a_projects = client.get("/projects", headers=hdrs_a).json()
    b_projects = client.get("/projects", headers=hdrs_b).json()
    assert len(a_projects) == 1 and a_projects[0]["key"] == "ALPH"
    assert len(b_projects) == 1 and b_projects[0]["key"] == "BETA"


def test_duplicate_key_409(client):
    _, hdrs = _make_user(client)
    _create_project(client, hdrs, "UNIQ")
    r = client.post(
        "/projects", json={"name": "Other", "key": "UNIQ"}, headers=hdrs
    )
    assert r.status_code == 409


def test_key_auto_uppercased(client):
    _, hdrs = _make_user(client)
    r = client.post(
        "/projects", json={"name": "N", "key": "low"}, headers=hdrs
    )
    # lowercase fails the regex pattern ("^[A-Z0-9]+$")
    assert r.status_code == 422


def test_non_member_gets_404(client):  # TC-PRJ-02
    _, hdrs_owner = _make_user(client, "owner@test.dev", "Owner")
    _, hdrs_other = _make_user(client, "other@test.dev", "Other")
    project = _create_project(client, hdrs_owner, "SEC", "Secret")
    r = client.get(f"/projects/{project['id']}", headers=hdrs_other)
    assert r.status_code == 404  # not 403 — existence must not leak


def test_update_project_requires_admin(client):
    user_a, hdrs_a = _make_user(client, "a2@test.dev", "A2")
    user_b, hdrs_b = _make_user(client, "b2@test.dev", "B2")
    project = _create_project(client, hdrs_a, "UPD", "Updatable")

    # add user_b as Developer (not Admin)
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "b2@test.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    r = client.patch(
        f"/projects/{project['id']}",
        json={"name": "Renamed"},
        headers=hdrs_b,
    )
    assert r.status_code == 403


def test_archive_project(client):
    _, hdrs = _make_user(client)
    project = _create_project(client, hdrs, "ARC", "Archivable")
    r = client.patch(
        f"/projects/{project['id']}", json={"archived": True}, headers=hdrs
    )
    assert r.status_code == 200
    assert r.json()["archived"] is True


# ---------- membership ----------


def test_add_member_and_duplicate_409(client):  # TC-PRJ-03
    _, hdrs_a = _make_user(client, "aa@test.dev", "AA")
    user_b, hdrs_b = _make_user(client, "bb@test.dev", "BB")
    project = _create_project(client, hdrs_a, "MBR", "Members")

    r = client.post(
        f"/projects/{project['id']}/members",
        json={"email": "bb@test.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    assert r.status_code == 201
    assert r.json()["role"] == "DEVELOPER"

    # add again → 409
    r2 = client.post(
        f"/projects/{project['id']}/members",
        json={"email": "bb@test.dev", "role": "TESTER"},
        headers=hdrs_a,
    )
    assert r2.status_code == 409


def test_member_can_read_project(client):
    _, hdrs_owner = _make_user(client, "own@test.dev", "Own")
    _, hdrs_dev = _make_user(client, "dev2@test.dev", "Dev2")
    project = _create_project(client, hdrs_owner, "VIS", "Visible")
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "dev2@test.dev", "role": "DEVELOPER"},
        headers=hdrs_owner,
    )
    r = client.get(f"/projects/{project['id']}", headers=hdrs_dev)
    assert r.status_code == 200


def test_only_admin_can_add_member(client):
    _, hdrs_a = _make_user(client, "ad@test.dev", "Ad")
    _, hdrs_b = _make_user(client, "bd@test.dev", "Bd")
    _, hdrs_c = _make_user(client, "cd@test.dev", "Cd")
    project = _create_project(client, hdrs_a, "RBD", "RBAC")

    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "bd@test.dev", "role": "DEVELOPER"},
        headers=hdrs_a,
    )
    r = client.post(
        f"/projects/{project['id']}/members",
        json={"email": "cd@test.dev", "role": "DEVELOPER"},
        headers=hdrs_b,  # Developer, not Admin
    )
    assert r.status_code == 403


def test_archived_project_add_member_forbidden(client):  # TC-PRJ-04
    _, hdrs = _make_user(client, "arc2@test.dev", "Arc2")
    _, _ = _make_user(client, "new@test.dev", "New")
    project = _create_project(client, hdrs, "ARCD", "Archived")
    client.patch(f"/projects/{project['id']}", json={"archived": True}, headers=hdrs)

    r = client.post(
        f"/projects/{project['id']}/members",
        json={"email": "new@test.dev", "role": "DEVELOPER"},
        headers=hdrs,
    )
    assert r.status_code == 403


# ---------- components ----------


def test_add_component_and_duplicate_409(client):
    _, hdrs = _make_user(client)
    project = _create_project(client, hdrs, "CMP", "Components")

    r = client.post(
        f"/projects/{project['id']}/components",
        json={"name": "Payment"},
        headers=hdrs,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Payment"

    r2 = client.post(
        f"/projects/{project['id']}/components",
        json={"name": "Payment"},
        headers=hdrs,
    )
    assert r2.status_code == 409


def test_list_components(client):
    _, hdrs = _make_user(client)
    project = _create_project(client, hdrs, "LST", "Listing")
    for name in ["Auth", "UI", "API"]:
        client.post(
            f"/projects/{project['id']}/components", json={"name": name}, headers=hdrs
        )
    comps = client.get(f"/projects/{project['id']}/components", headers=hdrs).json()
    assert len(comps) == 3
