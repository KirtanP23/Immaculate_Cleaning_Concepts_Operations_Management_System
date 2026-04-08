import { useState, useEffect } from "react";
import { api } from "../api";

export function EquipmentPage({ currentUser }) {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    equipment_name: "",
    quantity_available: "",
    status: "Available",
    maintenance_date: ""
  });

  const asId = (row) => String(row?.id || row?._id || "");

  useEffect(() => {
    refreshEquipment();
  }, []);

  const refreshEquipment = async () => {
    try {
      setLoading(true);
      const data = await api.getEquipment();
      setEquipment(data.map((equip) => ({ ...equip, id: asId(equip) })));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity_available" ? parseInt(value) || "" : value
    }));
  };

  const handleAddOrUpdate = async () => {
    if (!formData.equipment_name || formData.quantity_available === "") {
      setError("Equipment name and quantity are required.");
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await api.updateEquipment(editingId, formData);
      } else {
        await api.addEquipment(formData);
      }
      setFormData({
        equipment_name: "",
        quantity_available: "",
        status: "Available",
        maintenance_date: ""
      });
      setEditingId(null);
      setShowForm(false);
      await refreshEquipment();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (equip) => {
    setFormData({
      equipment_name: equip.equipment_name,
      quantity_available: equip.quantity_available,
      status: equip.status,
      maintenance_date: equip.maintenance_date || ""
    });
    setEditingId(equip.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this equipment?")) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteEquipment(id);
      await refreshEquipment();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      equipment_name: "",
      quantity_available: "",
      status: "Available",
      maintenance_date: ""
    });
  };

  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Owner";

  return (
    <div className="page-container">
      <h2>Equipment Management</h2>

      {error && <div className="error-banner">{error}</div>}

      {isAdmin && (
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
        >
          {showForm ? "Cancel" : "Add Equipment"}
        </button>
      )}

      {showForm && isAdmin && (
        <div className="form-panel">
          <h3>{editingId ? "Edit Equipment" : "Add New Equipment"}</h3>

          <div className="form-group">
            <label>Equipment Name</label>
            <input
              type="text"
              name="equipment_name"
              placeholder="e.g., Vacuum cleaner, Mop, Bucket"
              value={formData.equipment_name}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Quantity Available</label>
            <input
              type="number"
              name="quantity_available"
              placeholder="0"
              value={formData.quantity_available}
              onChange={handleInputChange}
              disabled={loading}
              min="0"
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="Available">Available</option>
              <option value="In Use">In Use</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>

          <div className="form-group">
            <label>Maintenance Date</label>
            <input
              type="date"
              name="maintenance_date"
              value={formData.maintenance_date}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-success" onClick={handleAddOrUpdate} disabled={loading}>
              {editingId ? "Update Equipment" : "Add Equipment"}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="loading">Loading...</p>}

      {equipment.length === 0 && !loading && (
        <p className="no-data">No equipment records found.</p>
      )}

      {equipment.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment Name</th>
                <th>Quantity Available</th>
                <th>Status</th>
                <th>Maintenance Date</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {equipment.map((equip) => (
                <tr key={equip.id}>
                  <td>{equip.equipment_name}</td>
                  <td>{equip.quantity_available}</td>
                  <td>
                    <span className={`status-badge status-${equip.status.toLowerCase().replace(" ", "-")}`}>
                      {equip.status}
                    </span>
                  </td>
                  <td>{equip.maintenance_date || "-"}</td>
                  {isAdmin && (
                    <td className="action-cells">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEdit(equip)}
                        disabled={loading}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(equip.id)}
                        disabled={loading}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
