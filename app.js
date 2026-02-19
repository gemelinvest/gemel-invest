(() => {
  const collapseBtn = document.getElementById('collapseBtn');
  const menuBtn = document.getElementById('menuBtn');
  const mailBadge = document.getElementById('mailBadge');

  function toggleCollapsed() {
    document.body.classList.toggle('sb-collapsed');
    const app = document.querySelector('.app');
    const collapsed = document.body.classList.contains('sb-collapsed');
    app.style.gridTemplateColumns = collapsed ? '72px 1fr' : '280px 1fr';
  }

  collapseBtn?.addEventListener('click', toggleCollapsed);
  menuBtn?.addEventListener('click', toggleCollapsed);

  // Demo: decrement badge on click to simulate "read mail"
  mailBadge?.addEventListener('click', () => {
    const n = Math.max(0, (parseInt(mailBadge.textContent || '0', 10) || 0) - 1);
    mailBadge.textContent = String(n);
    if (n === 0) mailBadge.style.display = 'none';
  });
})();
