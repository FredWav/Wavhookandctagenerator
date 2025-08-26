const fs = require('fs');
const path = require('path');

function removeJSCommentsCarefully(jsCode) {
  // Préserver les URLs qui contiennent // (comme https://)
  // et les regex qui contiennent des //
  
  let result = jsCode;
  
  // 1. Supprimer les commentaires /* ... */ (multilignes)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 2. Supprimer les commentaires // mais PAS dans les strings et URLs
  result = result.replace(/(?:^|[^\\])\/\/(?![^"]*"[^"]*(?:"[^"]*"[^"]*)*$)(?![^']*'[^']*(?:'[^']*'[^']*)*$)(?![^`]*`[^`]*(?:`[^`]*`[^`]*)*$).*$/gm, '');
  
  // Version plus sûre pour les commentaires //
  const lines = result.split('\n');
  const cleanLines = lines.map(line => {
    // Ignorer les lignes qui contiennent des URLs ou des strings avec //
    if (line.includes('http://') || 
        line.includes('https://') || 
        line.includes('://') ||
        /["'`].*\/\/.*["'`]/.test(line)) {
      return line;
    }
    
    // Supprimer les commentaires // en fin de ligne
    return line.replace(/\s*\/\/.*$/, '');
  });
  
  return cleanLines.join('\n');
}

function minifyHTMLAndCleanJS(htmlContent) {
  // Extraire et traiter les scripts JavaScript
  const scripts = [];
  let scriptIndex = 0;
  
  // Remplacer temporairement les scripts par des placeholders
  let processedHTML = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
    const placeholder = `__SCRIPT_PLACEHOLDER_${scriptIndex}__`;
    
    // Extraire le contenu du script
    const scriptMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch && scriptMatch[1]) {
      const scriptContent = scriptMatch[1];
      
      // Nettoyer les commentaires du JavaScript
      const cleanedJS = removeJSCommentsCarefully(scriptContent);
      
      // Reconstruire la balise script avec le JS nettoyé
      const cleanedScript = match.replace(scriptContent, cleanedJS);
      scripts[scriptIndex] = cleanedScript;
    } else {
      // Script externe ou vide, garder tel quel
      scripts[scriptIndex] = match;
    }
    
    scriptIndex++;
    return placeholder;
  });
  
  // Minifier le HTML (sans les scripts)
  processedHTML = processedHTML
    // Supprimer commentaires HTML
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    
    // Minifier HTML sur une ligne
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s*=\s*/g, '=')
    .replace(/:\s+/g, ':')
    .replace(/{\s+/g, '{')
    .replace(/}\s+/g, '}')
    .replace(/\s+{/g, '{')
    .replace(/\s+}/g, '}')
    .replace(/;\s+/g, ';')
    .replace(/,\s+/g, ',')
    .replace(/;\s*}/g, '}')
    .trim()
    .replace(/\s+\/>/g, '/>')
    .replace(/\s+>/g, '>');
  
  // Restaurer les scripts JavaScript (maintenant nettoyés)
  scripts.forEach((script, index) => {
    const placeholder = `__SCRIPT_PLACEHOLDER_${index}__`;
    processedHTML = processedHTML.replace(placeholder, script);
  });
  
  return processedHTML;
}

function advancedMinifyHTMLAndJS(htmlContent) {
  // Version plus agressive
  const scripts = [];
  let scriptIndex = 0;
  
  let processedHTML = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
    const placeholder = `__JS_${scriptIndex}__`;
    
    const scriptMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch && scriptMatch[1]) {
      let scriptContent = scriptMatch[1];
      
      // Nettoyer les commentaires JS de façon sécurisée
      scriptContent = removeJSCommentsCarefully(scriptContent);
      
      // Minification légère du JS (préserver la lisibilité)
      scriptContent = scriptContent
        .replace(/\s+/g, ' ')           // Espaces multiples → un seul
        .replace(/\s*{\s*/g, '{')       // Espaces autour des {
        .replace(/\s*}\s*/g, '}')       // Espaces autour des }
        .replace(/\s*;\s*/g, ';')       // Espaces autour des ;
        .replace(/\s*,\s*/g, ',')       // Espaces autour des ,
        .replace(/\s*:\s*/g, ':')       // Espaces autour des :
        .replace(/\s*=\s*/g, '=')       // Espaces autour des =
        .trim();
      
      const cleanedScript = match.replace(scriptMatch[1], scriptContent);
      scripts[scriptIndex] = cleanedScript;
    } else {
      scripts[scriptIndex] = match;
    }
    
    scriptIndex++;
    return placeholder;
  });
  
  // Minification ultra du HTML
  processedHTML = processedHTML
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s*=\s*/g, '=')
    .replace(/="([a-zA-Z0-9-_]+)"/g, '=$1')  // Supprimer guillemets optionnels
    .replace(/\s+type=["']?text\/css["']?/g, '')
    .replace(/\s+type=["']?text\/javascript["']?/g, '')
    .trim();
  
  // Restaurer les scripts nettoyés
  scripts.forEach((script, index) => {
    processedHTML = processedHTML.replace(`__JS_${index}__`, script);
  });
  
  return processedHTML;
}

function processFile(inputPath, outputPath, method = 'standard') {
  try {
    const htmlContent = fs.readFileSync(inputPath, 'utf8');
    
    let processed;
    if (method === 'advanced') {
      processed = advancedMinifyHTMLAndJS(htmlContent);
    } else {
      processed = minifyHTMLAndCleanJS(htmlContent);
    }
    
    fs.writeFileSync(outputPath, processed, 'utf8');
    
    const originalSize = Buffer.byteLength(htmlContent, 'utf8');
    const processedSize = Buffer.byteLength(processed, 'utf8');
    const savings = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
    
    console.log(`✅ ${path.basename(inputPath)}`);
    console.log(`   📦 ${originalSize} → ${processedSize} bytes (${savings}% économisé)`);
    console.log(`   📝 ${htmlContent.split('\n').length} → 1 ligne`);
    console.log(`   🧹 Commentaires JS supprimés, URLs préservées`);
    
  } catch (error) {
    console.error(`❌ Erreur ${inputPath}:`, error.message);
  }
}

function processAllFiles() {
  const sourceDir = './pages';
  const methods = ['standard', 'advanced'];
  
  methods.forEach(method => {
    const targetDir = `./pages-clean-js-${method}`;
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }
    
    const htmlFiles = fs.readdirSync(sourceDir)
      .filter(file => file.endsWith('.html'));
    
    console.log(`\n🧹 Nettoyage ${method} (commentaires JS supprimés) de ${htmlFiles.length} fichiers...`);
    console.log('═'.repeat(70));
    
    htmlFiles.forEach(filename => {
      const inputPath = path.join(sourceDir, filename);
      const outputPath = path.join(targetDir, filename);
      processFile(inputPath, outputPath, method);
    });
    
    console.log(`📁 Résultats dans: ${targetDir}`);
  });
  
  console.log('\n🎉 Nettoyage terminé ! HTML minifié, commentaires JS supprimés, URLs intactes !');
}

// Version simple
function quickCleanMinify() {
  const sourceDir = './pages';
  const targetDir = './pages-clean-comments';
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }
  
  const htmlFiles = fs.readdirSync(sourceDir)
    .filter(file => file.endsWith('.html'));
  
  console.log(`🧹 Nettoyage rapide (suppression commentaires JS) de ${htmlFiles.length} fichiers...`);
  
  htmlFiles.forEach(filename => {
    const inputPath = path.join(sourceDir, filename);
    const outputPath = path.join(targetDir, filename);
    
    const htmlContent = fs.readFileSync(inputPath, 'utf8');
    const cleaned = minifyHTMLAndCleanJS(htmlContent);
    
    fs.writeFileSync(outputPath, cleaned, 'utf8');
    console.log(`✅ ${filename} → Commentaires JS supprimés`);
  });
  
  console.log('🎉 Terminé ! HTML illisible, JS nettoyé mais fonctionnel !');
}

// Test de la fonction de suppression des commentaires
function testCommentRemoval() {
  const testJS = `
    // Ceci est un commentaire à supprimer
    const url = "https://example.com//path"; // URL à préserver
    function test() {
      console.log("//test dans string"); // Commentaire à supprimer
      /* Commentaire 
         multilignes */
      return url + "//more//path";
    }
    // Autre commentaire
  `;
  
  console.log('🧪 Test de suppression des commentaires:');
  console.log('AVANT:', testJS);
  console.log('APRÈS:', removeJSCommentsCarefully(testJS));
}

// Lancer le processus
console.log('🧹 NETTOYEUR HTML + JS (Commentaires supprimés, URLs préservées)');
console.log('═'.repeat(70));

// Choisissez votre méthode :
processAllFiles();    // Méthode complète
// quickCleanMinify(); // Méthode rapide
// testCommentRemoval(); // Test de la fonction
