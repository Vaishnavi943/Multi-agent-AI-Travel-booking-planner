export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-bio">
          <div className="footer-avatar">VJ</div>
          <div>
            <p className="footer-name">Kumari Vaishnavi </p>
            <p className="footer-role">AI & Backend Developer · B.Tech CSE</p>
          </div>
        </div>

        <div className="footer-links">
          <a href="vaishnavikumari89868@gmail.com" className="footer-link" aria-label="Email">
            <span className="footer-link-icon">✉️</span>
            <span>Email</span>
          </a>
          <a href="https://linkedin.com/in/kumari-vaishnavi-607071272" target="_blank" rel="noopener noreferrer" className="footer-link" aria-label="LinkedIn">
            <span className="footer-link-icon">💼</span>
            <span>LinkedIn</span>
          </a>
          <a href="https://github.com/Vaishnavi943" target="_blank" rel="noopener noreferrer" className="footer-link" aria-label="GitHub">
            <span className="footer-link-icon">🐙</span>
            <span>GitHub</span>
          </a>
        </div>

        <p className="footer-stack">Built with LangGraph · MCP · Groq · FastAPI · React</p>
      </div>
    </footer>
  );
}