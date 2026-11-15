# UsersApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteUser**](UsersApi.md#deleteuser) | **DELETE** /users/{id} | Supprimer un utilisateur |
| [**getAllUsers**](UsersApi.md#getallusers) | **GET** /users/getAll | Récupérer tous les utilisateurs |
| [**getUserById**](UsersApi.md#getuserbyid) | **GET** /users/{id} | Récupérer un utilisateur par son ID |
| [**registerUser**](UsersApi.md#registeruser) | **POST** /users/register | Inscrire un nouvel utilisateur |
| [**updateUser**](UsersApi.md#updateuser) | **PUT** /users/{id} | Modifier un utilisateur |



## deleteUser

> DeleteUser200Response deleteUser(id)

Supprimer un utilisateur

Supprime un compte utilisateur. Seul le propriétaire du compte ou un ADMIN peut effectuer cette action. 

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { DeleteUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  const body = {
    // string | Identifiant CUID de l\'utilisateur.
    id: clw3f8k2a0000qwerty1234567,
  } satisfies DeleteUserRequest;

  try {
    const data = await api.deleteUser(body);
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
| **id** | `string` | Identifiant CUID de l\&#39;utilisateur. | [Defaults to `undefined`] |

### Return type

[**DeleteUser200Response**](DeleteUser200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Utilisateur supprimé. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **401** | Authentification requise. |  -  |
| **403** | Accès refusé. |  -  |
| **404** | Ressource introuvable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAllUsers

> GetAllUsers200Response getAllUsers(page, limit)

Récupérer tous les utilisateurs

Retourne la liste paginée des utilisateurs. Accès réservé aux administrateurs (ADMIN). 

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetAllUsersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  const body = {
    // number | Numéro de page (à partir de 1). (optional)
    page: 56,
    // number | Nombre d\'éléments par page (maximum 100). (optional)
    limit: 56,
  } satisfies GetAllUsersRequest;

  try {
    const data = await api.getAllUsers(body);
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
| **page** | `number` | Numéro de page (à partir de 1). | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (maximum 100). | [Optional] [Defaults to `10`] |

### Return type

[**GetAllUsers200Response**](GetAllUsers200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Liste des utilisateurs récupérée. |  -  |
| **401** | Authentification requise. |  -  |
| **403** | Accès refusé. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUserById

> UserProfileResponse getUserById(id, page, limit)

Récupérer un utilisateur par son ID

Retourne le profil d\&#39;un utilisateur avec ses annonces, ses favoris et les statistiques associées. Un utilisateur peut consulter son propre profil. Un ADMIN peut consulter tous les profils. 

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetUserByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  const body = {
    // string | Identifiant CUID de l\'utilisateur.
    id: clw3f8k2a0000qwerty1234567,
    // number | Numéro de page (à partir de 1). (optional)
    page: 56,
    // number | Nombre d\'éléments par page (maximum 100). (optional)
    limit: 56,
  } satisfies GetUserByIdRequest;

  try {
    const data = await api.getUserById(body);
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
| **id** | `string` | Identifiant CUID de l\&#39;utilisateur. | [Defaults to `undefined`] |
| **page** | `number` | Numéro de page (à partir de 1). | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (maximum 100). | [Optional] [Defaults to `10`] |

### Return type

[**UserProfileResponse**](UserProfileResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Profil utilisateur récupéré. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **401** | Authentification requise. |  -  |
| **403** | Accès refusé. |  -  |
| **404** | Ressource introuvable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## registerUser

> RegisterUser201Response registerUser(createUserInput)

Inscrire un nouvel utilisateur

Crée un compte utilisateur. Le mot de passe est haché avec Argon2 avant stockage. Le rôle est automatiquement défini à USER. Cette route est publique et protégée par un rate limiter. 

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { RegisterUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // CreateUserInput
    createUserInput: {"name":"Mohamed Sanogo","email":"mohamed@example.com","password":"password123"},
  } satisfies RegisterUserRequest;

  try {
    const data = await api.registerUser(body);
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
| **createUserInput** | [CreateUserInput](CreateUserInput.md) |  | |

### Return type

[**RegisterUser201Response**](RegisterUser201Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Utilisateur créé avec succès. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **409** | Adresse email déjà utilisée. |  -  |
| **429** | Limite de tentatives d\&#39;inscription atteinte. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateUser

> UpdateUser200Response updateUser(id, updateUserInput)

Modifier un utilisateur

Modifie les informations d\&#39;un utilisateur. Seul le propriétaire du compte ou un ADMIN peut effectuer cette action. Seul un ADMIN peut modifier le rôle d\&#39;un utilisateur. 

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UpdateUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  const body = {
    // string | Identifiant CUID de l\'utilisateur.
    id: clw3f8k2a0000qwerty1234567,
    // UpdateUserInput
    updateUserInput: {"name":"Mohamed Sanogo","email":"mohamed@example.com"},
  } satisfies UpdateUserRequest;

  try {
    const data = await api.updateUser(body);
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
| **id** | `string` | Identifiant CUID de l\&#39;utilisateur. | [Defaults to `undefined`] |
| **updateUserInput** | [UpdateUserInput](UpdateUserInput.md) |  | |

### Return type

[**UpdateUser200Response**](UpdateUser200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Utilisateur mis à jour. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **401** | Authentification requise. |  -  |
| **403** | Accès refusé. |  -  |
| **404** | Ressource introuvable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

