// Intégration Lemonfox.ai Whisper pour ViralScope Pro
// Transcription audio avec Lemonfox.ai API

async function transcribeAudioWithLemonfox(videoUrl, lemonfoxApiKey) {
    if (!lemonfoxApiKey || !videoUrl) {
        console.warn("⚠️ ViralScope: Clé Lemonfox ou URL vidéo manquante");
        return null;
    }

    try {
        console.log("🍋 ViralScope: Transcription audio via Lemonfox.ai...");
        
        // Étape 1: Télécharger la vidéo TikTok
        console.log("📥 Téléchargement de la vidéo...");
        const videoResponse = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/'
            },
            signal: AbortSignal.timeout(30000)
        });

        if (!videoResponse.ok) {
            throw new Error(`Échec téléchargement vidéo: ${videoResponse.status}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        console.log(`✅ Vidéo téléchargée: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // Étape 2: Préparer le FormData pour Lemonfox
        const formData = new FormData();
        
        // Lemonfox accepte les vidéos directement
        const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
        formData.append('file', videoBlob, 'tiktok_video.mp4');
        
        // Paramètres Lemonfox pour optimiser la transcription TikTok
        formData.append('language', 'auto'); // Détection automatique
        formData.append('model', 'whisper-large-v3'); // Meilleur modèle
        formData.append('response_format', 'verbose_json');
        formData.append('temperature', '0.2'); // Plus précis
        formData.append('timestamp_granularities[]', 'word'); // Timestamps au niveau mot
        formData.append('timestamp_granularities[]', 'segment'); // Timestamps au niveau phrase

        // Étape 3: Appel à l'API Lemonfox
        console.log("🔄 Envoi à Lemonfox.ai API...");
        const lemonfoxResponse = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lemonfoxApiKey}`,
                'User-Agent': 'ViralScope-Pro/1.0'
            },
            body: formData,
            signal: AbortSignal.timeout(120000) // 2 minutes pour la transcription
        });

        if (!lemonfoxResponse.ok) {
            const errorText = await lemonfoxResponse.text();
            console.error(`❌ Lemonfox API error: ${errorText}`);
            throw new Error(`Lemonfox API error ${lemonfoxResponse.status}: ${errorText}`);
        }

        const transcriptionData = await lemonfoxResponse.json();
        console.log("✅ ViralScope: Transcription Lemonfox complétée");

        // Étape 4: Traitement et enrichissement des données Lemonfox
        const enrichedAnalysis = await enrichLemonfoxTranscription(transcriptionData);

        return {
            // Données brutes Lemonfox
            transcription: transcriptionData.text || '',
            langue: transcriptionData.language || 'auto',
            duree: transcriptionData.duration || null,
            
            // Données enrichies avec timestamps
            segments: transcriptionData.segments || [],
            words: transcriptionData.words || [],
            
            // Métriques de qualité Lemonfox
            confidence: calculateLemonfoxConfidence(transcriptionData),
            quality_score: assessLemonfoxQuality(transcriptionData),
            
            // Analyse enrichie ViralScope
            sentiment: enrichedAnalysis.sentiment,
            topics: enrichedAnalysis.topics,
            emotions: enrichedAnalysis.emotions,
            keywords: enrichedAnalysis.keywords,
            viral_words: enrichedAnalysis.viral_words,
            speech_patterns: enrichedAnalysis.speech_patterns,
            hooks_detected: enrichedAnalysis.hooks_detected,
            cta_detected: enrichedAnalysis.cta_detected,
            
            // Insights ViralScope spécifiques
            viralscope_insights: enrichedAnalysis.viralscope_insights,
            audio_optimization: enrichedAnalysis.audio_optimization,
            
            // Métadonnées
            provider: 'Lemonfox.ai',
            model_used: 'whisper-large-v3',
            processed_at: new Date().toISOString()
        };

    } catch (error) {
        console.error("❌ ViralScope: Erreur transcription Lemonfox:", error.message);
        
        // Log pour debugging
        console.log("🔍 Debug info:", {
            videoUrl: videoUrl ? 'présente' : 'manquante',
            apiKey: lemonfoxApiKey ? 'présente' : 'manquante',
            error: error.message
        });
        
        return null;
    }
}

// Calcul de la confiance Lemonfox
function calculateLemonfoxConfidence(transcriptionData) {
    if (!transcriptionData.segments || transcriptionData.segments.length === 0) {
        return 0;
    }
    
    // Lemonfox fournit des scores de confiance par segment
    const confidenceScores = transcriptionData.segments
        .map(segment => segment.avg_logprob || segment.confidence || 0)
        .filter(score => score !== 0);
    
    if (confidenceScores.length === 0) return 0.5; // Défaut
    
    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    
    // Conversion en pourcentage (Lemonfox utilise des log probabilities)
    if (avgConfidence < 0) {
        // Log probability -> confidence score
        return Math.max(0, Math.min(1, Math.exp(avgConfidence)));
    }
    
    // Déjà un score de confiance
    return Math.max(0, Math.min(1, avgConfidence));
}

// Évaluation de la qualité Lemonfox
function assessLemonfoxQuality(transcriptionData) {
    let qualityScore = 100;
    
    const text = transcriptionData.text || '';
    const segments = transcriptionData.segments || [];
    
    // Pénalités basées sur la qualité Lemonfox
    if (text.length < 10) qualityScore -= 40; // Trop court
    if (segments.length === 0) qualityScore -= 30; // Pas de segmentation
    
    // Détection de problèmes dans la transcription
    const problematicPatterns = [
        /\[.*?\]/g, // Texte entre crochets (sons non verbaux)
        /\(.*?\)/g, // Texte entre parenthèses
        /\.{3,}/g,  // Points de suspension multiples
        /\s{3,}/g   // Espaces multiples
    ];
    
    problematicPatterns.forEach(pattern => {
        const matches = (text.match(pattern) || []).length;
        qualityScore -= matches * 5;
    });
    
    // Bonus pour les timestamps précis
    if (transcriptionData.words && transcriptionData.words.length > 0) {
        qualityScore += 10; // Bonus timestamps au niveau mot
    }
    
    return Math.max(0, Math.min(100, qualityScore));
}

// Enrichissement spécialisé pour les données Lemonfox
async function enrichLemonfoxTranscription(transcriptionData) {
    const text = transcriptionData.text || '';
    const segments = transcriptionData.segments || [];
    const words = transcriptionData.words || [];
    
    if (!text || text.trim().length === 0) {
        return getEmptyAnalysis();
    }

    console.log("🔍 ViralScope: Enrichissement de la transcription Lemonfox...");
    
    // Analyse temporelle avancée avec les segments Lemonfox
    const temporalAnalysis = analyzeTemporalPatterns(segments, words);
    
    // Détection de hooks avec timestamps précis
    const hooksDetected = detectHooksWithTimestamps(segments, text);
    
    // Détection de CTAs avec position temporelle
    const ctaDetected = detectCTAsWithTimestamps(segments, text);
    
    // Analyse de la qualité de la parole
    const speechPatterns = analyzeSpeechPatterns(segments, words);
    
    // Sentiment avec analyse temporelle
    const sentiment = analyzeSentimentTemporal(segments);
    
    // Topics avec pondération temporelle
    const topics = extractTopicsWithWeight(text, segments);
    
    // Émotions par segment
    const emotions = detectEmotionsBySegment(segments);
    
    // Mots-clés avec fréquence et position
    const keywords = extractKeywordsWithPosition(text, words);
    
    // Mots viraux avec timing
    const viralWords = detectViralWordsWithTiming(text, segments);
    
    // Insights ViralScope spécialisés
    const viralScopeInsights = generateViralScopeAudioInsights(
        text, segments, words, sentiment, topics, emotions, hooksDetected, ctaDetected
    );
    
    // Recommandations d'optimisation audio
    const audioOptimization = generateAudioOptimizationTips(
        speechPatterns, temporalAnalysis, hooksDetected, ctaDetected
    );

    return {
        sentiment,
        topics,
        emotions,
        keywords,
        viral_words: viralWords,
        speech_patterns: speechPatterns,
        hooks_detected: hooksDetected,
        cta_detected: ctaDetected,
        temporal_analysis: temporalAnalysis,
        viralscope_insights: viralScopeInsights,
        audio_optimization: audioOptimization
    };
}

// Analyse des patterns temporels
function analyzeTemporalPatterns(segments, words) {
    if (!segments || segments.length === 0) return null;
    
    const totalDuration = segments[segments.length - 1]?.end || 0;
    const avgSegmentDuration = totalDuration / segments.length;
    
    // Calcul du débit de parole
    const totalWords = words.length || segments.reduce((sum, seg) => sum + (seg.text?.split(' ').length || 0), 0);
    const wordsPerMinute = totalDuration > 0 ? (totalWords / totalDuration) * 60 : 0;
    
    // Détection de pauses
    const pauses = [];
    for (let i = 1; i < segments.length; i++) {
        const gap = segments[i].start - segments[i-1].end;
        if (gap > 0.5) { // Pause de plus de 0.5 seconde
            pauses.push({
                start: segments[i-1].end,
                end: segments[i].start,
                duration: gap
            });
        }
    }
    
    return {
        total_duration: totalDuration,
        segments_count: segments.length,
        avg_segment_duration: avgSegmentDuration,
        words_per_minute: wordsPerMinute,
        pauses: pauses,
        speech_rhythm: wordsPerMinute > 150 ? 'rapide' : wordsPerMinute > 120 ? 'normal' : 'lent'
    };
}

// Détection de hooks avec timestamps
function detectHooksWithTimestamps(segments, text) {
    const hooks = [];
    
    const hookPatterns = [
        { pattern: /^(pourquoi|comment|qui|que|quoi|où|quand)/i, type: 'question', priority: 'high' },
        { pattern: /(secret|astuce|méthode|technique)/i, type: 'secret', priority: 'high' },
        { pattern: /(incroyable|choc|fou|dingue)/i, type: 'emotion', priority: 'medium' },
        { pattern: /^\d+/i, type: 'number', priority: 'medium' },
        { pattern: /(personne ne|jamais|interdit)/i, type: 'controversial', priority: 'high' }
    ];
    
    segments.forEach((segment, index) => {
        const segmentText = segment.text || '';
        
        hookPatterns.forEach(({ pattern, type, priority }) => {
            if (pattern.test(segmentText)) {
                hooks.push({
                    type: type,
                    text: segmentText.trim(),
                    start_time: segment.start,
                    end_time: segment.end,
                    segment_index: index,
                    priority: priority,
                    confidence: segment.avg_logprob || 0.8
                });
            }
        });
    });
    
    return hooks;
}

// Détection de CTAs avec timestamps
function detectCTAsWithTimestamps(segments, text) {
    const ctas = [];
    
    const ctaPatterns = [
        { pattern: /(abonne|follow|s'abonner)/i, type: 'subscribe', action: 'subscription' },
        { pattern: /(like|j'aime|double.*tap)/i, type: 'like', action: 'engagement' },
        { pattern: /(commente|commentaire|dis.*moi)/i, type: 'comment', action: 'engagement' },
        { pattern: /(partage|share|montre)/i, type: 'share', action: 'viral' },
        { pattern: /(sauvegarde|enregistre|garde)/i, type: 'save', action: 'retention' }
    ];
    
    segments.forEach((segment, index) => {
        const segmentText = segment.text || '';
        
        ctaPatterns.forEach(({ pattern, type, action }) => {
            if (pattern.test(segmentText)) {
                ctas.push({
                    type: type,
                    action: action,
                    text: segmentText.trim(),
                    start_time: segment.start,
                    end_time: segment.end,
                    segment_index: index,
                    effectiveness: calculateCTAEffectiveness(type, segment.start, segments.length)
                });
            }
        });
    });
    
    return ctas;
}

// Calcul de l'efficacité des CTAs selon leur position
function calculateCTAEffectiveness(ctaType, startTime, totalSegments) {
    const weights = {
        'subscribe': { early: 0.3, middle: 0.5, end: 0.9 },
        'like': { early: 0.8, middle: 0.9, end: 0.7 },
        'comment': { early: 0.6, middle: 0.8, end: 0.9 },
        'share': { early: 0.4, middle: 0.7, end: 0.8 },
        'save': { early: 0.5, middle: 0.6, end: 0.9 }
    };
    
    const position = startTime < 5 ? 'early' : startTime > 30 ? 'end' : 'middle';
    return weights[ctaType]?.[position] || 0.5;
}

// Analyse des patterns de parole
function analyzeSpeechPatterns(segments, words) {
    if (!segments || segments.length === 0) return null;
    
    // Analyse des répétitions
    const wordFreq = {};
    words.forEach(word => {
        const cleanWord = word.word?.toLowerCase().replace(/[^\w]/g, '') || '';
        if (cleanWord.length > 2) {
            wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
        }
    });
    
    const repetitions = Object.entries(wordFreq)
        .filter(([word, count]) => count > 2)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    // Détection de mots de remplissage
    const fillerWords = ['euh', 'hum', 'alors', 'donc', 'voilà', 'quoi', 'ben'];
    const fillerCount = fillerWords.reduce((count, filler) => {
        return count + (wordFreq[filler] || 0);
    }, 0);
    
    // Analyse de la fluidité
    const avgConfidence = segments.reduce((sum, seg) => sum + (seg.avg_logprob || 0), 0) / segments.length;
    
    return {
        repetitions: repetitions,
        filler_words_count: fillerCount,
        fluency_score: Math.max(0, Math.min(100, (avgConfidence + 5) * 10)), // Conversion log prob
        speech_clarity: avgConfidence > -0.5 ? 'excellente' : avgConfidence > -1 ? 'bonne' : 'moyenne',
        vocabulary_richness: Object.keys(wordFreq).length / (words.length || 1)
    };
}

// Génération d'insights ViralScope spécifiques
function generateViralScopeAudioInsights(text, segments, words, sentiment, topics, emotions, hooks, ctas) {
    const insights = [];
    
    // Analyse de la durée
    const totalDuration = segments[segments.length - 1]?.end || 0;
    if (totalDuration < 10) {
        insights.push("⚠️ Contenu audio très court - Ajouter plus de contenu pour maximiser l'engagement");
    } else if (totalDuration > 60) {
        insights.push("📏 Contenu audio long - Risque de perte d'attention, considérer un montage plus serré");
    } else {
        insights.push(`✅ Durée audio optimale (${totalDuration.toFixed(1)}s) pour TikTok`);
    }
    
    // Analyse des hooks
    if (hooks.length > 0) {
        const earlyHooks = hooks.filter(h => h.start_time < 5);
        if (earlyHooks.length > 0) {
            insights.push(`🎣 Hook efficace détecté dans les premières secondes: "${earlyHooks[0].text}"`);
        } else {
            insights.push("⏰ Hook détecté mais tardif - Déplacer l'accroche au début pour maximum d'impact");
        }
    } else {
        insights.push("❌ Aucun hook audio détecté - Ajouter une accroche verbale forte au début");
    }
    
    // Analyse des CTAs
    if (ctas.length > 0) {
        const bestCTA = ctas.sort((a, b) => b.effectiveness - a.effectiveness)[0];
        insights.push(`📢 CTA optimal détecté: "${bestCTA.text}" (efficacité: ${(bestCTA.effectiveness * 100).toFixed(0)}%)`);
    } else {
        insights.push("📢 Aucun appel à l'action verbal - Ajouter un CTA clair pour booster l'engagement");
    }
    
    // Analyse du sentiment
    if (sentiment === 'très positif' || sentiment === 'positif') {
        insights.push("😊 Énergie positive détectée - Excellent pour la viralité et l'engagement");
    } else if (sentiment === 'neutre') {
        insights.push("😐 Ton neutre - Ajouter plus d'émotion pour captiver l'audience");
    }
    
    // Analyse des topics
    if (topics.length > 0) {
        insights.push(`🎯 Thématiques claires: ${topics.slice(0, 2).join(', ')} - Bon pour le ciblage algorithme`);
    } else {
        insights.push("❓ Sujet peu défini - Clarifier la thématique pour améliorer la découvrabilité");
    }
    
    return insights;
}

// Conseils d'optimisation audio
function generateAudioOptimizationTips(speechPatterns, temporalAnalysis, hooks, ctas) {
    const tips = [];
    
    // Optimisation du débit
    if (temporalAnalysis?.words_per_minute > 180) {
        tips.push("🚨 Débit trop rapide - Ralentir pour améliorer la compréhension");
    } else if (temporalAnalysis?.words_per_minute < 120) {
        tips.push("🐌 Débit lent - Accélérer légèrement pour maintenir l'attention");
    } else {
        tips.push("✅ Débit de parole optimal pour TikTok");
    }
    
    // Optimisation de la clarté
    if (speechPatterns?.filler_words_count > 3) {
        tips.push("🗣️ Réduire les mots de remplissage ('euh', 'alors') pour plus de professionnalisme");
    }
    
    // Optimisation des hooks
    if (hooks.length === 0) {
        tips.push("🎣 Ajouter une phrase d'accroche forte dans les 3 premières secondes");
    }
    
    // Optimisation des pauses
    if (temporalAnalysis?.pauses?.length > 5) {
        tips.push("✂️ Réduire les pauses longues en post-production pour maintenir le rythme");
    }
    
    // Optimisation globale
    tips.push("🎵 Synchroniser la voix avec la musique pour créer un rythme engageant");
    tips.push("🔊 Vérifier que l'audio est audible même sans casque");
    
    return tips;
}

// Fonction vide pour les cas d'échec
function getEmptyAnalysis() {
    return {
        sentiment: 'non analysé',
        topics: [],
        emotions: [],
        keywords: [],
        viral_words: [],
        speech_patterns: null,
        hooks_detected: [],
        cta_detected: [],
        temporal_analysis: null,
        viralscope_insights: ['❌ Échec de la transcription audio'],
        audio_optimization: ['🔧 Vérifier la qualité audio de la vidéo']
    };
}

// Export de la fonction principale pour l'intégration
export { transcribeAudioWithLemonfox };
