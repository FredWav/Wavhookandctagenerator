// --- Helpers sûrs ---
function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('`', '&#96;');
}

function $(id) {
  return document.getElementById(id);
}

function safeSetHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
}

function safeSetText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function validateTikTokUrl(url) {
  // Accepte formats tiktok.com, www, m, vm (liens courts de redirection)
  const pattern = /^(https?:\/\/)?((www|m|vm)\.)?tiktok\.com\/.+/i;
  return pattern.test(url);
}

function jsonOrText(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) return response.json();
  return response.text().then(t => ({ __nonJson: true, raw: t }));
}

function hideLoaderSafe() {
  try { 
    if (window.loaderInterval) clearInterval(window.loaderInterval);
    if (typeof hideLoader === 'function') hideLoader(); 
  } catch {}
}

function showLoaderSafe() {
  try { if (typeof showLoader === 'function') showLoader(); } catch {}
}

// AMÉLIORATION: Fonction pour basculer entre debug et production
function getDebugMode() {
  return localStorage.getItem('tiktok_debug') === 'true' || 
         window.location.search.includes('debug=true');
}

// AMÉLIORATION: Logging conditionnel
function debugLog(message, data) {
  if (getDebugMode()) {
    console.log(message, data);
  }
}

// --- Fonction principale corrigée ---
async function analyzeVideo(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const urlInput = $('videoUrl');
  const btn = $('analyzeBtn');
  const btnText = $('btnText');
  const results = $('results');

  const url = (urlInput?.value || '').trim();
  debugLog("🐛 DEBUG - URL entrée:", url);

  // Validation URL TikTok robuste
  if (!validateTikTokUrl(url)) {
    if (typeof showError === 'function') {
      showError('Veuillez entrer une URL TikTok valide (ex: https://www.tiktok.com/@user/video/...)');
    } else {
      safeSetHTML(results, `<div class="error-message">❌ URL TikTok invalide.</div>`);
    }
    return;
  }

  // Endpoint sécurisé (fallback pour éviter un crash si non défini)
  const endpoint = (typeof API_ENDPOINT !== 'undefined' && API_ENDPOINT) || '/api/analyze-video';
  debugLog('🚀 Démarrage analyse Framework TikTok...');
  debugLog('📡 Endpoint:', endpoint);
  debugLog('📝 Payload:', JSON.stringify({ url }));

  // État UI
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = getDebugMode() ? 'Debug en cours...' : 'Analyse...';
  showLoaderSafe();

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutMs = 30000; // AMÉLIORATION: 30s au lieu de 20s
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.time('⏱️ fetch_total');

  try {
    debugLog('🔗 Test de connectivité à l'API...');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'X-Client-Version': '1.0' // AMÉLIORATION: Header pour tracking côté serveur
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });

    console.timeEnd('⏱️ fetch_total');

    debugLog('📊 Status Response:', response.status);
    const headersObj = {};
    response.headers.forEach((v, k) => (headersObj[k] = v));
    debugLog('📋 Headers Response:', headersObj);

    const payload = await jsonOrText(response);

    if (!response.ok) {
      const errBlock = payload?.__nonJson ? payload.raw : JSON.stringify(payload, null, 2);
      console.error('❌ Erreur Response:', errBlock);

      safeSetHTML(results, `
        <div class="error-message">
          <strong>❌ Erreur HTTP ${response.status}</strong><br><br>
          <strong>Détails:</strong><br>
          <pre style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; white-space: pre-wrap; font-size: 0.9rem;">${escapeHTML(errBlock || '')}</pre>
          <br>
          <strong>🔍 Vérifications:</strong>
          <ul style="text-align: left; margin-top: 1rem;">
            <li>✅ URL TikTok: ${escapeHTML(url)}</li>
            <li>❓ Variables d'environnement configurées ?</li>
            <li>❓ API accessible ?</li>
            <li>❓ Logs serveur ?</li>
            <li>❓ CORS: Origin autorisée ?</li>
          </ul>
          ${getDebugMode() ? '' : '<p style="margin-top:1rem;"><small>💡 Ajoutez <code>?debug=true</code> à l\'URL pour plus de détails</small></p>'}
        </div>
      `);
      return;
    }

    // Si la réponse n'était pas JSON, on l'affiche quand même
    if (payload?.__nonJson) {
      console.warn('⚠️ Réponse non-JSON reçue, affichage brut.');
      safeSetHTML(results, `
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px;">
          <h3 style="margin-top:0">🐛 DEBUG - Réponse non-JSON</h3>
          <pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; white-space: pre-wrap; font-size: 0.85rem; max-height: 400px; overflow-y: auto;">${escapeHTML(payload.raw || '')}</pre>
        </div>
      `);
      return;
    }

    const data = payload;
    debugLog('✅ Data reçue:', data);

    // Diagnostic détaillé (console)
    debugLog('🔍 DIAGNOSTIC DÉTAILLÉ:');
    debugLog('- Success:', data?.success);
    debugLog('- Analysis ID:', data?.analysisId);
    debugLog('- Features:', data?.metadata?.features);
    debugLog('- Processing Time:', data?.metadata?.processingTime);
    debugLog('- oEmbed Data:', !!data?.video?.thumbnail);
    debugLog('- Stats Data:', !!data?.stats);
    debugLog('- OpenAI Analysis:', !!data?.analysis?.openai);

    if (!data?.success) {
      console.error('❌ API Success = false');
      if (typeof showError === 'function') {
        showError(data?.error || 'Échec de l'analyse sans détails');
      } else {
        safeSetHTML(results, `<div class="error-message">❌ ${escapeHTML(data?.error || 'Échec de l'analyse sans détails')}</div>`);
      }
      return;
    }

    // AMÉLIORATION: Si on n'est pas en mode debug, utiliser la fonction d'affichage normale
    if (!getDebugMode() && typeof showResults === 'function') {
      showResults(data);
      return;
    }

    // MODE DEBUG: Affichage détaillé
    // Prépare valeurs affichées (échappées)
    const features = data?.metadata?.features || {};
    const author = data?.video?.author ? escapeHTML(data.video.author) : 'Non disponible';
    const desc = data?.video?.description ? escapeHTML(String(data.video.description).slice(0, 100)) + '…' : 'Non disponible';
    const views = data?.stats?.formatted?.views ? escapeHTML(String(data.stats.formatted.views)) : 'Non disponible';
    const score = (typeof data?.analysis?.score === 'number') ? String(data.analysis.score) : 'Non calculé';
    const potentiel = data?.analysis?.potentiel_viral ? escapeHTML(String(data.analysis.potentiel_viral)) : 'Non évalué';

    // Rendons la réponse complète dans un <pre> via textContent pour zéro injection
    const fullPre = document.createElement('pre');
    fullPre.style.background = 'rgba(0,0,0,0.3)';
    fullPre.style.padding = '1rem';
    fullPre.style.borderRadius = '8px';
    fullPre.style.whiteSpace = 'pre-wrap';
    fullPre.style.fontSize = '0.8rem';
    fullPre.style.marginTop = '1rem';
    fullPre.style.maxHeight = '400px';
    fullPre.style.overflowY = 'auto';
    fullPre.textContent = JSON.stringify(data, null, 2);

    // Bloc principal (sécurisé)
    const container = document.createElement('div');
    container.style.background = 'rgba(0,255,0,0.1)';
    container.style.border = '1px solid rgba(0,255,0,0.3)';
    container.style.padding = '1.5rem';
    container.style.borderRadius = '12px';
    container.innerHTML = `
      <h3 style="color: #10b981; margin-top: 0;">🐛 DEBUG - Analyse réussie !</h3>

      <div style="display: grid; gap: 1rem; margin: 1rem 0;">
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
          <h4>📊 État des fonctionnalités</h4>
          <ul style="margin: 0; text-align: left;">
            <li>${features.hasOembedData ? '✅' : '❌'} oEmbed Data</li>
            <li>${features.hasScrapingData ? '✅' : '❌'} Stats TikTok</li>
            <li>${features.hasOpenAIAnalysis ? '✅' : '❌'} Analyse IA</li>
            <li>${features.scrapingbee_configured ? '✅' : '❌'} ScrapingBee configuré</li>
            <li>${features.openai_configured ? '✅' : '❌'} OpenAI configuré</li>
          </ul>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
          <h4>📈 Données extraites</h4>
          <ul style="margin: 0; text-align: left;">
            <li><strong>Auteur:</strong> ${author}</li>
            <li><strong>Description:</strong> ${desc}</li>
            <li><strong>Vues:</strong> ${views}</li>
            <li><strong>Score:</strong> ${escapeHTML(score)}/100</li>
            <li><strong>Potentiel:</strong> ${potentiel}</li>
          </ul>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
          <h4>⚡ Performance</h4>
          <ul style="margin: 0; text-align: left;">
            <li><strong>Temps de traitement:</strong> ${escapeHTML(String(data?.metadata?.processingTime || 'Non mesuré'))}</li>
            <li><strong>Analysis ID:</strong> ${escapeHTML(String(data?.analysisId || 'Non généré'))}</li>
            <li><strong>Framework Version:</strong> ${escapeHTML(String(data?.metadata?.frameworkVersion || 'Non spécifiée'))}</li>
          </ul>
        </div>
      </div>

      <details style="margin-top: 1rem;">
        <summary style="cursor: pointer; color: var(--accent);">🔍 Voir la réponse complète</summary>
      </details>
      
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(59,130,246,0.1); border-radius: 8px; border-left: 4px solid #3b82f6;">
        <strong>🔧 Mode Debug activé</strong><br>
        <small>Pour désactiver, supprimez <code>?debug=true</code> de l'URL ou tapez <code>localStorage.removeItem('tiktok_debug')</code> dans la console.</small>
      </div>
    `;

    safeSetHTML(results, '');
    if (results) {
      results.appendChild(container);
      const details = container.querySelector('details');
      if (details) details.appendChild(fullPre);
    }

  } catch (error) {
    console.error('❌ Erreur catch:', error);

    const isAbort = error?.name === 'AbortError';
    safeSetHTML(results, `
      <div class="error-message">
        <strong>❌ ${isAbort ? 'Délai dépassé (timeout)' : 'Erreur de connexion'}</strong>
        <br><br>
        <strong>Type:</strong> ${escapeHTML(error?.name || 'Error')}<br>
        <strong>Message:</strong> ${escapeHTML(error?.message || 'Aucun message')}<br>
        <br>
        <strong>🔍 Causes possibles:</strong>
        <ul style="text-align: left; margin-top: 1rem;">
          <li>❓ Serveur non démarré</li>
          <li>❓ Port incorrect</li>
          <li>❓ CORS bloqué</li>
          <li>❓ Endpoint inexistant</li>
          <li>⏳ Réponse trop lente (&gt; ${timeoutMs/1000}s)</li>
        </ul>

        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <strong>💡 Actions à vérifier:</strong><br>
          1. Ouvrez la console navigateur (F12)<br>
          2. Vérifiez l'onglet Network (status, CORS, payload)<br>
          3. Regardez les logs serveur<br>
          4. Testez l'endpoint manuellement (curl/Postman)<br>
        </div>
      </div>
    `);
  } finally {
    clearTimeout(timeoutId);
    hideLoaderSafe();
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Analyser';
  }
}

// AMÉLIORATION: Fonction pour activer/désactiver le debug facilement
function toggleDebugMode() {
  const current = getDebugMode();
  if (current) {
    localStorage.removeItem('tiktok_debug');
    console.log('🐛 Mode debug désactivé');
  } else {
    localStorage.setItem('tiktok_debug', 'true');
    console.log('🐛 Mode debug activé');
  }
  return !current;
}
