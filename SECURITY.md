# Sécurité

## Vérifications réalisées

Les contrôles suivants ont été recherchés et, lorsque nécessaire, corrigés :

- **Authentification et autorisation défaillantes (OWASP API1/API2)** :
  les routes protégées vérifient le JWT, son expiration, sa signature et son
  rôle. Les politiques de propriété empêchent notamment un agent d'agir sur
  les annonces d'un autre agent.
- **IDOR (OWASP API1)** : les accès aux annonces, questions, réponses et
  profils vérifient l'utilisateur courant. Des tests E2E vérifient le statut
  HTTP et l'état de la base après une tentative d'accès non autorisée.
- **Validation insuffisante (OWASP API3/API8)** : les paramètres de route,
  query et body sont validés avec Zod. Les rôles envoyés lors de l'inscription
  sont ignorés et le rôle initial est toujours `USER`.
- **Exposition de données sensibles (OWASP API3)** : les mots de passe sont
  hachés avec Argon2. `passwordHash` n'est pas renvoyé par l'API ; les listes
  et profils utilisent des sélections Prisma explicites.
- **Mauvaise configuration de sécurité (OWASP API8)** : `JWT_SECRET` est
  obligatoire, CORS utilise une liste d'origines explicite et les erreurs
  internes ne renvoient pas de détails d'implémentation.
- **Consommation de ressources non maîtrisée (OWASP API4)** : la pagination
  possède un plafond serveur et les corps JSON sont limités en taille.

Les tests unitaires et E2E couvrent les politiques d'autorisation, la
validation, les codes HTTP, les fuites de données sensibles et les scénarios
IDOR.

## JWT côté client

L'API est sans session en base : le serveur émet un JWT Bearer valable un jour
et le client doit le transmettre dans l'en-tête :

```http
Authorization: Bearer <token>
```

Aucun frontend n'est livré avec ce service ; le choix du stockage côté client
appartient donc au client consommateur. Pour une application web, le stockage
en mémoire est préférable afin de limiter l'exposition aux attaques XSS. Si
une persistance est indispensable, un cookie `HttpOnly`, `Secure` et
`SameSite` correctement configuré doit être préféré au stockage
`localStorage`.

## Vol ou révocation d'un JWT

Un JWT volé reste utilisable jusqu'à son expiration, sauf si le secret de
signature est remplacé. Le service ne maintient actuellement pas de liste de
révocation en base : il n'est donc pas possible de révoquer individuellement
un token déjà émis.

En cas de compromission, il faut :

1. remplacer `JWT_SECRET`, ce qui invalide les tokens signés avec l'ancien
   secret ;
2. demander aux utilisateurs de se reconnecter ;
3. vérifier les journaux et corriger la cause du vol.

La réduction de la durée de vie des tokens et un mécanisme de révocation
persistant pourraient être ajoutés si le besoin de déconnexion immédiate ou de
rotation des tokens apparaît.
