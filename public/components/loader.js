// Fonction pour charger les composants
async function loadComponent(selector, componentPath) {
  try {
    const response = await fetch(componentPath);
    const html = await response.text();
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = html;
    }
  } catch (error) {
    console.error(`Erreur lors du chargement de ${componentPath}:`, error);
  }
}

// Charger automatiquement header et footer au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  await loadComponent('#header', '/components/header.html');
  await loadComponent('#footer', '/components/footer.html');
  
  // Initialiser AuthHeader APRÈS le chargement du header
  if (window.AuthHeader) {
    new AuthHeader();
  }
});
