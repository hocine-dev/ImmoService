
# UserProfileResponseData


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`email` | string
`role` | string
`createdAt` | Date
`updatedAt` | Date
`annonces` | Array&lt;{ [key: string]: any; }&gt;
`favoris` | Array&lt;{ [key: string]: any; }&gt;
`pagination` | [UserProfileResponseDataAllOfPagination](UserProfileResponseDataAllOfPagination.md)

## Example

```typescript
import type { UserProfileResponseData } from ''

// TODO: Update the object below with actual values
const example = {
  "id": clw3f8k2a0000qwerty1234567,
  "name": Mohamed Sanogo,
  "email": mohamed@example.com,
  "role": USER,
  "createdAt": 2026-10-20T10:30:00.000Z,
  "updatedAt": 2026-10-22T15:30:00.000Z,
  "annonces": null,
  "favoris": null,
  "pagination": null,
} satisfies UserProfileResponseData

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserProfileResponseData
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


