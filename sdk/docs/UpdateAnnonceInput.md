
# UpdateAnnonceInput


## Properties

Name | Type
------------ | -------------
`titre` | string
`description` | string
`type` | string
`typePropriete` | string
`prix` | string
`ville` | string
`surface` | number
`chambres` | number
`etat` | string
`dateDisponibilite` | Date

## Example

```typescript
import type { UpdateAnnonceInput } from ''

// TODO: Update the object below with actual values
const example = {
  "titre": null,
  "description": null,
  "type": null,
  "typePropriete": null,
  "prix": 400000.00,
  "ville": Le Havre,
  "surface": null,
  "chambres": null,
  "etat": null,
  "dateDisponibilite": null,
} satisfies UpdateAnnonceInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateAnnonceInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


