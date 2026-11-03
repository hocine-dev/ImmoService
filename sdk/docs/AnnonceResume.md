
# AnnonceResume


## Properties

Name | Type
------------ | -------------
`id` | string
`titre` | string
`type` | string
`typePropriete` | string
`etat` | string
`prix` | string
`ville` | string
`surface` | number
`chambres` | number
`createdAt` | Date

## Example

```typescript
import type { AnnonceResume } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "titre": null,
  "type": null,
  "typePropriete": null,
  "etat": null,
  "prix": null,
  "ville": null,
  "surface": null,
  "chambres": null,
  "createdAt": null,
} satisfies AnnonceResume

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AnnonceResume
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


