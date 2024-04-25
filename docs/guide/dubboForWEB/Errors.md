# Errors

Similar to the familiar "404 Not Found" and "500 Internal Server Error" status codes you may have seen in HTTP, Dubbo uses a set of 16 error codes. In the Dubbo protocol, an error is always represented as JSON, and is easily readable in the developer tools of your browser. For example:

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "status": "3"
  "message": "sentence cannot be empty"
}
```

With the gRPC-web protocol, errors are usually not human-readable, but Dubbo provides a common type that represents errors consistently across all supported protocols.

# Working with errors

All errors are represented by [`DubboError`](https://github.com/apache/dubbo-js/blob/dubbo3/packages/dubbo/src/code.ts), a subtype of the built-in `Error` class. Using a try-catch block, we can catch any error that occurred during a call:

```tsx
import { DubboError } from "@apachedubbo/dubbo";

try {
  await client.say({sentence: ""});
} catch (err) {
  // We have to verify err is a DubboError
  // before using it as one.
  if (err instanceof DubboError) {
    err.code;    // Code.InvalidArgument
    err.message; // "[invalid_argument] sentence cannot be empty"
  }
  // Alternatively, we can use DubboError.from()
  // It returns a DubboError as is, and converts any
  // other error to a DubboError.
  const DubboError = DubboError.from(err);
  DubboErr.code;    // Code.InvalidArgument
  DubboErr.message; // "[invalid_argument] sentence cannot be empty"
}
```

# Error codes

The `code` property holds one of Connect's error codes. All error codes are available through the TypeScript enumeration [`Code`](https://github.com/apache/dubbo-js/blob/dubbo3/packages/dubbo/src/code.ts). Note that a code is an integer value, but can easily be converted to and from a string value.

```tsx
import { Code } from "@apachedubbo/dubbo";

let code = Code.InvalidArgument;
code; // 3
let name = Code[code]; // "InvalidArgument"
let val: Code = Code["InvalidArgument"]; // 3
```

# Error messages

The `message` property contains a descriptive error message. In most cases, the message is provided by the backend implementing the service. Because `message` is the only property that shows up in the browser console for uncaught errors, the error message is always prefixed with the error code. In case you *do* want the original error message without a code prefix, use the property `rawMessage`.

```tsx
err.message; // "[invalid_argument] sentence cannot be empty"
if (err.code == Code.InvalidArgument) {
  err.rawMessage; // "sentence cannot be empty"
}
```

# Metadata

If you catch an error, your program takes an exception from the regular code path, but you might still want to access a header or trailer value. Connect provides a union of header and trailer values in the `metadata` property as a simple `Headers` object:

```tsx
err.metadata.get("Custom-Header-Value");
err.metadata.get("Custom-Trailer-Value");
```

# Error details

On the wire, error details are wrapped with `google.protobuf.Any`, so that a server or middleware can attach arbitrary data to an error. Using the method `findDetails()`, you can decode the details from an error.

The method takes a protobuf message type as an argument, and returns an array of decoded messages of this type.

This example looks up a localized error message in the users preferred language:

```tsx
import { DubboError } from "@apachedubbo/dubbo";
import { LocalizedMessage } from "./error_details_pb.js";

function handle(err: DubboError) {
  const localized = err.findDetails(LocalizedMessage)
    .find(i => i.locale === navigator.language);
  console.log(localized?.message);
}
```

We are using the protobuf message [`google.rpc.LocalizedMessage`](https://buf.build/googleapis/googleapis/file/main:google/rpc/error_details.proto#L241) in this example, but any protobuf message can be transmitted as error details.

Alternatively, `findDetails()` takes a registry as an argument. See the [protobuf-es documentation](https://github.com/bufbuild/protobuf-es/blob/main/docs/runtime_api.md#registries) for details.

