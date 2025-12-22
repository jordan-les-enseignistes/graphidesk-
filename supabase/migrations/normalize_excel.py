import pandas as pd
import numpy as np
from datetime import datetime
import sys
sys.stdout.reconfigure(encoding='utf-8')

xlsx = pd.ExcelFile('SUIVI_GRAPHISTES (4).xlsx')

# Mapping des initiales vers les noms EN MAJUSCULES
# Inclut TOUS les mappings, meme les inconnus pour ne pas perdre de donnees
initiales_map = {
    'J': 'JORDAN',
    'C': 'CAROLE',
    'H': 'HUGO',
    'A': 'AUDREY',
    'JU': 'JULIETTE',
    'L': 'LAURIE',
    'G': 'GUILLAUME',
    'MA': 'MARION',
    'Q': 'QUENTIN',
    'LU': 'LUCIE',
    'P': 'PAUL',
    'F': 'FRANK',
    'JB': 'JB',
    'M': 'MICKAEL',
    'D': 'DAVID',
    'MR': 'MARIE',
    'AR': 'AR',
    'V': 'V',
    '0': '0',
    '&&&&&&&&&&': '&&&&&&&&&&',
}

graphistes_sheets = ['JORDAN', 'CAROLE', 'HUGO', 'AUDREY', 'JULIETTE', 'LAURIE', 'GUILLAUME', 'MARION', 'QUENTIN', 'LUCIE', 'PAUL', 'FRANK', 'JB', 'MICKAEL', 'DAVID', 'MARIE']

dossiers_actifs = []
dossiers_archives = []

# 1. Dossiers ACTIFS depuis les feuilles individuelles
for sheet in graphistes_sheets:
    if sheet not in xlsx.sheet_names:
        continue

    df = pd.read_excel(xlsx, sheet_name=sheet, header=None)

    if len(df.columns) > 9:
        df = df.iloc[:, :9]
    elif len(df.columns) < 9:
        for i in range(len(df.columns), 9):
            df[i] = np.nan

    df.columns = ['initiales', 'dossier', 'date_rajout', 'ddl_reponse', 'com', 'ddl_com', 'statut', 'commentaires', 'termine']
    df = df.iloc[1:]

    # Filtrer les lignes valides
    df = df[df['dossier'].notna()]
    df['dossier_str'] = df['dossier'].astype(str).str.strip()
    df = df[df['dossier_str'] != '']
    df = df[df['dossier_str'] != '-']
    df = df[df['dossier_str'].str.lower() != 'nan']
    df = df[~df['dossier_str'].str.upper().str.contains('DOSSIER', na=False)]

    if len(df) > 0:
        # Creer le format attendu: Graphiste, Nom, Date creation, Statut, Commentaires
        result = pd.DataFrame({
            'Graphiste': sheet.upper(),
            'Nom': df['dossier'],
            'Date creation': pd.to_datetime(df['date_rajout'], errors='coerce').dt.strftime('%Y-%m-%d'),
            'Statut': df['statut'].fillna('A faire'),
            'Commentaires': df['commentaires'].fillna('')
        })
        dossiers_actifs.append(result)
        print(f'{sheet}: {len(result)} dossiers actifs')

# 2. Dossiers ARCHIVES
df_archive = pd.read_excel(xlsx, sheet_name='ARCHIVE', header=None)
if len(df_archive.columns) > 9:
    df_archive = df_archive.iloc[:, :9]
elif len(df_archive.columns) < 9:
    for i in range(len(df_archive.columns), 9):
        df_archive[i] = np.nan

df_archive.columns = ['initiales', 'dossier', 'date_rajout', 'ddl_reponse', 'com', 'ddl_com', 'statut', 'commentaires', 'termine']
df_archive = df_archive.iloc[2:]

df_archive = df_archive[df_archive['dossier'].notna()]
df_archive['dossier_str'] = df_archive['dossier'].astype(str).str.strip()
df_archive = df_archive[df_archive['dossier_str'] != '']
df_archive = df_archive[df_archive['dossier_str'] != '-']
df_archive = df_archive[df_archive['dossier_str'].str.lower() != 'nan']

def map_initiales(init):
    if pd.isna(init):
        return 'INCONNU'
    init_str = str(init).strip().upper()
    # Retourner le mapping ou 'INCONNU' si pas trouve (pour ne pas perdre de donnees)
    return initiales_map.get(init_str, 'INCONNU')

df_archive['graphiste_mapped'] = df_archive['initiales'].apply(map_initiales)

# GARDER TOUS les dossiers, meme ceux avec graphiste inconnu
result_archive = pd.DataFrame({
    'Graphiste': df_archive['graphiste_mapped'],
    'Nom': df_archive['dossier'],
    'Date creation': pd.to_datetime(df_archive['date_rajout'], errors='coerce').dt.strftime('%Y-%m-%d'),
    'Statut': df_archive['statut'].fillna('A faire'),
    'Commentaires': df_archive['commentaires'].fillna('')
})

print(f'ARCHIVE: {len(result_archive)} dossiers archives (TOUS inclus)')

# 3. Combiner les actifs
if dossiers_actifs:
    df_actifs_final = pd.concat(dossiers_actifs, ignore_index=True)
else:
    df_actifs_final = pd.DataFrame(columns=['Graphiste', 'Nom', 'Date creation', 'Statut', 'Commentaires'])

# Nettoyer les commentaires
df_actifs_final['Commentaires'] = df_actifs_final['Commentaires'].astype(str).replace(['nan', 'NaN', 'None'], '')
result_archive['Commentaires'] = result_archive['Commentaires'].astype(str).replace(['nan', 'NaN', 'None'], '')

# 4. Lire les FRANCHISES depuis le fichier original
df_franchises = pd.read_excel(xlsx, sheet_name='FRANCHISES', header=None)
# Structure: Nom, Jordan, Carole, Juliette, Quentin (TRUE/FALSE)
df_franchises = df_franchises.iloc[1:]  # Skip header
df_franchises.columns = ['Vide', 'Nom', 'JORDAN', 'CAROLE', 'JULIETTE'] + list(df_franchises.columns[5:])
df_franchises = df_franchises[['Nom', 'JORDAN', 'CAROLE', 'JULIETTE']]
df_franchises = df_franchises[df_franchises['Nom'].notna()]
df_franchises = df_franchises[df_franchises['Nom'].astype(str).str.strip() != '']
df_franchises = df_franchises[~df_franchises['Nom'].astype(str).str.contains('FRANCHISE', case=False, na=False)]

print(f'FRANCHISES: {len(df_franchises)} franchises')

# 5. Lire les PROJETS depuis la feuille PROJETS_INTERNE
df_projets = pd.DataFrame(columns=['Commercial', 'Tache', 'Demande', 'Graphiste', 'Termine'])
if 'PROJETS_INTERNE' in xlsx.sheet_names:
    df_projets_raw = pd.read_excel(xlsx, sheet_name='PROJETS_INTERNE', header=None)
    if len(df_projets_raw) > 1:
        # Prendre les colonnes pertinentes
        df_projets_raw = df_projets_raw.iloc[1:]  # Skip header
        if len(df_projets_raw.columns) >= 5:
            df_projets = pd.DataFrame({
                'Commercial': df_projets_raw.iloc[:, 0],
                'Tache': df_projets_raw.iloc[:, 1],
                'Demande': df_projets_raw.iloc[:, 2] if len(df_projets_raw.columns) > 2 else '',
                'Graphiste': df_projets_raw.iloc[:, 3] if len(df_projets_raw.columns) > 3 else '',
                'Termine': df_projets_raw.iloc[:, 4] if len(df_projets_raw.columns) > 4 else 'FALSE'
            })
            df_projets = df_projets[df_projets['Tache'].notna()]
            df_projets = df_projets[df_projets['Tache'].astype(str).str.strip() != '']

print(f'PROJETS: {len(df_projets)} projets')

# 6. Sauvegarder dans le format attendu
output_file = 'SUIVI_GRAPHISTES_NORMALISE_FINAL.xlsx'

with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
    df_actifs_final.to_excel(writer, sheet_name='DOSSIERS_ACTIFS', index=False)
    result_archive.to_excel(writer, sheet_name='ARCHIVES', index=False)
    df_franchises.to_excel(writer, sheet_name='FRANCHISES', index=False)
    df_projets.to_excel(writer, sheet_name='PROJETS', index=False)

print(f'\n=== FICHIER FINAL ===')
print(f'DOSSIERS_ACTIFS: {len(df_actifs_final)} lignes')
print(f'ARCHIVES: {len(result_archive)} lignes')
print(f'FRANCHISES: {len(df_franchises)} lignes')
print(f'PROJETS: {len(df_projets)} lignes')
print(f'\nFichier sauvegarde: {output_file}')

# Resumes
print(f'\n=== DOSSIERS ACTIFS PAR GRAPHISTE ===')
print(df_actifs_final.groupby('Graphiste').size().sort_values(ascending=False))

print(f'\n=== ARCHIVES PAR GRAPHISTE ===')
print(result_archive.groupby('Graphiste').size().sort_values(ascending=False))

print(f'\n=== ECHANTILLON ACTIFS ===')
print(df_actifs_final.head(10).to_string())
