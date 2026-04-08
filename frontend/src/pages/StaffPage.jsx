import { useEffect, useState } from "react";
import { api } from "../api";
import SimpleFormSection from "../components/SimpleFormSection";
import DataTable from "../components/DataTable";

export default function StaffPage({ role, onStaffUpdated }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "Cleaner",
    employment_type: "Full-Time",
    phone: ""
  });

  const loadStaff = async () => {
    const rows = await api.getStaff();
    setStaff(rows);
    if (onStaffUpdated) {
      await onStaffUpdated();
    }
  };

  useEffect(() => {
    loadStaff().catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addStaff(form);
      setForm({
        full_name: "",
        username: "",
        password: "",
        role: "Cleaner",
        employment_type: "Full-Time",
        phone: ""
      });
      await loadStaff();
      alert("Staff created.");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteStaff(id);
      await loadStaff();
      alert("Staff member deleted successfully.");
    } catch (error) {
      alert("Error deleting staff: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "full_name", label: "Name" },
    { key: "username", label: "Username" },
    { key: "role", label: "Role" },
    { key: "employment_type", label: "Employment" },
    { key: "phone", label: "Phone" },
    { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
  ];

  return (
    <div className="page-grid">
      {(role === "Admin" ) && (
        <SimpleFormSection title="Add Staff Member" onSubmit={handleSubmit}>
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="Admin">Admin</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Cleaner">Cleaner</option>
          </select>
          <select
            value={form.employment_type}
            onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
          >
            <option value="Full-Time">Full-Time</option>
            <option value="Part-Time">Part-Time</option>
            <option value="Seasonal">Seasonal</option>
          </select>
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <button type="submit" disabled={loading}>Create Staff</button>
        </SimpleFormSection>
      )}

      <section className="panel">
        <h3>Staff Directory</h3>
        {role === "Admin" ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="empty-row">
                      No records found.
                    </td>
                  </tr>
                )}
                {staff.map((row, idx) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column.key}>{column.render ? column.render(row, idx) : row[column.key]}</td>
                    ))}
                    <td className="action-cells">
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(row.id)}
                        disabled={loading}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DataTable columns={columns} rows={staff} />
        )}
      </section>
    </div>
  );
}
