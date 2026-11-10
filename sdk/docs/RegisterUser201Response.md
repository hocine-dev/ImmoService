
# RegisterUser201Response


## Properties

Name | Type
------------ | -------------
`success` | boolean
`message` | string
`data` | [User](User.md)

## Example

```typescript
import type { RegisterUser201Response } from ''

// TODO: Update the object below with actual values
const example = {
  "success": true,
  "message": Utilisateur créé avec succès,
  "data": null,
} satisfies RegisterUser201Response

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RegisterUser201Response
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


