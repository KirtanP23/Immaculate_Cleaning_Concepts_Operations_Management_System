import { useEffect, useState } from "react";
import { api } from "../api";
import DataTable from "../components/DataTable";

export default function ReportsPage() {
  const [weekDate, setWeekDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekly, setWeekly] = useState({ weekStart: "", weekEnd: "", weeklySchedules: [] });
  const [allocation, setAllocation] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [history, setHistory] = useState(null);

  const asId = (row) => String(row?.id || row?._id || "");

  const loadReports = async () => {
    const [weeklyData, allocationData, clientRows] = await Promise.all([
      api.getWeeklyScheduleReport(weekDate),
      api.getStaffAllocationReport(),
      api.getClients()
    ]);

    setWeekly(weeklyData);
    setAllocation(allocationData);
    setClients(clientRows.map((client) => ({ ...client, id: asId(client) })));
  };

  useEffect(() => {
    loadReports().catch(console.error);
  }, [weekDate]);

  const loadHistory = async () => {
    if (!selectedClient) return;
    const result = await api.getClientHistory(selectedClient);
    setHistory(result);
  };

  const weeklyColumns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "schedule_date", label: "Date" },
    { key: "start_time", label: "Start" },
    { key: "client_name", label: "Client" },
    { key: "service_name", label: "Service" },
    { key: "supervisor_name", label: "Supervisor" },
    { key: "team_size", label: "Team Size" },
    { key: "status", label: "Status" }
  ];

  const allocationColumns = [
    { key: "schedule_id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "schedule_date", label: "Date" },
    { key: "client_name", label: "Client" },
    { key: "staff_list", label: "Assigned Staff" }
  ];

  const historyColumns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "schedule_date", label: "Date" },
    { key: "start_time", label: "Start" },
    { key: "service_name", label: "Service" },
    { key: "supervisor", label: "Supervisor" },
    { key: "status", label: "Status" }
  ];

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="report-head">
          <div className="section-heading">
            <p className="eyebrow">Reporting</p>
            <h3>Weekly Schedule Report</h3>
          </div>
          <input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} />
        </div>
        <p className="muted">
          Week: {weekly.weekStart || "-"} to {weekly.weekEnd || "-"}
        </p>
        <DataTable columns={weeklyColumns} rows={weekly.weeklySchedules || []} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Team load</p>
          <h3>Staff Allocation Per Schedule</h3>
        </div>
        <DataTable columns={allocationColumns} rows={allocation} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">History</p>
          <h3>Client History</h3>
        </div>
        <div className="history-controls">
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <button onClick={loadHistory}>Load History</button>
        </div>

        {history && (
          <>
            <p className="muted">
              Client: {history.client.name} | Active: {history.client.is_active ? "Yes" : "No"}
            </p>
            <DataTable columns={historyColumns} rows={history.schedules} />
          </>
        )}
      </section>
    </div>
  );
}
