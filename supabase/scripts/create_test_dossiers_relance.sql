-- Script pour créer des dossiers de test pour vérifier la fonctionnalité "À relancer"
-- ATTENTION: À exécuter uniquement en environnement de test !

-- Récupérer l'ID d'un graphiste existant (ou utiliser un ID spécifique)
DO $$
DECLARE
    v_graphiste_id uuid;
BEGIN
    -- Récupérer le premier graphiste actif
    SELECT id INTO v_graphiste_id FROM profiles WHERE is_active = true LIMIT 1;

    IF v_graphiste_id IS NULL THEN
        RAISE EXCEPTION 'Aucun graphiste actif trouvé';
    END IF;

    -- 1. Dossier en "Attente R." depuis 10 jours (devrait apparaître dans "À relancer")
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - Attente depuis 10 jours',
        v_graphiste_id,
        'Attente R.',
        CURRENT_DATE - INTERVAL '15 days',
        CURRENT_TIMESTAMP - INTERVAL '10 days'
    );

    -- 2. Dossier en "Attente R." depuis 3 jours (ne devrait PAS apparaître - moins de 7 jours)
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - Attente depuis 3 jours',
        v_graphiste_id,
        'Attente R.',
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_TIMESTAMP - INTERVAL '3 days'
    );

    -- 3. Dossier avec statut "À relancer" explicite (devrait apparaître)
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - Statut À relancer',
        v_graphiste_id,
        'À relancer',
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_TIMESTAMP - INTERVAL '2 days'
    );

    -- 4. Dossier en "Mairie" depuis 10 jours (ne devrait PAS apparaître - statut différent)
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - Mairie depuis 10 jours',
        v_graphiste_id,
        'Mairie',
        CURRENT_DATE - INTERVAL '15 days',
        CURRENT_TIMESTAMP - INTERVAL '10 days'
    );

    -- 5. Dossier "A faire" ancien (pour tester la priorité dans "À traiter")
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - A faire ancien',
        v_graphiste_id,
        'A faire',
        CURRENT_DATE - INTERVAL '20 days',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    );

    -- 6. Dossier "! Urgent !" (pour tester la priorité)
    INSERT INTO dossiers (nom, graphiste_id, statut, date_creation, updated_at)
    VALUES (
        'TEST - Urgent récent',
        v_graphiste_id,
        '! Urgent !',
        CURRENT_DATE - INTERVAL '2 days',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    );

    RAISE NOTICE 'Dossiers de test créés avec succès pour le graphiste %', v_graphiste_id;
END $$;

-- Pour supprimer les dossiers de test après vérification :
-- DELETE FROM dossiers WHERE nom LIKE 'TEST -%';
