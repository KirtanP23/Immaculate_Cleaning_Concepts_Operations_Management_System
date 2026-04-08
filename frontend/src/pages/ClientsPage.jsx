import { useEffect, useState } from "react";
import { api } from "../api";
import SimpleFormSection from "../components/SimpleFormSection";
import DataTable from "../components/DataTable";

export default function ClientsPage({ role }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    name: "",
    client_type: "Commercial",
    phone: "",
    email: "",
    address: "",
    assessment_date: "",
    ideal_staff_count: "",
    equipment_required_notes: "",
    service_frequency: "",
    service_time_range: "",
    special_notes: ""
  });

  const loadClients = () => api.getClients().then(setClients).catch(console.error);

  useEffect(() => {
    loadClients();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addClient(form);
      setForm({
        name: "",
        client_type: "Commercial",
        phone: "",
        email: "",
        address: "",
        assessment_date: "",
        ideal_staff_count: "",
        equipment_required_notes: "",
        service_frequency: "",
        service_time_range: "",
        special_notes: ""
      });
      await loadClients();
      alert("Client created.");
    } catch (error) {
      alert(error.message);
    }
  };

  const columns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "name", label: "Name" },
    { key: "client_type", label: "Type" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "service_frequency", label: "Frequency" },
    { key: "service_time_range", label: "Time Range" },
    { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
  ];

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this client?")) return;
    try {
      await api.deleteClient(id);
      await loadClients();
      alert("Client deleted.");
    } catch (error) {
      alert(error.message);
    }
  };

  const adminColumns = [
    ...columns,
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <button
          className="btn-icon btn-delete"
          onClick={() => handleDelete(row.id || row._id)}
          title="Delete client"
        >
          Delete
        </button>
      )
    }
  ];

  return (
    <div className="page-grid">
      {role === "Admin" && (
        <SimpleFormSection
          title="Add New Client"
          description="Capture service needs and account details while keeping all existing backend behavior intact."
          onSubmit={handleSubmit}
        >
          <input
            placeholder="Client name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            value={form.client_type}
            onChange={(e) => setForm({ ...form, client_type: e.target.value })}
          >
            <option value="Commercial">Commercial</option>
            <option value="Domestic">Domestic</option>
          </select>
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            type="date"
            value={form.assessment_date}
            onChange={(e) => setForm({ ...form, assessment_date: e.target.value })}
          />
          <input
            type="number"
            min="1"
            placeholder="Ideal staff count"
            value={form.ideal_staff_count}
            onChange={(e) => setForm({ ...form, ideal_staff_count: e.target.value })}
          />
          <input
            placeholder="Service frequency"
            value={form.service_frequency}
            onChange={(e) => setForm({ ...form, service_frequency: e.target.value })}
          />
          <input
            placeholder="Service time range"
            value={form.service_time_range}
            onChange={(e) => setForm({ ...form, service_time_range: e.target.value })}
          />
          <input
            placeholder="Equipment requirement notes"
            value={form.equipment_required_notes}
            onChange={(e) => setForm({ ...form, equipment_required_notes: e.target.value })}
          />
          <input
            placeholder="Special notes"
            value={form.special_notes}
            onChange={(e) => setForm({ ...form, special_notes: e.target.value })}
          />
          <button type="submit">Create Client</button>
        </SimpleFormSection>
      )}

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Directory</p>
          <h3>Client List</h3>
        </div>
        {role === "Admin" || role === "Owner" ? (
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
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="empty-row">
                      No records found.
                    </td>
                  </tr>
                )}
                {clients.map((row, idx) => (
                  <tr key={row.id || row._id}>
                    {columns.map((column) => (
                      <td key={column.key}>{column.render ? column.render(row, idx) : row[column.key]}</td>
                    ))}
                    <td className="action-cells">
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(row.id || row._id)}
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
          <DataTable columns={columns} rows={clients} />
        )}
      </section>
    </div>
  );
}
