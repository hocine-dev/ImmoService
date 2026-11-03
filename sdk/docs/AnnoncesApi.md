# AnnoncesApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**listAnnonces**](AnnoncesApi.md#listannonces) | **GET** /annonces | Lister les annonces publiées |



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
    // number | Prix maximal des annonces. (optional)
    prixMax: 8.14,
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
| **prixMax** | `number` | Prix maximal des annonces. | [Optional] [Defaults to `undefined`] |

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
| **200** | Liste paginée des annonces publiées. |  -  |
| **400** | Paramètres de recherche invalides. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

