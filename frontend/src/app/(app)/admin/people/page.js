"use client";
import { useCallback, useEffect, useState } from "react";
import { api, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROLES = ["pharmacist", "chw", "doctor", "patient", "caregiver", "admin"];

export default function People() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [n, setN] = useState({ name: "", type: "pharmacy", district: "" });
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { const [u, o] = await Promise.all([api("/api/admin/users"), api("/api/admin/orgs")]); setUsers(u.users); setOrgs(o.orgs); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { if (user?.role === "admin") load(); }, [user, load]);

  async function upd(id, body) { setErr(""); try { await patch(`/api/admin/users/${id}`, body); load(); } catch (e) { setErr(e.message); } }

  if (user && user.role !== "admin") return <div className="notice warn">Admins only.</div>;
  const waiting = users.filter((u) => !u.active);
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || (id === "unassigned" ? "Not assigned" : id);

  return (
    <div className="stack">
      <h1>People & places</h1>
      {err && <div className="notice bad">{err}</div>}
      {waiting.length > 0 && (
        <div className="card stack">
          <h3>Waiting for approval</h3>
          {waiting.map((u) => (
            <div key={u.id} className="row between"><div><b>{u.name}</b> <span className="small muted">{u.email} · {u.role} · {orgName(u.org)}</span></div>
              <div className="row">
                <select value={u.org} onChange={(e) => upd(u.id, { org: e.target.value })} style={{ maxWidth: 200 }}><option value="unassigned">Assign place…</option>{orgs.filter((o) => o.active).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <button className="btn small" disabled={u.org === "unassigned"} onClick={() => upd(u.id, { active: true })}>Approve</button></div></div>
          ))}
        </div>
      )}

      <div className="card tablewrap"><h3>All accounts</h3>
        <table><thead><tr><th>Name</th><th>Role</th><th>Place</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td>{u.name}<div className="small muted">{u.email || "demo"}</div></td>
              <td><select value={u.role} onChange={(e) => confirm(`Change role to ${e.target.value}? They are signed out.`) && upd(u.id, { role: e.target.value })} disabled={u.id === user?.id}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
              <td><select value={u.org} onChange={(e) => upd(u.id, { org: e.target.value })}><option value="unassigned">Not assigned</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></td>
              <td>{u.active ? <span className="badge ok">Active</span> : <span className="badge bad">Off</span>}</td>
              <td><div className="row">
                <button className="btn secondary small" disabled={u.id === user?.id} onClick={() => upd(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</button>
                <button className="btn secondary small" onClick={async () => { await post(`/api/admin/users/${u.id}/signout`); setErr(""); load(); }}>Sign out everywhere</button></div></td></tr>
          ))}</tbody></table>
      </div>

      <div className="card stack">
        <h3>Pharmacies & clinics</h3>
        <div className="tablewrap"><table><thead><tr><th>Name</th><th>Type</th><th>District</th><th></th></tr></thead>
          <tbody>{orgs.map((o) => <tr key={o.id}><td>{o.name}</td><td>{o.type}</td><td>{o.district}</td><td><button className="btn secondary small" onClick={async () => { await patch(`/api/admin/orgs/${o.id}`, { active: !o.active }); load(); }}>{o.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
        <form className="row" onSubmit={async (e) => { e.preventDefault(); try { await post("/api/admin/orgs", n); setN({ name: "", type: "pharmacy", district: "" }); load(); } catch (x) { setErr(x.message); } }}>
          <input style={{ maxWidth: 240 }} placeholder="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} required />
          <select style={{ maxWidth: 140 }} value={n.type} onChange={(e) => setN({ ...n, type: e.target.value })}><option>pharmacy</option><option>clinic</option><option>ngo</option></select>
          <input style={{ maxWidth: 180 }} placeholder="District" value={n.district} onChange={(e) => setN({ ...n, district: e.target.value })} />
          <button className="btn">Add</button>
        </form>
      </div>
    </div>
  );
}
