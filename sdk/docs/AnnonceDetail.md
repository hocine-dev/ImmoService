
# AnnonceDetail


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
`description` | string
`statut` | string
`dateDisponibilite` | Date
`updatedAt` | Date
`auteurId` | string
`photos` | [Array&lt;AnnonceDetailAllOfPhotos&gt;](AnnonceDetailAllOfPhotos.md)

## Example

```typescript
import type { AnnonceDetail } from ''

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
  "description": null,
  "statut": null,
  "dateDisponibilite": null,
  "updatedAt": null,
  "auteurId": null,
  "photos": null,
} satisfies AnnonceDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AnnonceDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


