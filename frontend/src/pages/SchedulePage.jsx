import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DataTable from "../components/DataTable";
import SimpleFormSection from "../components/SimpleFormSection";

function createEmptyScheduleForm(defaultDate = new Date().toISOString().slice(0, 10)) {
  return {
    client_id: "",
    service_id: "",
    supervisor_id: "",
    schedule_date: defaultDate,
    start_time: "09:00",
    notes: "",
    staff_ids: [],
    equipment_allocations: [],
    estimated_duration_hours: ""
  };
}

function mapScheduleToForm(schedule) {
  return {
    client_id: String(schedule.client_id || ""),
    service_id: String(schedule.service_id || ""),
    supervisor_id: String(schedule.supervisor_id || ""),
    schedule_date: schedule.schedule_date || new Date().toISOString().slice(0, 10),
    start_time: schedule.start_time || "09:00",
    notes: schedule.notes || "",
    staff_ids: (schedule.assigned_staff_ids || []).map((staffId) => String(staffId)),
    equipment_allocations: (schedule.equipment_allocations || []).map((allocation) => ({
      equipment_id: String(allocation.equipment_id),
      qty_needed: Number(allocation.qty_needed) || 1
    })),
    estimated_duration_hours:
      schedule.estimated_duration_hours !== null && schedule.estimated_duration_hours !== undefined
        ? String(schedule.estimated_duration_hours)
        : ""
  };
}

export default function SchedulePage({ role, currentUser, staff }) {
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [form, setForm] = useState(() => createEmptyScheduleForm());
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [conflicts, setConflicts] = useState({
    hasConflicts: false,
    hasWarnings: false,
    errors: [],
    warnings: []
  });
  const [filters, setFilters] = useState({ date: "", client_id: "", staff_id: "" });

  const asId = (row) => String(row?.id || row?._id || "");
  const normalizedStaff = useMemo(
    () => (staff || []).map((member) => ({ ...member, id: asId(member) })),
    [staff]
  );

  const supervisors = useMemo(
    () => normalizedStaff.filter((member) => member.role === "Supervisor"),
    [normalizedStaff]
  );
  const cleaners = useMemo(
    () => normalizedStaff.filter((member) => member.role === "Cleaner"),
    [normalizedStaff]
  );

  const loadSchedules = async () => {
    const params = {
      ...(filters.date ? { date: filters.date } : {}),
      ...(filters.client_id ? { client_id: filters.client_id } : {}),
      ...(filters.staff_id ? { staff_id: filters.staff_id } : {})
    };
    const rows = await api.getSchedules(params);
    setSchedules(rows);
  };

  const loadReferences = async () => {
    const [clientRows, serviceRows, equipmentRows] = await Promise.all([
      api.getClients(),
      api.getServices(),
      api.getEquipment()
    ]);
    setClients(
      clientRows
        .map((client) => ({ ...client, id: asId(client) }))
        .filter((client) => client.is_active === true)
    );
    setServices(serviceRows.map((service) => ({ ...service, id: asId(service) })));
    setEquipment(equipmentRows.map((equip) => ({ ...equip, id: asId(equip) })));
  };

  useEffect(() => {
    loadSchedules().catch(console.error);
  }, [role, currentUser?.id, filters.date, filters.client_id, filters.staff_id]);

  useEffect(() => {
    if (role === "Cleaner") return;
    loadReferences().catch(console.error);
  }, [role]);

  useEffect(() => {
    if (role !== "Supervisor" || !currentUser?.id) return;
    setForm((prev) => ({ ...prev, supervisor_id: String(currentUser.id) }));
  }, [role, currentUser?.id]);

  const resetForm = () => {
    const nextForm = createEmptyScheduleForm();
    if (role === "Supervisor" && currentUser?.id) {
      nextForm.supervisor_id = String(currentUser.id);
    }
    setForm(nextForm);
    setEditingScheduleId(null);
    setConflicts({ hasConflicts: false, hasWarnings: false, errors: [], warnings: [] });
  };

  const toggleCleaner = (id) => {
    setForm((prev) => {
      const exists = prev.staff_ids.includes(id);
      const nextIds = exists ? prev.staff_ids.filter((staffId) => staffId !== id) : [...prev.staff_ids, id];
      return { ...prev, staff_ids: nextIds };
    });
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setForm(mapScheduleToForm(schedule));
    setConflicts({ hasConflicts: false, hasWarnings: false, errors: [], warnings: [] });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDeleteSchedule = async () => {
    if (!editingScheduleId) return;
    if (!window.confirm("Delete this schedule? This action cannot be undone.")) return;

    try {
      await api.deleteSchedule(editingScheduleId);
      await loadSchedules();
      resetForm();
      alert("Schedule deleted successfully!");
    } catch (error) {
      alert(error.message);
    }
  };

  const toggleEquipment = (id) => {
    setForm((prev) => {
      const exists = prev.equipment_allocations.find((e) => e.equipment_id === id);
      let nextAllocs;
      if (exists) {
        nextAllocs = prev.equipment_allocations.filter((e) => e.equipment_id !== id);
      } else {
        nextAllocs = [...prev.equipment_allocations, { equipment_id: id, qty_needed: 1 }];
      }
      return { ...prev, equipment_allocations: nextAllocs };
    });
  };

  // Check for conflicts when relevant form fields change
  useEffect(() => {
    const checkConflicts = async () => {
      if (!form.supervisor_id || !form.schedule_date) {
        setConflicts({ hasConflicts: false, hasWarnings: false, errors: [], warnings: [] });
        return;
      }

      try {
        const result = await api.checkScheduleConflicts({
          client_id: form.client_id || undefined,
          service_id: form.service_id || undefined,
          supervisor_id: form.supervisor_id,
          schedule_date: form.schedule_date,
          exclude_schedule_id: editingScheduleId || undefined,
          start_time: form.start_time,
          staff_ids: form.staff_ids,
          equipment_allocations: form.equipment_allocations
        });
        setConflicts(result);
      } catch (error) {
        console.error("Error checking conflicts:", error);
      }
    };

    const debounceTimer = setTimeout(checkConflicts, 500);
    return () => clearTimeout(debounceTimer);
  }, [
    editingScheduleId,
    form.client_id,
    form.service_id,
    form.supervisor_id,
    form.schedule_date,
    form.start_time,
    form.staff_ids,
    form.equipment_allocations
  ]);

  const isScheduleBlocked =
    conflicts.hasConflicts ||
    conflicts.warnings.some((issue) => issue.type === "supervisor_conflict" || issue.type === "cleaner_conflict");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.staff_ids.length < 2 || form.staff_ids.length > 6) {
      alert("Team size must be between 2 and 6.");
      return;
    }

    if (conflicts.hasConflicts) {
      alert("Cannot save schedule due to conflicts. Please review errors above.");
      return;
    }

    try {
      const payload = {
        ...form,
        client_id: form.client_id,
        service_id: form.service_id,
        supervisor_id:
          role === "Supervisor" ? String(currentUser.id) : form.supervisor_id,
        estimated_duration_hours: form.estimated_duration_hours
          ? Number(form.estimated_duration_hours)
          : undefined
      };

      if (editingScheduleId) {
        await api.updateSchedule(editingScheduleId, payload);
      } else {
        await api.addSchedule(payload);
      }

      await loadSchedules();
      resetForm();
      alert(editingScheduleId ? "Schedule updated successfully!" : "Schedule created successfully!");
    } catch (error) {
      alert(error.message);
    }
  };

  const markCompleted = async (id) => {
    try {
      await api.updateScheduleStatus(id, "Completed");
      await loadSchedules();
      alert("Schedule marked Completed.");
    } catch (error) {
      alert(error.message);
    }
  };

  const columns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "schedule_date", label: "Date" },
    { key: "start_time", label: "Start" },
    { key: "end_time", label: "End" },
    { key: "client_name", label: "Client" },
    { key: "service_name", label: "Service" },
    { key: "supervisor_name", label: "Supervisor" },
    {
      key: "assigned_staff",
      label: "Team",
      render: (row) =>
        Array.isArray(row.assigned_staff) && row.assigned_staff.length > 0
          ? row.assigned_staff.join(" , ")
          : row.assigned_staff || "-"
    },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      render: (row) =>
        row.can_edit_upcoming || row.can_update_status ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {row.can_edit_upcoming && (
              <button className="ghost-btn" onClick={() => handleEditSchedule(row)}>
                Edit
              </button>
            )}
            {row.can_update_status && row.status !== "Completed" && (
              <button className="ghost-btn" onClick={() => markCompleted(row.id)}>
                Mark Completed
              </button>
            )}
          </div>
        ) : (
          "-"
        )
    }
  ];

  const getEquipmentQty = (equipmentId) => {
    const alloc = form.equipment_allocations.find((e) => e.equipment_id === equipmentId);
    return alloc?.qty_needed || 1;
  };

  const updateEquipmentQty = (equipmentId, qty) => {
    setForm((prev) => {
      const updated = prev.equipment_allocations.map((e) =>
        e.equipment_id === equipmentId ? { ...e, qty_needed: Math.max(1, qty) } : e
      );
      return { ...prev, equipment_allocations: updated };
    });
  };

  return (
    <div className="page-grid">
      {(role === "Admin" || role === "Owner" || role === "Supervisor") && (
        <SimpleFormSection
          title={editingScheduleId ? "Edit Schedule" : "Create Schedule"}
          description={
            editingScheduleId
              ? "Adjust the schedule details, team, or equipment before saving the change."
              : "Assign the right team, line up equipment, and check conflicts before confirming."
          }
          onSubmit={handleSubmit}
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

          <select
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            required
          >
            <option value="">Select Service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.service_name} {service.estimated_hours ? `(${service.estimated_hours}h)` : ""}
              </option>
            ))}
          </select>

          <select
            value={form.supervisor_id}
            onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
            disabled={role === "Supervisor"}
            required
          >
            <option value="">Select Supervisor</option>
            {supervisors.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={form.schedule_date}
            onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
            min={new Date().toISOString().slice(0, 10)}
            required
          />

          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            required
          />

          <input
            type="number"
            placeholder="Duration (hours)"
            value={form.estimated_duration_hours}
            onChange={(e) => setForm({ ...form, estimated_duration_hours: e.target.value })}
            min="0.5"
            step="0.5"
          />

          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="checkbox-box full-width">
            <p>Assign Team (2-6 cleaners)</p>
            <div className="checkbox-grid">
              {cleaners.map((member) => (
                <label key={member.id}>
                  <input
                    type="checkbox"
                    checked={form.staff_ids.includes(member.id)}
                    onChange={() => toggleCleaner(member.id)}
                  />
                  {member.full_name}
                </label>
              ))}
            </div>
          </div>

          <div className="checkbox-box full-width">
            <p>Equipment Required</p>
            <div className="checkbox-grid">
              {equipment.map((equip) => (
                <div key={equip.id} className="equipment-choice">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.equipment_allocations.some((e) => e.equipment_id === equip.id)}
                      onChange={() => toggleEquipment(equip.id)}
                    />
                    {equip.equipment_name}
                  </label>
                  {form.equipment_allocations.some((e) => e.equipment_id === equip.id) && (
                    <input
                      type="number"
                      value={getEquipmentQty(equip.id)}
                      onChange={(e) => updateEquipmentQty(equip.id, Number(e.target.value))}
                      min="1"
                      max={equip.quantity_available}
                      className="equipment-qty"
                      title={`Available: ${equip.quantity_available}`}
                    />
                  )}
                  <span className="equipment-meta">Available: {equip.quantity_available}</span>
                </div>
              ))}
            </div>
          </div>

          {conflicts.hasConflicts && conflicts.errors.length > 0 && (
            <div className="feedback-banner feedback-banner-error full-width">
              <strong style={{ color: "#c00" }}>⚠️ Errors:</strong>
              {conflicts.errors.map((err, idx) => (
                <p key={idx}>
                  • {err.message}
                </p>
              ))}
            </div>
          )}

          {conflicts.hasWarnings && conflicts.warnings.length > 0 && (
            <div className="feedback-banner feedback-banner-warning full-width">
              <strong style={{ color: "#a60" }}>⚠️ Warnings:</strong>
              {conflicts.warnings.map((warn, idx) => (
                <p key={idx}>
                  • {warn.message}
                </p>
              ))}
            </div>
          )}

          <button type="submit" disabled={isScheduleBlocked}>
            {editingScheduleId ? "Save Changes" : "Create Schedule"}
          </button>

          {editingScheduleId && (
            <>
              <button type="button" className="ghost-btn" onClick={handleCancelEdit}>
                Cancel Edit
              </button>
              <button type="button" className="btn-icon btn-delete" onClick={handleDeleteSchedule}>
                Delete Schedule
              </button>
            </>
          )}
        </SimpleFormSection>
      )}

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Operations</p>
          <h3>Schedule List</h3>
        </div>
        {(role === "Admin" || role === "Owner" || role === "Supervisor") && (
          <div className="form-grid form-grid-inline">
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              placeholder="Filter by date"
            />
            <select
              value={filters.client_id}
              onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <select
              value={filters.staff_id}
              onChange={(e) => setFilters({ ...filters, staff_id: e.target.value })}
            >
              <option value="">All staff</option>
              {cleaners.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <DataTable columns={columns} rows={schedules} />
      </section>
    </div>
  );
}
