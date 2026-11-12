
# FavoriResponseData


## Properties

Name | Type
------------ | -------------
`id` | string
`userId` | string
`annonceId` | string

## Example

```typescript
import type { FavoriResponseData } from ''

// TODO: Update the object below with actual values
const example = {
  "id": cmfavori123456789abcdef,
  "userId": cmuser123456789abcdef,
  "annonceId": cmannonce123456789abcdef,
} satisfies FavoriResponseData

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FavoriResponseData
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


