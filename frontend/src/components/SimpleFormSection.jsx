export default function SimpleFormSection({ title, description, children, onSubmit }) {
  return (
    <section className="panel form-section">
      <div className="section-heading">
        <p className="eyebrow">Workspace</p>
        <h3>{title}</h3>
        {description && <p className="muted section-muted">{description}</p>}
      </div>
      <form className="form-grid enhanced-form-grid" onSubmit={onSubmit}>
        {children}
      </form>
    </section>
  );
}
