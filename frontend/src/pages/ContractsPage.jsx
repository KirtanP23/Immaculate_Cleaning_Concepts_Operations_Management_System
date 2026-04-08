import { useEffect, useState } from "react";
import { api } from "../api";
import SimpleFormSection from "../components/SimpleFormSection";
import DataTable from "../components/DataTable";

export default function ContractsPage({ role }) {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    client_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    notes: ""
  });

  const loadData = async () => {
    const [contractRows, clientRows] = await Promise.all([api.getContracts(), api.getClients()]);
    setContracts(contractRows);
    setClients(clientRows);
  };

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.addContract({
        ...form,
        client_id: Number(form.client_id)
      });
      setForm({
        client_id: "",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: "",
        notes: ""
      });
      await loadData();
      alert("Contract saved.");
    } catch (error) {
      alert(error.message);
    }
  };

  const columns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "client_name", label: "Client" },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "notes", label: "Notes" }
  ];

  return (
    <div className="page-grid">
      {(role === "Admin" || role === "Owner") && (
        <SimpleFormSection
          title="Add Contract"
          description="Record contract periods and notes while preserving the current API payloads."
          onSubmit={submit}
        >
          <select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            required
          >
            <option value="">Select Client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            required
          />
          <input
            placeholder="Contract notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit">Save Contract</button>
        </SimpleFormSection>
      )}

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Agreements</p>
          <h3>Contract Register</h3>
        </div>
        <DataTable columns={columns} rows={contracts} />
      </section>
    </div>
  );
}
