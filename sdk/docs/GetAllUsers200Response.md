
# GetAllUsers200Response


## Properties

Name | Type
------------ | -------------
`success` | boolean
`data` | [Array&lt;UserSummary&gt;](UserSummary.md)
`pagination` | [Pagination](Pagination.md)

## Example

```typescript
import type { GetAllUsers200Response } from ''

// TODO: Update the object below with actual values
const example = {
  "success": true,
  "data": null,
  "pagination": null,
} satisfies GetAllUsers200Response

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAllUsers200Response
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


