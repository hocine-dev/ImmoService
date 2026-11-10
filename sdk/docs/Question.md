
# Question


## Properties

Name | Type
------------ | -------------
`id` | string
`texte` | string
`createdAt` | Date
`auteurId` | string
`annonceId` | string

## Example

```typescript
import type { Question } from ''

// TODO: Update the object below with actual values
const example = {
  "id": clw3f8k2a0002question123456,
  "texte": Le logement est-il disponible dès le mois prochain ?,
  "createdAt": null,
  "auteurId": null,
  "annonceId": null,
} satisfies Question

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Question
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


