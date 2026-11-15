# QuestionsApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createQuestion**](QuestionsApi.md#createquestion) | **POST** /questions/create | Poser une question sur une annonce |
| [**deleteQuestion**](QuestionsApi.md#deletequestion) | **DELETE** /questions/{id} | Supprimer une question |
| [**listQuestionsByAnnonce**](QuestionsApi.md#listquestionsbyannonce) | **GET** /questions/annonce/{annonceId} | Lister les questions d\&#39;une annonce |



## createQuestion

> CreateQuestion201Response createQuestion(createQuestionInput)

Poser une question sur une annonce

Crée une question sur une annonce **publiée**. L\&#39;auteur est déterminé à partir du JWT, jamais à partir du body. Les champs inconnus dans le body sont refusés (400). Cette route est protégée par un rate limiter. 

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { CreateQuestionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // CreateQuestionInput
    createQuestionInput: {"texte":"Le logement est-il disponible dès le mois prochain ?","annonceId":"clw3f8k2a0001annonce1234567"},
  } satisfies CreateQuestionRequest;

  try {
    const data = await api.createQuestion(body);
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
| **createQuestionInput** | [CreateQuestionInput](CreateQuestionInput.md) |  | |

### Return type

[**CreateQuestion201Response**](CreateQuestion201Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Question créée avec succès. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **401** | Authentification requise. |  -  |
| **404** | Annonce inexistante ou non publiée. |  -  |
| **429** | Limite de questions atteinte. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteQuestion

> DeleteQuestion200Response deleteQuestion(id)

Supprimer une question

Supprime une question. Seul l\&#39;auteur de la question ou un ADMIN peut effectuer cette action. 

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { DeleteQuestionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // string | Identifiant CUID de la question.
    id: clw3f8k2a0002question123456,
  } satisfies DeleteQuestionRequest;

  try {
    const data = await api.deleteQuestion(body);
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
| **id** | `string` | Identifiant CUID de la question. | [Defaults to `undefined`] |

### Return type

[**DeleteQuestion200Response**](DeleteQuestion200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Question supprimée. |  -  |
| **401** | Authentification requise. |  -  |
| **403** | Accès refusé. |  -  |
| **404** | Question introuvable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listQuestionsByAnnonce

> ListQuestionsByAnnonce200Response listQuestionsByAnnonce(annonceId, page, limit)

Lister les questions d\&#39;une annonce

Retourne les questions d\&#39;une annonce avec pagination, de la plus récente à la plus ancienne. Chaque question inclut son auteur (&#x60;id&#x60;, &#x60;name&#x60;) et sa réponse éventuelle.  Règles d\&#39;accès : - **Annonce publiée** : accès public, aucun JWT nécessaire. - **Brouillon** : réservé à l\&#39;ADMIN ou à l\&#39;AGENT propriétaire de l\&#39;annonce   (JWT obligatoire).  Le JWT est facultatif : s\&#39;il est fourni, il est vérifié et l\&#39;identité est utilisée pour appliquer les règles ci-dessus. Pour ne pas révéler l\&#39;existence d\&#39;un brouillon, une annonce inexistante ou inaccessible renvoie la même erreur 404. 

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { ListQuestionsByAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // string | Identifiant de l\'annonce.
    annonceId: annonceId_example,
    // number | Numéro de page (à partir de 1). (optional)
    page: 56,
    // number | Nombre d\'éléments par page (maximum 100). (optional)
    limit: 56,
  } satisfies ListQuestionsByAnnonceRequest;

  try {
    const data = await api.listQuestionsByAnnonce(body);
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
| **annonceId** | `string` | Identifiant de l\&#39;annonce. | [Defaults to `undefined`] |
| **page** | `number` | Numéro de page (à partir de 1). | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (maximum 100). | [Optional] [Defaults to `10`] |

### Return type

[**ListQuestionsByAnnonce200Response**](ListQuestionsByAnnonce200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Liste paginée des questions. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **404** | Annonce inexistante ou inaccessible. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

