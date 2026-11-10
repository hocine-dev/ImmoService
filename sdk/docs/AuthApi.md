# AuthApi

All URIs are relative to *http://localhost:3001*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**login**](AuthApi.md#login) | **POST** /auth/login | Se connecter |



## login

> LoginResponse login(loginInput)

Se connecter

Authentifie un utilisateur à partir de son email et de son mot de passe (vérifié avec Argon2) et retourne un JWT signé avec &#x60;JWT_SECRET&#x60;, valable 1 jour. Le payload du token contient &#x60;id&#x60; et &#x60;role&#x60;. Le même message d\&#39;erreur est renvoyé que l\&#39;email n\&#39;existe pas ou que le mot de passe soit incorrect, afin de ne pas révéler l\&#39;existence d\&#39;un compte. Cette route est publique et protégée par un rate limiter. 

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { LoginRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // LoginInput
    loginInput: {"email":"mohamed@example.com","password":"password123"},
  } satisfies LoginRequest;

  try {
    const data = await api.login(body);
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
| **loginInput** | [LoginInput](LoginInput.md) |  | |

### Return type

[**LoginResponse**](LoginResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Connexion réussie. |  -  |
| **400** | Données ou paramètres invalides. |  -  |
| **401** | Email ou mot de passe incorrect. |  -  |
| **429** | Limite de tentatives de connexion atteinte. |  -  |
| **500** | Erreur serveur (ex. variable d\&#39;environnement &#x60;JWT_SECRET&#x60; manquante). |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

