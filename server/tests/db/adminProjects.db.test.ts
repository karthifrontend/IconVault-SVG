// HTTP tests for the admin's project list (Manage Projects): an admin sees every project, including other people's private and archived ones, and can search by the owner's name or email; other users cannot.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { hasDatabase, startHarness, type TestUser } from "./harness.js";

describe("manage projects (HTTP, throwaway database)", { skip: hasDatabase ? false : "MONGODB_URI is not set" }, () => {
  let h: Awaited<ReturnType<typeof startHarness>>;
  let admin: TestUser;
  let ada: TestUser;
  let bob: TestUser;

  before(async () => {
    h = await startHarness();
    admin = await h.makeUser("admin", { admin: true });
    ada = await h.makeUser("ada");
    bob = await h.makeUser("bob");
  });
  after(() => h?.stop());

  const project = async (token: string, name: string, over: Record<string, unknown> = {}) => (await h.call(token, "POST", "/api/projects", { name, ...over })).body;
  const names = (body: { projects: { name: string }[] }) => body.projects.map((p) => p.name).sort();

  it("lets an admin list everyone's projects, private and archived included, but not other users", async () => {
    await project(ada.token, "Ada private");
    const archived = await project(bob.token, "Bob archived");
    await h.call(bob.token, "PATCH", `/api/projects/${archived.id}`, { isArchived: true });
    const all = await h.call(admin.token, "GET", "/api/projects?status=all&scope=all&limit=100");
    assert.equal(all.status, 200);
    assert.ok(names(all.body).includes("Ada private") && names(all.body).includes("Bob archived"));
    const adaView = await h.call(ada.token, "GET", "/api/projects?status=all&scope=all&limit=100");
    assert.equal(names(adaView.body).includes("Bob archived"), false);
  });

  it("finds projects by the owner's name or email for an admin only", async () => {
    await project(ada.token, "Zebra one");
    await project(bob.token, "Zebra two");
    const byOwner = await h.call(admin.token, "GET", `/api/projects?status=all&search=${encodeURIComponent(ada.email)}&limit=100`);
    const found = names(byOwner.body);
    assert.ok(found.includes("Zebra one") && found.includes("Ada private"));
    assert.equal(found.includes("Zebra two"), false);
    // A normal user searching an owner's email does not find other people's private projects that way.
    const normal = await h.call(bob.token, "GET", `/api/projects?status=all&search=${encodeURIComponent(ada.email)}&limit=100`);
    assert.equal(names(normal.body).includes("Zebra one"), false);
  });
});
