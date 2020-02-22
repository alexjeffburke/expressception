# expressception

Make requests against express handlers without a server.

[![NPM version](https://img.shields.io/npm/v/expressception.svg)](https://www.npmjs.com/package/expressception)
[![Build Status](https://img.shields.io/travis/alexjeffburke/expressception/master.svg)](https://travis-ci.org/alexjeffburke/expressception)
[![Coverage Status](https://img.shields.io/coveralls/alexjeffburke/expressception/master.svg)](https://coveralls.io/r/alexjeffburke/expressception?branch=master)

This module supports testing express handlers and middleware
without having to start an HTTP server. Instead a runtime is
provided which constructs request/response objects, calls the
handler or middleware with them an captures the response.

The following interfaces are currently supported:

- superagent
- supertest

## Use

Once installed, the module is required and is ready to be wrapped
around the express app or middleware you wish to test:

```js
const expressception = require("expressception");
```

Let's take the following simple express app to demonstrate
how it works:

```js
const express = require("express");

const app = express().post("/foo/bar", (req, res) => {
  res.status(201).send();
});
```

### Superagent

The [superagent](https://github.com/visionmedia/superagent) interface exposes
a fully compatible

```js
const superAgent = expressception(app).superagent();

agent.post("/foo/bar").end((err, res) => {
  if (err) {
    throw new Error("something went wrong");
  }

  console.log(`Retuned status code: ${res.status}`);
});
```

### Supertest

Most often prtojects using `superagent` for testing use its counterpart
[supertest](https://github.com/visionmedia/supertest) which extends the
it and provides helper methods for making assertions on the response,
such as checking the expected status code.

The entire API surface of `supertest` is also supported:

```js
const testAgent = expressception(app).supertest();

(async function() {
  await testAgent
    .post("/foo/bar")
    .expect(201)
    .expect("Content-Type", /^text\/plain/)
    .expect("hello!");
})();
```

## Compatibility

In addition to local tests the module is also tested against the
`supertest` test suite. This is bundled in the tree and the current
baseline version is **4.0.2**.
