export default function ProgressTracker({ steps }) {
  return (
    <div className="progress-tracker" role="status" aria-live="polite">
      <h2>Agent Progress</h2>
      <div className="steps-row">
        {steps.map(step => (
          <div key={step.id} className={`step ${step.status}`}>
            <div className="step-icon" aria-hidden="true">{step.icon}</div>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}