const http = require("http");
const proxyquire = require("proxyquire");
const qs = require("qs");

const types = {
  html: "text/html",
  json: "application/json",
  xml: "text/xml",
  urlencoded: "application/x-www-form-urlencoded",
  form: "application/x-www-form-urlencoded",
  "form-data": "application/x-www-form-urlencoded"
};

function createTimeoutError() {
  const error = new Error();
  error.name = "TimeoutError";
  return error;
}

function decodeResError(res, metadata, error) {
  if (error) {
    return error;
  }
  if (metadata.isDestroyed) {
    return new Error("destroyed");
  }

  const isOkResponse = res.status >= 200 && res.status < 300;
  if (isOkResponse) {
    return null;
  }
  let msg = "Unsuccessful HTTP response";
  if (res) {
    msg = http.STATUS_CODES[res.status] || msg;
  }
  const err = new Error(msg);
  err.status = res ? res.status : undefined;
  return err;
}

class Superagent {
  constructor(executeFn) {
    this._executeFn = executeFn;
    this._flags = {
      timeout: 0,
      body: null,
      type: null,
      method: null,
      path: null,
      query: null,
      headers: null
    };
  }

  async _execute(options) {
    const promises = [this._executeFn(options)];
    if (this._flags.timeout > 0) {
      promises.push(
        new Promise((resolve, reject) => {
          setTimeout(() => reject(createTimeoutError()), this._flags.timeout);
        })
      );
    }
    let error = null;
    try {
      await Promise.race(promises);
    } catch (e) {
      error = e;
    }
    return { context: await promises[0], error };
  }

  delete(url) {
    this._flags.method = "DELETE";
    this._flags.path = url;
    return new Superagent.Request(this);
  }

  del(url) {
    return this.delete(url);
  }

  get(url) {
    this._flags.method = "GET";
    this._flags.path = url;
    return new Superagent.Request(this);
  }

  head(url) {
    this._flags.method = "HEAD";
    this._flags.path = url;
    return new Superagent.Request(this);
  }

  post(url) {
    this._flags.method = "POST";
    this._flags.path = url;
    return new Superagent.Request(this);
  }

  put(url) {
    this._flags.method = "PUT";
    this._flags.path = url;
    return new Superagent.Request(this);
  }
}

Superagent.Request = (function() {
  function decorateRequest(req) {
    Object.defineProperty(req, "path", {
      get: () => {
        console.warn(".path does not behave like node (appended query string)");
        return req.url;
      }
    });
  }

  function decorateResponse(res, httpResponse) {
    res.status = res.statusCode;
    const httpResponseHeaders = httpResponse.headers;

    // XXX: questionnable default behaviour of superagent
    if (!httpResponseHeaders.get("content-type")) {
      httpResponseHeaders.set("content-type", "text/html");
    }

    const proxiedHeaders = new Proxy(Object.create(null), {
      get: (_, prop) => httpResponseHeaders.get(prop)
    });
    res.header = proxiedHeaders;
    res.headers = proxiedHeaders;
    res.body = httpResponse.body;

    let text = null;
    if (typeof res.body === "string") {
      text = res.body;
    } else if (Buffer.isBuffer(res.body)) {
      try {
        text = res.body.toString();
      } catch (e) {}
    } else {
      try {
        text = JSON.stringify(res.body);
      } catch (e) {}
    }
    res.text = text || "";
  }

  function SuperagentRequest(agent) {
    this.__agent = agent;
    this._flags = this.__agent._flags;
    this._promise = null;
  }

  // promise support
  SuperagentRequest.prototype.then = function(resolve, reject) {
    if (this._promise) {
      throw new Error("cannot be awaited twice");
    }

    this._promise = new Promise((resolve, reject) => {
      this.end((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });

    return this._promise.then(resolve, reject);
  };

  SuperagentRequest.prototype.catch = function(reject) {
    return this.then(undefined, reject);
  };

  // stubs for supertest
  SuperagentRequest.prototype.buffer = function(object) {};
  SuperagentRequest.prototype.ca = function(object) {};
  SuperagentRequest.prototype.cert = function(object) {};
  SuperagentRequest.prototype.key = function(object) {};
  SuperagentRequest.prototype.on = function(object) {};
  SuperagentRequest.prototype.redirects = function(count) {
    if (typeof count !== "number" || count < 0) {
      count = 0;
    }
    if (count > 0) {
      throw new Error("redirects(value) with a value > 0 is not implemented");
    }
    return this;
  };
  SuperagentRequest.prototype.timeout = function(delay) {
    if (typeof delay !== "number" || delay < 0) {
      delay = 0;
    }
    this._flags.timeout = delay;
    return this;
  };

  // methods
  SuperagentRequest.prototype.query = function(object) {
    this._flags.query = object;
    return this;
  };

  SuperagentRequest.prototype.send = function(object) {
    if (typeof object === "string" && this._flags.type === "application/json") {
      object = JSON.parse(object);
    }
    this._flags.body = object;
    return this;
  };

  SuperagentRequest.prototype.set = function(headerName, headerValue) {
    this._flags.headers = this._flags.headers || {};
    this._flags.headers[headerName] = headerValue;
    return this;
  };

  SuperagentRequest.prototype.type = function(type) {
    this._flags.type = types[type] || type;
    this.set("Content-Type", this._flags.type);
    return this;
  };

  SuperagentRequest.prototype.end = async function(callback) {
    const flags = this._flags;
    const query = flags.query
      ? qs.stringify(flags.query, { arrayFormat: "repeat" })
      : "";
    const headers = flags.headers || undefined;
    const body = flags.body || undefined;
    const request = {
      url: `${flags.path}${query ? `?${query}` : ""}`,
      method: flags.method || "GET",
      headers,
      body
    };

    const { context, error } = await this.__agent._execute({ request });
    const { req, res, metadata, httpResponse, errorPassedToNext } = context;

    decorateRequest(req);
    decorateResponse(res, httpResponse);

    if (callback) {
      callback(decodeResError(res, metadata, error), res);
    } else if (errorPassedToNext) {
      throw errorPassedToNext;
    }
  };

  return SuperagentRequest;
})();

try {
  require("superagent");

  Superagent.agent = proxyquire("superagent/lib/node/agent", {
    "../..": Superagent,
    methods: http.METHODS.map(method => method.toLowerCase())
  });
} catch (e) {
  Object.defineProperty(Superagent, "agent", {
    get: () => {
      throw new Error("superagent is not installed");
    }
  });
}

module.exports = Superagent;
