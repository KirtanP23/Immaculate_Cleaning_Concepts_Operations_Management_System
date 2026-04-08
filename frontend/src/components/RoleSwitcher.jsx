export default function RoleSwitcher({ role, setRole, cleanerId, setCleanerId, cleaners }) {
  return (
    <section className="role-switcher panel">
      <h3>Role Simulation</h3>
      <div className="role-controls">
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Admin">Admin</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Cleaner">Cleaner</option>
          </select>
        </label>

        {role === "Cleaner" && (
          <label>
            Cleaner Account
            <select value={cleanerId} onChange={(e) => setCleanerId(e.target.value)}>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
