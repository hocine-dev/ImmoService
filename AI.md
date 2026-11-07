# AI.md — Retour critique sur l'utilisation de l'IA

## Utilisation de l'IA

nous avons utilisé l'IA comme aide au développement, notamment pour générer certaines fonctions, organiser les services et proposer des validations. Nous avons ensuite revu et corrigé le code pendant l'intégration avec le reste du projet.

## Quatre erreurs rencontrées

**1. Un secret JWT par défaut**

Le code utilisait une clé de secours lorsque `JWT_SECRET` était absent. Cela facilitait le démarrage, mais présentait un risque de sécurité. Nous avons supprimé cette valeur et imposé la configuration explicite du secret.

**2. Des autorisations incomplètes sur les questions**

Certaines règles ne prenaient pas suffisamment en compte les brouillons et la propriété des annonces. Nous avons regroupé les vérifications dans une politique d'autorisation, pour empêcher la consultation ou la réponse par un utilisateur non autorisé.

**3. Des requêtes sans pagination**

Les services récupéraient parfois tous les utilisateurs, toutes les questions ou toutes les relations d'un profil. Avec beaucoup de données, cela pouvait provoquer des requêtes coûteuses. Nous avons ajouté une pagination côté serveur, limitée à 100 résultats par page.

## Deux choix que nous avons rejetés

Nous n'avons pas conservé la proposition d'utiliser un secret JWT de secours : une erreur de configuration doit être visible plutôt que masquée.

Nous avons également rejeté le chargement systématique de toutes les relations Prisma. La solution était simple, mais elle ne tenait pas compte du volume de données.

## Ce que nous avons retenu

L'IA nous a aidés à avancer plus rapidement, mais certaines solutions semblaient correctes uniquement parce qu'elles compilaient. Cette intégration nous a surtout appris à vérifier les autorisations, les erreurs HTTP et le comportement des requêtes SQL, au lieu de faire confiance au code généré sans le relire.
