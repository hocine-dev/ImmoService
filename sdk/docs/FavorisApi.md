# FavorisApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**favorisAnnonceIdDelete**](FavorisApi.md#favorisannonceiddelete) | **DELETE** /favoris/{annonceId} | Supprimer une annonce des favoris |
| [**favorisPost**](FavorisApi.md#favorispostoperation) | **POST** /favoris | Ajouter une annonce aux favoris |



## favorisAnnonceIdDelete

> FavoriDeleteResponse favorisAnnonceIdDelete(annonceId)

Supprimer une annonce des favoris

### Example

```ts
import {
  Configuration,
  FavorisApi,
} from '';
import type { FavorisAnnonceIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FavorisApi(config);

  const body = {
    // string
    annonceId: annonceId_example,
  } satisfies FavorisAnnonceIdDeleteRequest;

  try {
    const data = await api.favorisAnnonceIdDelete(body);
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
| **annonceId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**FavoriDeleteResponse**](FavoriDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Favori supprimé |  -  |
| **400** | Identifiant invalide |  -  |
| **401** | Utilisateur non authentifié |  -  |
| **404** | Favori introuvable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## favorisPost

> FavoriResponse favorisPost(favorisPostRequest)

Ajouter une annonce aux favoris

### Example

```ts
import {
  Configuration,
  FavorisApi,
} from '';
import type { FavorisPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FavorisApi(config);

  const body = {
    // FavorisPostRequest
    favorisPostRequest: ...,
  } satisfies FavorisPostOperationRequest;

  try {
    const data = await api.favorisPost(body);
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
| **favorisPostRequest** | [FavorisPostRequest](FavorisPostRequest.md) |  | |

### Return type

[**FavoriResponse**](FavoriResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Annonce ajoutée aux favoris |  -  |
| **400** | Données invalides |  -  |
| **401** | Utilisateur non authentifié |  -  |
| **404** | Annonce introuvable |  -  |
| **409** | Favori déjà existant |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

