# AnnoncesApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**changeStatutAnnonce**](AnnoncesApi.md#changestatutannonceoperation) | **PATCH** /annonces/{id}/statut | Publier ou dépublier une annonce |
| [**createAnnonce**](AnnoncesApi.md#createannonce) | **POST** /annonces | Créer une annonce immobilière |
| [**deleteAnnonce**](AnnoncesApi.md#deleteannonce) | **DELETE** /annonces/{id} | Supprimer une annonce |
| [**getAnnonceById**](AnnoncesApi.md#getannoncebyid) | **GET** /annonces/{id} | Consulter le détail d\&#39;une annonce publiée |
| [**getMesAnnonces**](AnnoncesApi.md#getmesannonces) | **GET** /annonces/miennes | Lister mes annonces |
| [**listAnnonces**](AnnoncesApi.md#listannonces) | **GET** /annonces | Lister les annonces publiées |
| [**updateAnnonce**](AnnoncesApi.md#updateannonce) | **PATCH** /annonces/{id} | Modifier une annonce |



## changeStatutAnnonce

> ChangeStatutAnnonce200Response changeStatutAnnonce(id, changeStatutAnnonceRequest)

Publier ou dépublier une annonce

Permet à un agent de publier ou dépublier ses propres annonces. Un administrateur peut modifier le statut de toutes les annonces. Si le statut demandé est déjà celui de l\&#39;annonce, aucune modification n\&#39;est effectuée dans la base de données. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { ChangeStatutAnnonceOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // string | Identifiant de l\'annonce.
    id: id_example,
    // ChangeStatutAnnonceRequest
    changeStatutAnnonceRequest: ...,
  } satisfies ChangeStatutAnnonceOperationRequest;

  try {
    const data = await api.changeStatutAnnonce(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Identifiant de l\&#39;annonce. | [Defaults to `undefined`] |
| **changeStatutAnnonceRequest** | [ChangeStatutAnnonceRequest](ChangeStatutAnnonceRequest.md) |  | |

### Return type

[**ChangeStatutAnnonce200Response**](ChangeStatutAnnonce200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Statut enregistré avec succès. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **400** | Identifiant ou statut invalide. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **401** | Authentification requise. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **403** | Rôle insuffisant. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **404** | Annonce inexistante ou inaccessible à cet agent. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createAnnonce

> AnnonceCreee createAnnonce(createAnnonceInput)

Créer une annonce immobilière

Permet à un AGENT ou un ADMIN authentifié de créer une annonce. L\&#39;identifiant de l\&#39;auteur est récupéré depuis le JWT. Le statut initial est toujours BROUILLON. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { CreateAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // CreateAnnonceInput
    createAnnonceInput: ...,
  } satisfies CreateAnnonceRequest;

  try {
    const data = await api.createAnnonce(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createAnnonceInput** | [CreateAnnonceInput](CreateAnnonceInput.md) |  | |

### Return type

[**AnnonceCreee**](AnnonceCreee.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Annonce créée en brouillon. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **400** | Données de création invalides. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **413** | Corps JSON trop volumineux. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **401** | JWT absent, invalide ou expiré. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **403** | Utilisateur authentifié sans rôle AGENT ou ADMIN. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **429** | Limite de requêtes dépassée. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteAnnonce

> deleteAnnonce(id)

Supprimer une annonce

Un agent peut supprimer uniquement ses propres annonces. Un administrateur peut supprimer toutes les annonces. La suppression est définitive et entraîne également la suppression des photos, questions, réponses et favoris associés, conformément aux relations Prisma. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { DeleteAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // string | Identifiant de l\'annonce à supprimer.
    id: id_example,
  } satisfies DeleteAnnonceRequest;

  try {
    const data = await api.deleteAnnonce(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Identifiant de l\&#39;annonce à supprimer. | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | Annonce supprimée avec succès. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **400** | Identifiant invalide. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **401** | Authentification requise. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **403** | Rôle insuffisant. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **404** | Annonce inexistante ou inaccessible à cet agent. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAnnonceById

> AnnonceDetail getAnnonceById(id)

Consulter le détail d\&#39;une annonce publiée

Les annonces publiées sont accessibles publiquement. Les brouillons sont accessibles uniquement à leur auteur ou aux administrateurs. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { GetAnnonceByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // string | Identifiant de l\'annonce.
    id: id_example,
  } satisfies GetAnnonceByIdRequest;

  try {
    const data = await api.getAnnonceById(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Identifiant de l\&#39;annonce. | [Defaults to `undefined`] |

### Return type

[**AnnonceDetail**](AnnonceDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Détails de l\&#39;annonce publiée. |  * ETag - Identifiant de la représentation JSON. <br>  * Cache-Control - Politique de cache HTTP. Les annonces publiées sont publiques avec revalidation. Les brouillons ne doivent pas être mis en cache.  <br>  |
| **304** | L\&#39;annonce n\&#39;a pas changé depuis l\&#39;ETag fourni. |  * ETag - ETag de la représentation actuelle. <br>  * Cache-Control - Politique de revalidation. <br>  |
| **400** | Identifiant invalide. |  * Cache-Control - Les brouillons et les réponses d\&#39;erreur ne sont pas stockables. <br>  |
| **401** | Authentification requise ou invalide. |  * Cache-Control - Les brouillons et les réponses d\&#39;erreur ne sont pas stockables. <br>  |
| **404** | Annonce inexistante ou non accessible. |  * Cache-Control - Les brouillons et les réponses d\&#39;erreur ne sont pas stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getMesAnnonces

> GetMesAnnonces200Response getMesAnnonces(page, limit, ville, type, prixMax, statut)

Lister mes annonces

Retourne les annonces appartenant à l\&#39;utilisateur authentifié, y compris les brouillons. Accessible uniquement aux rôles AGENT et ADMIN. L\&#39;identifiant du propriétaire est extrait du JWT. Sans filtre statut, les deux statuts sont inclus. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { GetMesAnnoncesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Numéro de page. (optional)
    page: 56,
    // number | Nombre d\'annonces par page. (optional)
    limit: 56,
    // string | Filtrer par ville. (optional)
    ville: ville_example,
    // 'VENTE' | 'LOCATION' | Type de transaction. (optional)
    type: type_example,
    // string | Prix maximal sous forme de chaîne décimale non négative, avec au plus deux décimales.  (optional)
    prixMax: 250000.00,
    // 'BROUILLON' | 'PUBLIE' | Filtrer par statut de publication. (optional)
    statut: statut_example,
  } satisfies GetMesAnnoncesRequest;

  try {
    const data = await api.getMesAnnonces(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` | Numéro de page. | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;annonces par page. | [Optional] [Defaults to `10`] |
| **ville** | `string` | Filtrer par ville. | [Optional] [Defaults to `undefined`] |
| **type** | `VENTE`, `LOCATION` | Type de transaction. | [Optional] [Defaults to `undefined`] [Enum: VENTE, LOCATION] |
| **prixMax** | `string` | Prix maximal sous forme de chaîne décimale non négative, avec au plus deux décimales.  | [Optional] [Defaults to `undefined`] |
| **statut** | `BROUILLON`, `PUBLIE` | Filtrer par statut de publication. | [Optional] [Defaults to `undefined`] [Enum: BROUILLON, PUBLIE] |

### Return type

[**GetMesAnnonces200Response**](GetMesAnnonces200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Liste paginée des annonces du propriétaire. |  * Cache-Control - Données personnelles non stockables. <br>  |
| **400** | Paramètres de requête invalides. |  * Cache-Control - Données personnelles non stockables. <br>  |
| **401** | Authentification requise. |  * Cache-Control - Données personnelles non stockables. <br>  |
| **403** | Accès réservé aux agents et administrateurs. |  * Cache-Control - Données personnelles non stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAnnonces

> ListAnnonces200Response listAnnonces(page, limit, ville, type, prixMax)

Lister les annonces publiées

Retourne les annonces publiées avec pagination et filtres facultatifs. Cette route est publique. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { ListAnnoncesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AnnoncesApi();

  const body = {
    // number | Numéro de la page (à partir de 1). (optional)
    page: 56,
    // number | Nombre d\'annonces par page (maximum 100). (optional)
    limit: 56,
    // string | Filtrer les annonces par ville. (optional)
    ville: ville_example,
    // 'VENTE' | 'LOCATION' | Type de transaction immobilière. (optional)
    type: type_example,
    // string | Prix maximal sous forme de chaîne décimale non négative, avec au plus deux décimales.  (optional)
    prixMax: 250000.00,
  } satisfies ListAnnoncesRequest;

  try {
    const data = await api.listAnnonces(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` | Numéro de la page (à partir de 1). | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;annonces par page (maximum 100). | [Optional] [Defaults to `10`] |
| **ville** | `string` | Filtrer les annonces par ville. | [Optional] [Defaults to `undefined`] |
| **type** | `VENTE`, `LOCATION` | Type de transaction immobilière. | [Optional] [Defaults to `undefined`] [Enum: VENTE, LOCATION] |
| **prixMax** | `string` | Prix maximal sous forme de chaîne décimale non négative, avec au plus deux décimales.  | [Optional] [Defaults to `undefined`] |

### Return type

[**ListAnnonces200Response**](ListAnnonces200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Liste paginée des annonces publiées. |  * ETag - Identifiant de la représentation JSON. <br>  * Cache-Control - Politique de cache HTTP public avec revalidation. <br>  |
| **304** | La liste n\&#39;a pas changé depuis l\&#39;ETag fourni. |  * ETag - ETag de la représentation actuelle. <br>  * Cache-Control - Politique de revalidation. <br>  |
| **400** | Paramètres de recherche invalides. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateAnnonce

> AnnonceModifiee updateAnnonce(id, updateAnnonceInput)

Modifier une annonce

Un agent peut modifier uniquement ses propres annonces. Un administrateur peut modifier toutes les annonces. Le propriétaire et le statut ne sont pas modifiables ici. 

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { UpdateAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // string | Identifiant de l\'annonce à modifier.
    id: id_example,
    // UpdateAnnonceInput
    updateAnnonceInput: ...,
  } satisfies UpdateAnnonceRequest;

  try {
    const data = await api.updateAnnonce(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Identifiant de l\&#39;annonce à modifier. | [Defaults to `undefined`] |
| **updateAnnonceInput** | [UpdateAnnonceInput](UpdateAnnonceInput.md) |  | |

### Return type

[**AnnonceModifiee**](AnnonceModifiee.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Annonce modifiée avec succès. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **400** | Données de modification invalides. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **401** | Authentification requise. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **403** | Rôle insuffisant. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |
| **404** | Annonce inexistante ou inaccessible à cet agent. |  * Cache-Control - Les réponses d\&#39;écriture ne sont pas stockables. <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

